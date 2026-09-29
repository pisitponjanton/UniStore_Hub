import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const REGION = process.env.TEST_AWS_REGION || 'us-east-1';
const STACK_NAME = process.env.TEST_AWS_STACK_NAME || 'unistore-hub-dev';

async function runAws(args, { timeout = 30000 } = {}) {
  const { stdout } = await execFileAsync(
    'aws',
    [...args, '--region', REGION],
    {
      timeout,
      maxBuffer: 4 * 1024 * 1024,
      env: process.env,
    },
  );

  return stdout.trim();
}

async function runAwsJson(args, options) {
  const stdout = await runAws([...args, '--output', 'json'], options);
  return stdout ? JSON.parse(stdout) : null;
}

async function detectDeployment() {
  try {
    await execFileAsync('aws', ['--version'], {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      env: process.env,
    });
  } catch (error) {
    if (error?.code === 'ENOENT' || /not found/i.test(error?.message || '')) {
      return {
        ready: false,
        reason: 'AWS CLI is not installed/available on the Testing Agent machine',
      };
    }

    return {
      ready: false,
      reason: `AWS CLI prerequisite check failed: ${error.message}`,
    };
  }

  try {
    const identity = await runAwsJson(['sts', 'get-caller-identity']);
    const stackResponse = await runAwsJson([
      'cloudformation',
      'describe-stacks',
      '--stack-name',
      STACK_NAME,
    ]);
    const stack = stackResponse?.Stacks?.[0];

    if (!stack) {
      return {
        ready: false,
        reason: `CloudFormation stack ${STACK_NAME} was not found in ${REGION}`,
      };
    }

    const outputs = Object.fromEntries(
      (stack.Outputs || []).map((item) => [item.OutputKey, item.OutputValue]),
    );

    return {
      ready: true,
      identity,
      stack,
      outputs,
    };
  } catch (error) {
    return {
      ready: false,
      reason: `AWS Learner Lab deployment is unavailable: ${error.stderr?.trim() || error.message}`,
    };
  }
}

const deployment = await detectDeployment();

function requireDeployment(t) {
  if (!deployment.ready) {
    t.todo(`BLOCKED: ${deployment.reason}`);
    return false;
  }
  return true;
}

const expectedOutputs = [
  'FrontendBucketName',
  'FrontendWebsiteURL',
  'FilesBucketName',
  'AppTableName',
  'NotificationQueueURL',
  'BackendFunctionName',
  'WorkerFunctionName',
  'ApiBaseURL',
];

test('AWS-001 Learner Lab identity is reachable and stack unistore-hub-dev is deployed in us-east-1', async (t) => {
  if (!requireDeployment(t)) return;

  assert.equal(REGION, 'us-east-1');
  assert.equal(STACK_NAME, 'unistore-hub-dev');
  assert.ok(deployment.identity?.Account, 'Expected AWS account identity');
  assert.equal(deployment.stack?.StackName, STACK_NAME);
  assert.match(
    deployment.stack?.StackStatus || '',
    /(?:CREATE|UPDATE)_COMPLETE$/,
    'Expected a completed CloudFormation stack',
  );
});

test('AWS-002 deployed stack exposes all required outputs', async (t) => {
  if (!requireDeployment(t)) return;

  for (const key of expectedOutputs) {
    assert.ok(
      typeof deployment.outputs[key] === 'string' &&
        deployment.outputs[key].trim().length > 0,
      `Missing/empty stack output: ${key}`,
    );
  }
});

test('AWS-003 FrontendWebsiteURL responds with static site content', async (t) => {
  if (!requireDeployment(t)) return;

  const url = deployment.outputs.FrontendWebsiteURL;
  assert.ok(url, 'FrontendWebsiteURL output is required');

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.ok(body.trim().length > 0, 'Expected non-empty static frontend content');
});

