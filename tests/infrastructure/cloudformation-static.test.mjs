import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const infraRoot = path.join(repoRoot, 'infrastructure');
const templatePath = path.join(infraRoot, 'template.yaml');

const template = await readFile(templatePath, 'utf8');

function yamlBlock(source, key, indent = 2) {
  const prefix = ' '.repeat(indent);
  const startPattern = new RegExp(`^${prefix}${key}:\\s*$`, 'm');
  const match = startPattern.exec(source);

  assert.ok(match, `Missing YAML block: ${key}`);

  const start = match.index;
  const rest = source.slice(start + match[0].length);
  const nextPattern = new RegExp(`^${prefix}[^\\s#][^:]*:\\s*$`, 'm');
  const next = nextPattern.exec(rest);

  return source.slice(start, next ? start + match[0].length + next.index : source.length);
}

function assertContainsAll(source, tokens, label) {
  for (const token of tokens) {
    assert.ok(source.includes(token), `${label} missing ${token}`);
  }
}

test('INFRA-CFN-001 required CloudFormation resource inventory and resource types exist', () => {
  const expected = {
    FrontendBucket: 'AWS::S3::Bucket',
    FrontendBucketPolicy: 'AWS::S3::BucketPolicy',
    FilesBucket: 'AWS::S3::Bucket',
    AppTable: 'AWS::DynamoDB::Table',
    NotificationQueue: 'AWS::SQS::Queue',
    BackendFunction: 'AWS::Lambda::Function',
    WorkerFunction: 'AWS::Lambda::Function',
    NotificationEventSourceMapping: 'AWS::Lambda::EventSourceMapping',
    ApiGatewayRestApi: 'AWS::ApiGateway::RestApi',
    ApiGatewayDeployment: 'AWS::ApiGateway::Deployment',
    ApiGatewayStage: 'AWS::ApiGateway::Stage',
    BackendInvokePermission: 'AWS::Lambda::Permission',
    BackendLogGroup: 'AWS::Logs::LogGroup',
    WorkerLogGroup: 'AWS::Logs::LogGroup',
    ApiAccessLogGroup: 'AWS::Logs::LogGroup',
  };

  for (const [name, type] of Object.entries(expected)) {
    const block = yamlBlock(template, name, 2);
    assert.ok(block.includes(`Type: ${type}`), `${name} must be ${type}`);
  }
});

test('INFRA-CFN-002 AppTable uses PAY_PER_REQUEST with PK/SK and GSI1PK/GSI1SK on GSI1', () => {
  const block = yamlBlock(template, 'AppTable', 2);

  assert.match(block, /^\s{6}BillingMode:\s+PAY_PER_REQUEST\s*$/m);
  assertContainsAll(
    block,
    [
      'AttributeName: PK',
      'AttributeName: SK',
      'AttributeName: GSI1PK',
      'AttributeName: GSI1SK',
      'IndexName: GSI1',
      'ProjectionType: ALL',
    ],
    'AppTable',
  );

  assert.match(block, /AttributeName:\s+PK[\s\S]*?KeyType:\s+HASH/);
  assert.match(block, /AttributeName:\s+SK[\s\S]*?KeyType:\s+RANGE/);
  assert.match(block, /IndexName:\s+GSI1[\s\S]*?AttributeName:\s+GSI1PK[\s\S]*?KeyType:\s+HASH/);
  assert.match(block, /IndexName:\s+GSI1[\s\S]*?AttributeName:\s+GSI1SK[\s\S]*?KeyType:\s+RANGE/);
});

test('INFRA-CFN-003 FilesBucket is private, AES256 encrypted, and CORS allows only GET/PUT/HEAD', () => {
  const block = yamlBlock(template, 'FilesBucket', 2);

  for (const flag of [
    'BlockPublicAcls: true',
    'IgnorePublicAcls: true',
    'BlockPublicPolicy: true',
    'RestrictPublicBuckets: true',
  ]) {
    assert.ok(block.includes(flag), `FilesBucket missing ${flag}`);
  }

  assert.ok(block.includes('SSEAlgorithm: AES256'));
  assert.ok(block.includes('AllowedMethods:'));

  const methods = [...block.matchAll(/^\s+-\s+(GET|PUT|HEAD|POST|DELETE)\s*$/gm)].map((m) => m[1]);
  assert.deepEqual([...new Set(methods)].sort(), ['GET', 'HEAD', 'PUT']);
});

test('INFRA-CFN-004 Frontend bucket is a static website and public policy grants only s3:GetObject', () => {
  const bucket = yamlBlock(template, 'FrontendBucket', 2);
  const policy = yamlBlock(template, 'FrontendBucketPolicy', 2);

  assert.ok(bucket.includes('WebsiteConfiguration:'));
  assert.ok(bucket.includes('IndexDocument: index.html'));
  assert.ok(policy.includes('Principal: "*"'));
  assert.ok(policy.includes('s3:GetObject'));

  assert.doesNotMatch(policy, /s3:(?:PutObject|DeleteObject|ListBucket)/);
});

test('INFRA-CFN-005 Lambda functions use existing LabRole and template creates no custom IAM role/user/group', () => {
  for (const name of ['BackendFunction', 'WorkerFunction']) {
    const block = yamlBlock(template, name, 2);
    assert.match(block, /Role:\s+!Sub\s+"arn:\$\{AWS::Partition\}:iam::\$\{AWS::AccountId\}:role\/LabRole"/);
  }

  assert.doesNotMatch(template, /^\s+Type:\s+AWS::IAM::(?:Role|User|Group)\s*$/m);
});

