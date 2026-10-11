import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = (file) => readFile(path.join(root, file), 'utf8');

// Offline only: never call cloud APIs, deploy, destroy, or read credentials.
test('READINESS-001 deployment shell scripts are syntactically valid', async () => {
  for (const file of [
    'scripts/deploy-all.sh', 'scripts/deploy-infra.sh',
    'scripts/deploy-frontend.sh', 'scripts/build-backend.sh',
    'scripts/destroy.sh', 'scripts/lib/common.sh',
    'scripts/lib/stack-outputs.sh',
  ]) {
    const result = await execFileAsync('bash', ['-n', path.join(root, file)], { timeout: 5000 });
    assert.equal(result.stderr, '');
  }
});

test('READINESS-002 region, stack, stage, identity and JWT preflight precede cloud deployment', async () => {
  const shared = await source('scripts/lib/common.sh');
  const scripts = [
    await source('scripts/deploy-all.sh'),
    await source('scripts/deploy-infra.sh'),
  ];
  for (const required of [
    'DEPLOY_DEFAULT_AWS_REGION="us-east-1"',
    'DEPLOY_DEFAULT_STACK_NAME="unistore-hub-dev"',
    'DEPLOY_DEFAULT_STAGE_NAME="dev"',
    'validate_stack_name', 'validate_stage_name', 'validate_aws_region',
    'require_secret_env JWT_SECRET',
  ]) assert.ok(shared.includes(required), required);
  for (const script of scripts) {
    assert.ok(script.indexOf('require_deployment_secret') < script.indexOf('validate_aws_identity'));
    const cloudAction = script.indexOf('aws cloudformation');
    const delegatedDeploy = script.indexOf('bash "${SCRIPT_DIR}/deploy-infra.sh"');
    const actionIndex = cloudAction >= 0 ? cloudAction : delegatedDeploy;
    assert.ok(actionIndex >= 0 && script.indexOf('validate_aws_identity') < actionIndex,
      'AWS identity must be checked before any deployment action');
    assert.ok(!script.includes('set -x'));
  }
});

test('READINESS-003 no committed JWT default and private file access controls are present', async () => {
  const template = await source('infrastructure/template.yaml');
  const params = JSON.parse(await source('infrastructure/parameters.example.json'));
  const secretBlock = template.split('  JWTSecret:\n')[1]?.split('\n  JWTExpiresIn:')[0];
  assert.ok(secretBlock?.includes('NoEcho: true'));
  assert.ok(!secretBlock?.includes('Default:'));
  assert.equal(params.some((p) => p.ParameterKey === 'JWTSecret'), false);
  const filesBucket = template.split('  FilesBucket:\n')[1]?.split('\n  AppTable:')[0] || '';
  for (const flag of ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets']) {
    assert.ok(filesBucket.includes(flag + ': true'), flag);
  }
  assert.ok(filesBucket.includes('SSEAlgorithm: AES256'));
});

test('READINESS-004 frontend static deployment cannot accidentally sync to private files bucket', async () => {
  const script = await source('scripts/deploy-frontend.sh');
  assert.ok(script.includes('NEXT_PUBLIC_API_BASE_URL='));
  assert.ok(script.includes('aws s3 sync'));
  assert.ok(script.includes('FrontendBucketName'));
  assert.equal(script.includes('s3://\u0024{FilesBucketName}'), false);
  const template = await source('infrastructure/template.yaml');
  assert.ok(template.includes('IndexDocument: index.html'));
  assert.ok(template.includes('PublicReadGetObject'));
});

test('READINESS-005 SQS worker, LabRole and CloudWatch topology are defined', async () => {
  const template = await source('infrastructure/template.yaml');
  assert.ok(template.split('role/LabRole').length >= 3);
  assert.equal(/Type: AWS::IAM::(?:Role|User|Group)/.test(template), false);
  for (const item of ['ReportBatchItemFailures', 'VisibilityTimeout: 120', 'BatchSize: 10',
    'BackendLogGroup:', 'WorkerLogGroup:', 'ApiAccessLogGroup:', 'RetentionInDays: 7']) {
    assert.ok(template.includes(item), item);
  }
});

test('READINESS-006 health, output discovery and destructive confirmation are present', async () => {
  const deploy = await source('scripts/deploy-all.sh');
  const output = await source('scripts/lib/stack-outputs.sh');
  const destroy = await source('scripts/destroy.sh');
  assert.ok(deploy.includes('AbortSignal.timeout(10000)'));
  assert.ok(deploy.includes('HEALTH_URL='));
  assert.ok(output.includes('describe-stacks'));
  for (const name of ['FrontendBucketName','FrontendWebsiteURL','FilesBucketName','AppTableName',
    'NotificationQueueURL','BackendFunctionName','WorkerFunctionName','ApiBaseURL']) {
    assert.ok(output.includes(name), name);
  }
  for (const item of ['ASSUME_YES=false','Type the exact stack name','load_stack_outputs',
    'validate_bucket_name','empty_stack_bucket']) assert.ok(destroy.includes(item), item);
});

test('READINESS-007 offline CloudFormation semantic validator passes', async () => {
  const result = await execFileAsync('python3', [path.join(root,'infrastructure/validate_infrastructure.py')], {
    cwd: root, timeout: 20000,
  });
  assert.match(result.stdout, /YAML_PARSE=PASS/);
  assert.match(result.stdout, /CONTRACT_CHECK=PASS/);
});