test('AWS-004 GET <ApiBaseURL>/health returns the canonical healthy response', async (t) => {
  if (!requireDeployment(t)) return;

  const apiBaseUrl = deployment.outputs.ApiBaseURL;
  assert.ok(apiBaseUrl, 'ApiBaseURL output is required');

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/health`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    success: true,
    data: { status: 'ok' },
  });
});

test('AWS-005 deployed AppTable has expected keys, GSI1, and PAY_PER_REQUEST billing', async (t) => {
  if (!requireDeployment(t)) return;

  const tableName = deployment.outputs.AppTableName;
  assert.ok(tableName, 'AppTableName output is required');

  const result = await runAwsJson([
    'dynamodb',
    'describe-table',
    '--table-name',
    tableName,
  ]);
  const table = result?.Table;

  assert.ok(table);
  assert.deepEqual(table.KeySchema, [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ]);

  const definitions = Object.fromEntries(
    (table.AttributeDefinitions || []).map((entry) => [
      entry.AttributeName,
      entry.AttributeType,
    ]),
  );
  assert.deepEqual(definitions, {
    PK: 'S',
    SK: 'S',
    GSI1PK: 'S',
    GSI1SK: 'S',
  });

  const gsi = (table.GlobalSecondaryIndexes || []).find(
    (item) => item.IndexName === 'GSI1',
  );
  assert.ok(gsi, 'GSI1 is required');
  assert.deepEqual(gsi.KeySchema, [
    { AttributeName: 'GSI1PK', KeyType: 'HASH' },
    { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
  ]);
  assert.equal(table.BillingModeSummary?.BillingMode, 'PAY_PER_REQUEST');
});

test('AWS-006 deployed FilesBucket is not publicly readable', async (t) => {
  if (!requireDeployment(t)) return;

  const bucket = deployment.outputs.FilesBucketName;
  assert.ok(bucket, 'FilesBucketName output is required');

  const publicAccess = await runAwsJson([
    's3api',
    'get-public-access-block',
    '--bucket',
    bucket,
  ]);

  assert.deepEqual(publicAccess?.PublicAccessBlockConfiguration, {
    BlockPublicAcls: true,
    IgnorePublicAcls: true,
    BlockPublicPolicy: true,
    RestrictPublicBuckets: true,
  });

  const policyStatus = await runAwsJson([
    's3api',
    'get-bucket-policy-status',
    '--bucket',
    bucket,
  ]);
  assert.equal(policyStatus?.PolicyStatus?.IsPublic, false);
});

test('AWS-007 NotificationQueue is connected to WorkerFunction through an enabled event source mapping', async (t) => {
  if (!requireDeployment(t)) return;

  const queueUrl = deployment.outputs.NotificationQueueURL;
  const workerName = deployment.outputs.WorkerFunctionName;
  assert.ok(queueUrl);
  assert.ok(workerName);

  const attrs = await runAwsJson([
    'sqs',
    'get-queue-attributes',
    '--queue-url',
    queueUrl,
    '--attribute-names',
    'QueueArn',
  ]);
  const queueArn = attrs?.Attributes?.QueueArn;
  assert.ok(queueArn, 'Expected QueueArn');

  const mappings = await runAwsJson([
    'lambda',
    'list-event-source-mappings',
    '--function-name',
    workerName,
    '--event-source-arn',
    queueArn,
  ]);

  const enabled = (mappings?.EventSourceMappings || []).find(
    (mapping) =>
      mapping.EventSourceArn === queueArn &&
      mapping.State === 'Enabled',
  );

  assert.ok(enabled, 'Expected enabled SQS -> Worker event source mapping');
});

test('AWS-008 Backend and Worker emit CloudWatch logs after invocation', async (t) => {
  if (!requireDeployment(t)) return;

  const apiBaseUrl = deployment.outputs.ApiBaseURL;
  const backendName = deployment.outputs.BackendFunctionName;
  const workerName = deployment.outputs.WorkerFunctionName;
  assert.ok(apiBaseUrl && backendName && workerName);

  const healthResponse = await fetch(
    `${apiBaseUrl.replace(/\/$/, '')}/health`,
    { signal: AbortSignal.timeout(10000) },
  );
  assert.equal(healthResponse.status, 200);

  // Empty SQS batch exercises the deployed Worker handler without creating
  // business data. The AWS CLI writes Lambda payload output to /dev/stdout.
  await execFileAsync(
    'aws',
    [
      'lambda',
      'invoke',
      '--function-name',
      workerName,
      '--cli-binary-format',
      'raw-in-base64-out',
      '--payload',
      '{"Records":[]}',
      '--region',
      REGION,
      '/dev/stdout',
    ],
    {
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
      env: process.env,
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 1500));

  for (const functionName of [backendName, workerName]) {
    const groupName = `/aws/lambda/${functionName}`;
    const streams = await runAwsJson([
      'logs',
      'describe-log-streams',
      '--log-group-name',
      groupName,
      '--order-by',
      'LastEventTime',
      '--descending',
      '--limit',
      '1',
    ]);

    assert.ok(
      (streams?.logStreams || []).length > 0,
      `Expected CloudWatch log stream for ${functionName}`,
    );
  }
});

test('AWS-009 deployed stack contains only the resolved Learner Lab baseline service families', async (t) => {
  if (!requireDeployment(t)) return;

  const resources = await runAwsJson([
    'cloudformation',
    'list-stack-resources',
    '--stack-name',
    STACK_NAME,
  ]);

  const types = (resources?.StackResourceSummaries || []).map(
    (resource) => resource.ResourceType,
  );

  const forbiddenPrefixes = [
    'AWS::CloudFront::',
    'AWS::Cognito::',
    'AWS::SES::',
    'AWS::EC2::',
    'AWS::RDS::',
    'AWS::ECS::',
    'AWS::EKS::',
    'AWS::ElasticLoadBalancing::',
    'AWS::ElasticLoadBalancingV2::',
    'AWS::IAM::Role',
    'AWS::Budgets::',
  ];

  for (const type of types) {
    assert.equal(
      forbiddenPrefixes.some((prefix) => type.startsWith(prefix)),
      false,
      `Forbidden Learner Lab baseline dependency deployed: ${type}`,
    );
  }

  assert.ok(types.includes('AWS::S3::Bucket'));
  assert.ok(types.includes('AWS::ApiGateway::RestApi'));
  assert.ok(types.includes('AWS::Lambda::Function'));
  assert.ok(types.includes('AWS::DynamoDB::Table'));
  assert.ok(types.includes('AWS::SQS::Queue'));
  assert.ok(types.includes('AWS::Logs::LogGroup'));
});
