# UniStore Hub Infrastructure

AWS CloudFormation infrastructure for the UniStore Hub AWS Academy Learner Lab deployment.

## Baseline

- Region: `us-east-1`
- Stack baseline: `unistore-hub-dev`
- IaC: AWS CloudFormation
- Runtime IAM role: existing `LabRole`
- Frontend hosting: Amazon S3 Static Website
- API: Amazon API Gateway REST API → Backend Lambda
- Database: one DynamoDB application table
- Files: private Amazon S3 bucket
- Notifications: Amazon SQS → Worker Lambda → DynamoDB
- Logs/metrics: Amazon CloudWatch

This Learner Lab baseline intentionally does not use CloudFront, Cognito, SES, EC2, RDS, NAT Gateway, Load Balancer, ECS, EKS, a custom Lambda execution role, or a project-specific SQS DLQ.

## Files

```text
infrastructure/
├── AGENT.md
├── template.yaml
├── parameters.example.json
└── README.md
```

`template.yaml` is the canonical infrastructure template.

## Prerequisites

Before packaging or deploying:

1. AWS CLI must be installed and authenticated with the current AWS Academy Learner Lab credentials.
2. The active region must be `us-east-1`. Set `AWS_EXPECTED_ACCOUNT_ID` to the exact account returned by `aws sts get-caller-identity`; deployment and destruction refuse other accounts.
3. The pre-created `LabRole` must exist in the Learner Lab account.
4. Backend build artifacts must exist at:

```text
backend/.build/lambda/
```

The shared artifact must contain both Lambda handlers:

```text
src/lambda.handler
src/worker.handler
```

5. A JWT signing secret must be supplied at deployment time. Do not commit it.

Useful account checks:

```bash
aws sts get-caller-identity
# Confirm the Account field belongs to your own current Learner Lab.
export AWS_EXPECTED_ACCOUNT_ID=<your-12-digit-lab-account>
aws configure get region
```

Learner Lab credentials are temporary. If the identity check fails, refresh/restart the Learner Lab session before diagnosing the application.

## CloudFormation Parameters

The template defines:

| Parameter | Required | Default | Purpose |
|---|---:|---|---|
| `StageName` | No | `dev` | API Gateway stage |
| `JWTSecret` | Yes | none | Backend JWT signing secret; `NoEcho` |
| `JWTExpiresIn` | No | `1d` | Backend JWT expiration |

`parameters.example.json` contains only safe, non-secret example values. It intentionally omits `JWTSecret`.

Never store AWS credentials or a real JWT secret in this directory.

## Validate

Run the infrastructure-local contract validation before packaging:

```bash
cd infrastructure
python3 validate_infrastructure.py
```

The source template intentionally contains local Lambda artifact paths for `aws cloudformation package`. After packaging, validate the generated packaged template against the CloudFormation service:

```bash
aws cloudformation validate-template \
  --template-body file://<packaged-template-path> \
  --region us-east-1
```

Service-backed validation depends on the AWS CLI and a live Learner Lab session.

## Package

The Lambda `Code` references the local build artifact and is rewritten by `aws cloudformation package`.

Canonical intent:

```bash
aws cloudformation package \
  --template-file infrastructure/template.yaml \
  --s3-bucket <private-cloudformation-artifact-bucket> \
  --output-template-file <packaged-template-path> \
  --region us-east-1
```

The deployment/tooling subsystem owns creation and lifecycle of the private packaging bucket. Infrastructure does not create an alternate application deployment pipeline.

## Deploy

Canonical intent:

```bash
aws cloudformation deploy \
  --template-file <packaged-template-path> \
  --stack-name unistore-hub-dev \
  --region us-east-1 \
  --parameter-overrides \
    StageName=dev \
    JWTSecret="$JWT_SECRET" \
    JWTExpiresIn=1d \
  --no-fail-on-empty-changeset
```

Do not add `CAPABILITY_NAMED_IAM` by habit: this baseline does not create a custom IAM role.

The project-level deployment workflow is defined outside this directory and ultimately targets `npm run deploy`.

## Created Resources

The template represents these primary resources:

- Frontend S3 website bucket and minimum public-read bucket policy
- Private Files S3 bucket with Public Access Block, SSE-S3, and pre-signed request CORS
- DynamoDB AppTable with `PK/SK` and `GSI1PK/GSI1SK`
- Standard SQS NotificationQueue
- Backend Lambda
- Notification Worker Lambda
- SQS EventSourceMapping
- API Gateway REST API, proxy routes, deployment, and stage
- API Gateway Lambda invoke permission
- Backend, Worker, and API access CloudWatch log groups

Lambda runtime configuration deliberately does not inject the reserved `AWS_REGION` environment variable.

## Stack Outputs

Deployment tooling consumes these exact output names:

```text
FrontendBucketName
FrontendWebsiteURL
FilesBucketName
AppTableName
NotificationQueueURL
BackendFunctionName
WorkerFunctionName
ApiBaseURL
```

`ApiBaseURL` does not include `/api/v1`.

Frontend configuration derives:

```text
NEXT_PUBLIC_API_BASE_URL = <ApiBaseURL>/api/v1
```

Health checks use:

```text
<ApiBaseURL>/health
```

## S3 Security Boundaries

### Frontend bucket

The frontend bucket is intentionally public-readable because the Learner Lab architecture uses direct S3 Static Website hosting.