test('INFRA-CFN-006 Lambda Environment.Variables does not inject reserved AWS_REGION', () => {
  const backend = yamlBlock(template, 'BackendFunction', 2);
  const worker = yamlBlock(template, 'WorkerFunction', 2);

  assert.doesNotMatch(backend, /^\s+AWS_REGION:\s*/m);
  assert.doesNotMatch(worker, /^\s+AWS_REGION:\s*/m);
});

test('INFRA-CFN-007 SQS event mapping connects NotificationQueue to WorkerFunction with normal redelivery baseline', () => {
  const queue = yamlBlock(template, 'NotificationQueue', 2);
  const mapping = yamlBlock(template, 'NotificationEventSourceMapping', 2);

  assert.match(queue, /^\s{4}Type:\s+AWS::SQS::Queue\s*$/m);
  assert.doesNotMatch(queue, /RedrivePolicy:/);
  assert.doesNotMatch(queue, /FifoQueue:\s+true/);

  assert.ok(mapping.includes('EventSourceArn: !GetAtt NotificationQueue.Arn'));
  assert.ok(mapping.includes('FunctionName: !Ref WorkerFunction'));
  assert.ok(mapping.includes('Enabled: true'));
  assert.ok(mapping.includes('BatchSize: 10'));
  assert.ok(mapping.includes('ReportBatchItemFailures'));

  const sqsResources = template.match(/^\s{4}Type:\s+AWS::SQS::Queue\s*$/gm) || [];
  assert.equal(sqsResources.length, 1, 'MVP must create exactly one SQS queue');
});

test('INFRA-CFN-008 Backend, Worker, and API access CloudWatch log groups retain logs for 7 days', () => {
  for (const name of ['BackendLogGroup', 'WorkerLogGroup', 'ApiAccessLogGroup']) {
    const block = yamlBlock(template, name, 2);
    assert.match(block, /^\s{6}RetentionInDays:\s+7\s*$/m);
  }
});

test('INFRA-CFN-009 API Gateway proxy/deployment/stage and Lambda invoke permission are wired', () => {
  const rootAny = yamlBlock(template, 'ApiGatewayRootAnyMethod', 2);
  const proxyAny = yamlBlock(template, 'ApiGatewayProxyAnyMethod', 2);
  const deployment = yamlBlock(template, 'ApiGatewayDeployment', 2);
  const stage = yamlBlock(template, 'ApiGatewayStage', 2);
  const permission = yamlBlock(template, 'BackendInvokePermission', 2);

  for (const block of [rootAny, proxyAny]) {
    assert.ok(block.includes('HttpMethod: ANY'));
    assert.ok(block.includes('Type: AWS_PROXY'));
    assert.ok(block.includes('IntegrationHttpMethod: POST'));
    assert.ok(block.includes('BackendFunction.Arn'));
  }

  assertContainsAll(
    deployment,
    [
      'ApiGatewayRootAnyMethod',
      'ApiGatewayProxyAnyMethod',
      'ApiGatewayRootOptionsMethod',
      'ApiGatewayProxyOptionsMethod',
    ],
    'ApiGatewayDeployment',
  );

  assert.ok(stage.includes('DeploymentId: !Ref ApiGatewayDeployment'));
  assert.ok(stage.includes('AccessLogSetting:'));
  assert.ok(permission.includes('Principal: apigateway.amazonaws.com'));
  assert.ok(permission.includes('${ApiGatewayRestApi}/*/*/*'));
});

test('INFRA-CFN-010 forbidden Learner Lab services and project-created IAM roles are absent', () => {
  const forbiddenTypes = [
    'AWS::CloudFront::',
    'AWS::Cognito::',
    'AWS::SES::',
    'AWS::EC2::',
    'AWS::RDS::',
    'AWS::ECS::',
    'AWS::EKS::',
    'AWS::ElasticLoadBalancing::',
    'AWS::ElasticLoadBalancingV2::',
    'AWS::Budgets::',
    'AWS::IAM::Role',
  ];

  for (const type of forbiddenTypes) {
    assert.equal(template.includes(`Type: ${type}`), false, `Forbidden resource present: ${type}`);
  }

  assert.equal(/Type:\s+AWS::EC2::NatGateway/.test(template), false);
});

test('INFRA-CFN-011 JWT secret parameter is NoEcho without default and expected stack outputs exist', () => {
  const jwt = yamlBlock(template, 'JWTSecret', 2);
  assert.ok(jwt.includes('NoEcho: true'));
  assert.doesNotMatch(jwt, /^\s+Default:/m);

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

  for (const name of expectedOutputs) {
    assert.ok(template.includes(`  ${name}:\n`), `Missing output ${name}`);
  }
});

test('INFRA-CFN-012 infrastructure-owned validator passes the canonical template', async () => {
  const { stdout, stderr } = await execFileAsync(
    'python3',
    ['validate_infrastructure.py'],
    { cwd: infraRoot, timeout: 30000 },
  );

  assert.equal(stderr, '');
  assert.match(stdout, /YAML_PARSE=PASS/);
  assert.match(stdout, /CONTRACT_CHECK=PASS/);
});
