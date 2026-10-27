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


// Diagram flows 3–14 are implemented by a single Backend Lambda, an
// authorized S3 upload path, and a queue-driven Worker using the same table.
test('READINESS-008 API/S3 browser CORS and deployment origins follow S3 website outputs', async () => {
  const template = await source('infrastructure/template.yaml');
  const frontendBucket = template.split('  FrontendBucket:\n')[1]?.split('\n  FrontendBucketPolicy:')[0] || '';
  const filesBucket = template.split('  FilesBucket:\n')[1]?.split('\n  AppTable:')[0] || '';
  const backendFunction = template.split('  BackendFunction:\n')[1]?.split('\n  WorkerFunction:')[0] || '';
  const apiOptions = template.split('  ApiGatewayProxyOptionsMethod:\n')[1]?.split('\n  ApiAccessLogGroup:')[0] || '';
  const deployFrontend = await source('scripts/deploy-frontend.sh');
  const frontendConfig = await source('frontend/next.config.ts');

  assert.ok(frontendBucket.includes('IndexDocument: index.html'));
  assert.match(frontendConfig, /output:\s*["']export["']/);
  assert.ok(filesBucket.includes('- !GetAtt FrontendBucket.WebsiteURL'),
    'Private S3 CORS must use the actual website origin');
  assert.ok(filesBucket.includes('- PUT'));
  assert.ok(filesBucket.includes('- GET'));
  assert.ok(backendFunction.includes('CORS_ALLOWED_ORIGINS: !GetAtt FrontendBucket.WebsiteURL'));
  assert.ok(apiOptions.includes("FrontendBucket.WebsiteURL"));
  assert.ok(apiOptions.includes("Access-Control-Allow-Headers:"));
  assert.ok(deployFrontend.includes('NEXT_PUBLIC_API_BASE_URL='));
  assert.ok(deployFrontend.includes('ApiBaseURL'));
  assert.ok(deployFrontend.includes('aws s3 sync'));
  assert.ok(deployFrontend.includes('FrontendBucketName'));
});

test('READINESS-009 SQS Worker and Backend share one DynamoDB table while retaining separate notification records', async () => {
  const template = await source('infrastructure/template.yaml');
  const backend = template.split('  BackendFunction:\n')[1]?.split('\n  WorkerFunction:')[0] || '';
  const worker = template.split('  WorkerFunction:\n')[1]?.split('\n  BackendLogGroup:')[0] || '';
  const queueMapping = template.split('  NotificationEventSourceMapping:\n')[1]?.split('\n  ApiGatewayRestApi:')[0] || '';
  const appTable = template.split('  AppTable:\n')[1]?.split('\n  NotificationQueue:')[0] || '';
  const workerEntry = await source('backend/src/worker.js');
  const publisher = await source('backend/src/modules/notifications/notification.publisher.js');
  const notificationRepo = await source('backend/src/modules/notifications/notification.repository.js');

  assert.ok(backend.includes('APP_TABLE_NAME: !Ref AppTable'));
  assert.ok(backend.includes('NOTIFICATION_QUEUE_URL: !Ref NotificationQueue'));
  assert.ok(worker.includes('APP_TABLE_NAME: !Ref AppTable'));
  assert.ok(worker.includes('Handler: src/worker.handler'));
  assert.ok(queueMapping.includes('EventSourceArn: !GetAtt NotificationQueue.Arn'));
  assert.ok(queueMapping.includes('FunctionName: !Ref WorkerFunction'));
  assert.ok(queueMapping.includes('ReportBatchItemFailures'));
  assert.ok(appTable.includes('BillingMode: PAY_PER_REQUEST'));
  assert.ok(workerEntry.includes('createNotificationRepository'));
  assert.ok(workerEntry.includes('handleBatch'));
  assert.ok(publisher.includes('sendJson(event)'));
  assert.ok(notificationRepo.includes('createDynamoRepository'));
  assert.ok(notificationRepo.includes("entityType: 'Notification'"));
});

test('READINESS-010 S3 pre-signed browser PUT is separate from private file read authorization', async () => {
  const s3 = await source('backend/src/aws/s3.js');
  const fileService = await source('backend/src/modules/files/file.service.js');
  const browserUpload = await source('frontend/src/modules/payments/direct-upload.ts');
  const productUpload = await source('frontend/src/modules/products/product-image-upload.ts');
  const template = await source('infrastructure/template.yaml');

  assert.ok(s3.includes('getSignedUrl'));
  assert.ok(s3.includes('new PutObjectCommand'));
  assert.ok(s3.includes('new GetObjectCommand'));
  assert.ok(fileService.includes('requireResourceOwnership'));
  assert.ok(fileService.includes('requireStaffOrAdmin'));
  assert.ok(fileService.includes('createPaymentSlipUploadUrl'));
  assert.ok(fileService.includes('createProductImageUploadUrl'));
  assert.ok(fileService.includes('createPrivateDownloadUrl'));
  assert.match(browserUpload, /method:\s*["']PUT["']/);
  assert.ok(productUpload.includes('putProductImageToPresignedUrl'));
  assert.ok(productUpload.includes('upload.url'));
  assert.ok(template.includes('RestrictPublicBuckets: true'));
  assert.ok(template.includes('SSEAlgorithm: AES256'));
});


test('READINESS-011 validates local template before packaging and packaged template before deploy', async () => {
  const script = await source('scripts/deploy-infra.sh');
  const localValidation = script.indexOf('python3 "$(repo_path infrastructure/validate_infrastructure.py)"');
  const packaging = script.indexOf('aws cloudformation package');
  const packagedValidation = script.indexOf('aws cloudformation validate-template');
  const deployment = script.indexOf('aws cloudformation deploy');
  assert.ok(localValidation >= 0, 'Offline source validation is required');
  assert.ok(packaging > localValidation, 'Package must follow offline source validation');
  assert.ok(packagedValidation > packaging, 'Validate the packaged template, never the raw Lambda path');
  assert.ok(deployment > packagedValidation, 'AWS service validation must precede deployment');
  assert.ok(script.includes('--template-body "file://${PACKAGED_TEMPLATE}"'));
  assert.ok(!script.includes('--template-body "file://${INFRA_TEMPLATE}"'));
});

test('READINESS-012 explicit live AWS smoke never treats missing AWS CLI as a successful verification', async () => {
  const sourceText = await source('tests/smoke/aws-deployment.test.mjs');
  assert.ok(sourceText.includes("process.env.TEST_ENABLE_AWS_SMOKE === '1'"));
  assert.ok(sourceText.includes('assert.fail('));
  assert.ok(sourceText.includes('Live AWS verification unavailable:'));
  for (const name of ['AWS-010', 'AWS-011', 'AWS-012']) {
    assert.ok(sourceText.includes(name), `${name} must verify deployed cloud resources`);
  }
});


test('READINESS-013 deployment preflight rejects unsupported Node versions before AWS mutations', async () => {
  const common = await source('scripts/lib/common.sh');
  assert.ok(common.includes('require_supported_build_node() {'));
  assert.ok(common.includes('major === 22 && minor >= 12 || major === 24 || major >= 26'));
  for (const script of [
    'scripts/deploy-all.sh',
    'scripts/deploy-frontend.sh',
    'scripts/build-backend.sh',
  ]) {
    const contents = await source(script);
    assert.ok(contents.includes('require_supported_build_node'), `${script} must validate Node before build`);
    const preflight = contents.indexOf('require_supported_build_node');
    const cloudOrInstall = [contents.indexOf('aws cloudformation'), contents.indexOf('npm ci')]
      .filter(index => index >= 0);
    if (cloudOrInstall.length) {
      assert.ok(preflight < Math.min(...cloudOrInstall), `${script}: check Node before mutation`);
    }
  }
});

test('READINESS-014 AWS business flow requires explicit account, isolated environment and safe presigned S3 target', async () => {
  const suite = await source('tests/e2e/aws-business-flow.test.mjs');
  const docs = await source('infrastructure/README.md');
  assert.ok(suite.includes("process.env.TEST_ENABLE_AWS_BUSINESS_E2E === '1'"));
  assert.ok(suite.includes("'DISPOSABLE_LAB_DATA'"));
  assert.ok(suite.includes('TEST_AWS_EXPECTED_ACCOUNT_ID'));
  assert.ok(suite.includes('caller.Account, expectedAccount'));
  assert.ok(suite.includes("const STACK_NAME = 'unistore-hub-dev'"));
  assert.ok(suite.includes("const REGION = 'us-east-1'"));
  assert.ok(suite.includes('assertPrivatePresignedS3Target'));
  assert.ok(suite.includes('await requiredIsolatedLab()'));
  assert.ok(suite.includes('waitForNotification'));
  assert.ok(suite.includes('listAuditItems'));
  assert.ok(docs.includes('TEST_ENABLE_AWS_BUSINESS_E2E=1'));
  assert.ok(docs.includes('TEST_AWS_E2E_CONFIRM=DISPOSABLE_LAB_DATA'));
});

test('READINESS-015 read-only AWS smoke pins caller account before describing the stack', async () => {
  const suite = await source('tests/smoke/aws-deployment.test.mjs');
  const guard = suite.indexOf("const expectedAccount = process.env.TEST_AWS_EXPECTED_ACCOUNT_ID");
  const caller = suite.indexOf("const identity = await runAwsJson(['sts', 'get-caller-identity'])");
  const accountCheck = suite.indexOf("identity?.Account !== expectedAccount");
  const stackRead = suite.indexOf("'cloudformation',");
  assert.ok(guard > 0 && caller > guard && accountCheck > caller && stackRead > accountCheck);
});

test('READINESS-016 deployment and destruction refuse AWS caller-account mismatch', async () => {
  const common = await source('scripts/lib/common.sh');
  assert.ok(common.includes('AWS_EXPECTED_ACCOUNT_ID'));
  assert.ok(common.includes('account_id}" == "${AWS_EXPECTED_ACCOUNT_ID}'));
  for (const script of ['scripts/deploy-all.sh','scripts/deploy-infra.sh','scripts/destroy.sh']) {
    const body = await source(script);
    assert.ok(body.includes('validate_aws_identity'), `${script} must verify target account`);
  }
});