Public access is limited to:

```text
s3:GetObject
```

The deployment environment, not website users, performs uploads/deletes.

### Files bucket

The Files bucket is private and stores Product Images and Payment Slips.

It has:

- S3 Public Access Block enabled
- no public-read bucket policy
- SSE-S3 / AES256 encryption
- CORS for browser `GET`, `PUT`, and `HEAD` from the generated frontend website origin

Browser access must use Backend-authorized pre-signed URLs. Payment Slips must never become public-read.

## API Gateway Logging Caveat

The stack creates an API access log group with 7-day retention and configures stage access logging/metrics.

REST API logging can depend on account-level API Gateway CloudWatch configuration in the Learner Lab account. If that account capability is unavailable, treat it as a Learner Lab deployment limitation rather than creating a custom IAM role.

Access logs intentionally do not include Authorization/JWT values.

## Destroy Caveat

The development/demo stack is intended to be destroyable, but CloudFormation cannot delete non-empty S3 buckets automatically.

Before stack deletion, deployment tooling must empty only the verified application buckets obtained from stack outputs:

- `FrontendBucketName`
- `FilesBucketName`

Do not use wildcard bucket deletion and do not delete unrelated buckets.

Normal redeployment must not clear DynamoDB data or Files bucket content.

## Runtime verification before claiming diagram parity

The offline checks verify code and CloudFormation structure, **not** running AWS
resources. Use Node.js 22.12+, 24 or 26+ for Frontend builds and deployments
(`node --version`; for nvm users, `nvm use 24`). The deploy scripts stop
early on unsupported Node versions rather than leaving a partial deployment.
From the repository root, run the following before deploying:

```bash
cd tests && npm run test:integration && npm run test:infrastructure
```

After the Learner Lab has been started and its temporary credentials have been
configured **on the machine running the tests**, verify the intended AWS
account and stack. Do not commit credentials or a real JWT secret.

```bash
aws sts get-caller-identity --region us-east-1
aws cloudformation describe-stacks --stack-name unistore-hub-dev --region us-east-1
cd tests
TEST_AWS_EXPECTED_ACCOUNT_ID=<your-12-digit-lab-account> TEST_ENABLE_AWS_SMOKE=1 npm run test:smoke
```

The explicit live mode **fails** when AWS CLI, credentials, or the stack are
unavailable. The default smoke mode skips AWS checks rather than reporting them
as verified. Live tests read deployment configuration and check HTTP, S3, IAM
LabRole, Lambda, DynamoDB, SQS, API CORS and CloudWatch. AWS-008 invokes
the Worker with an empty batch to check logs; it does not create a business
notification. Run live smoke only against your authorized Learner Lab.

The infrastructure deployment workflow validates the local source contract,
packages Lambda code to S3, then sends the **packaged** template for
CloudFormation service validation before deploying. Do not send the raw local
Lambda `Code` path directly to the CloudFormation service validator.

Cost Explorer and the Learner Lab budget are account-level services not
created by this stack; verify their balance and permissions in the Learner
Lab console. Static and smoke tests cannot prove that cost monitoring is
configured correctly.

Once the **infrastructure smoke passes**, run the separate mutating business
E2E only against a disposable authorized Learner Lab, never a shared or
production account. The test creates unique users, organization, store,
product, images, campaign, order, payment, pickup and notification records;
these remain in DynamoDB and S3 after the test.

```bash
cd tests
# Obtain the short-lived Platform Admin token on your own computer securely.
# Do not save it in git, shell history, or ChatGPT messages.
export TEST_AWS_PLATFORM_ADMIN_TOKEN=<securely-provisioned-token>
export TEST_AWS_EXPECTED_ACCOUNT_ID=<your-12-digit-lab-account>
TEST_AWS_E2E_CONFIRM=DISPOSABLE_LAB_DATA \\
TEST_ENABLE_AWS_BUSINESS_E2E=1 \\
node --test e2e/aws-business-flow.test.mjs
```

The business test verifies Register/Login, Organization approval, staff
membership, private S3 Store/Product images, customer Payment Slip pre-sign
and PUT, Payment approval, SQS-driven notifications, Pickup confirmation,
and the Audit Log. Every remote call uses the CloudFormation `ApiBaseURL`
of the exact `unistore-hub-dev` stack in `us-east-1` and requires
`aws sts get-caller-identity` to match `TEST_AWS_EXPECTED_ACCOUNT_ID`.
Without all authorizations it fails before creating data.

AWS CLI, credentials, the deployed stack, account-level Cost Explorer
permissions and budget status cannot be established from offline source
checks. Record evidence from the real lab account separately.

## Learner Lab Constraints

Do not introduce these resources into this baseline without an approved shared architecture change:

- CloudFront
- Cognito
- SES
- EC2
- RDS
- VPC / subnets
- NAT Gateway
- Load Balancer / ALB
- ECS / EKS
- custom Lambda IAM execution roles
- provisioned Lambda concurrency
- AWS Budgets CloudFormation resources
- project-specific SQS DLQ

Cost monitoring uses AWS Cost Explorer and the Learner Lab Budget outside the application CloudFormation stack.

## Ownership

The Infrastructure Agent may modify only:

```text
infrastructure/**
```

Frontend, Backend, deployment scripts, tests, root shared files, and shared contracts remain owned by their respective agents/integration workflow.
