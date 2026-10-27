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
    const expectedAccount = process.env.TEST_AWS_EXPECTED_ACCOUNT_ID;
    if (!/^\\d{12}$/.test(expectedAccount || '')) {
      return {
        ready: false,
        reason: 'TEST_AWS_EXPECTED_ACCOUNT_ID must name the 12-digit authorized Learner Lab account',
      };
    }
    const identity = await runAwsJson(['sts', 'get-caller-identity']);
    if (identity?.Account !== expectedAccount) {
      return {
        ready: false,
        reason: 'AWS caller account differs from TEST_AWS_EXPECTED_ACCOUNT_ID; refusing to inspect an unrelated account',
      };
    }
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

// Live AWS smoke must be explicitly opted in for an authorized isolated
// Learner Lab. Default local quality runs must never probe real AWS accounts.
const deployment = process.env.TEST_ENABLE_AWS_SMOKE === '1'
  ? await detectDeployment()
  : {
      ready: false,
      reason: 'Live AWS smoke is disabled by default. Set TEST_ENABLE_AWS_SMOKE=1 only after explicit staging/AWS authorization',
    };

function requireDeployment(t) {
  if (!deployment.ready) {
    // An explicitly requested AWS verification must fail closed. Otherwise
    // a CI job can exit 0 without checking any real cloud resources.
    if (process.env.TEST_ENABLE_AWS_SMOKE === '1') {
      assert.fail(`Live AWS verification unavailable: ${deployment.reason}`);
    }
    t.skip(`BLOCKED: ${deployment.reason}`);
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


test('AWS-010 deployed Lambda handlers use nodejs22.x and pre-created LabRole', async (t) => {
  if (!requireDeployment(t)) return;
  const cases = [
    {
      functionName: deployment.outputs.BackendFunctionName,
      handler: 'src/lambda.handler',
      variables: {
        APP_TABLE_NAME: deployment.outputs.AppTableName,
        FILES_BUCKET_NAME: deployment.outputs.FilesBucketName,
        NOTIFICATION_QUEUE_URL: deployment.outputs.NotificationQueueURL,
        CORS_ALLOWED_ORIGINS: deployment.outputs.FrontendWebsiteURL,
      },
    },
    {
      functionName: deployment.outputs.WorkerFunctionName,
      handler: 'src/worker.handler',
      variables: { APP_TABLE_NAME: deployment.outputs.AppTableName },
    },
  ];
  for (const item of cases) {
    assert.ok(item.functionName);
    const lambda = await runAwsJson([
      'lambda', 'get-function-configuration', '--function-name', item.functionName,
    ]);
    assert.equal(lambda.Runtime, 'nodejs22.x');
    assert.equal(lambda.Handler, item.handler);
    assert.match(lambda.Role || '', /:role\/LabRole$/);
    assert.equal(lambda.State, 'Active');
    for (const [name, value] of Object.entries(item.variables)) {
      assert.equal(lambda.Environment?.Variables?.[name], value, `${item.handler}: ${name}`);
    }
    if (item.handler === 'src/lambda.handler') {
      assert.ok(lambda.Environment?.Variables?.JWT_SECRET, 'JWT secret must be supplied in Lambda configuration');
    }
  }
});

test('AWS-011 actual browser origins work for API preflight and private S3 CORS', async (t) => {
  if (!requireDeployment(t)) return;
  const apiUrl = deployment.outputs.ApiBaseURL?.replace(/\/$/, '');
  const origin = new URL(deployment.outputs.FrontendWebsiteURL).origin;
  assert.ok(apiUrl && origin);

  // Browser API requests from the HTTP S3 website must be preflighted
  // before the HTTPS API Gateway REST API can receive authenticated calls.
  const options = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
    signal: AbortSignal.timeout(10000),
  });
  assert.ok([200, 204].includes(options.status), `API OPTIONS returned ${options.status}`);
  assert.equal(options.headers.get('access-control-allow-origin'), origin);
  assert.match(options.headers.get('access-control-allow-methods') || '', /POST/);

  const health = await fetch(`${apiUrl}/health`, {
    headers: { Origin: origin },
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('access-control-allow-origin'), origin);

  const cors = await runAwsJson([
    's3api', 'get-bucket-cors', '--bucket', deployment.outputs.FilesBucketName,
  ]);
  assert.ok((cors?.CORSRules || []).some((rule) =>
    rule.AllowedOrigins?.includes(origin) &&
    ['GET', 'PUT', 'HEAD'].every(method => rule.AllowedMethods?.includes(method)),
  ), 'Private FilesBucket must permit the deployed frontend origin for signed GET/PUT/HEAD');
});

test('AWS-012 FilesBucket retains SSE-S3 encryption and public access block', async (t) => {
  if (!requireDeployment(t)) return;
  const bucket = deployment.outputs.FilesBucketName;
  assert.ok(bucket);
  const encryption = await runAwsJson([
    's3api', 'get-bucket-encryption', '--bucket', bucket,
  ]);
  assert.ok(encryption?.ServerSideEncryptionConfiguration?.Rules?.some(
    rule => rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'AES256',
  ), 'Private FilesBucket requires SSE-S3 AES256');
  const block = await runAwsJson([
    's3api', 'get-public-access-block', '--bucket', bucket,
  ]);
  assert.ok(Object.values(block?.PublicAccessBlockConfiguration || {}).every(Boolean),
    'Private FilesBucket must block public access');
});

test('AWS-013 S3 website serves exported deep-link pages without backend rendering', async (t) => {
  if (!requireDeployment(t)) return;
  const website = deployment.outputs.FrontendWebsiteURL?.replace(/\/$/, '');
  assert.ok(website);
  for (const route of ['/login/', '/register/', '/org/stores/view/', '/org/audit/']) {
    const res = await fetch(website + route, { signal: AbortSignal.timeout(10000) });
    assert.equal(res.status, 200, `Static deep link ${route} returned ${res.status}`);
    const html = await res.text();
    assert.match(html, /<html|<!DOCTYPE html/i);
    assert.ok(html.includes('/_next/'), `Static export for ${route} must reference bundled Next.js assets`);
  }
});
