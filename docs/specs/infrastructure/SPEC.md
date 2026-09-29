# UniStore Hub — Infrastructure Specification

> Subsystem: Infrastructure
> Implementation ownership: infrastructure/**
> IaC: AWS CloudFormation
> Target: AWS Academy Learner Lab
> Region: us-east-1
> Runtime role: existing LabRole
> Read first: SPEC.md, AGENTS.md, docs/architecture/AWS_ARCHITECTURE.md, docs/specs/00-shared-contracts.md, docs/specs/data/SPEC.md, docs/specs/backend/SPEC.md

---

## 1. Purpose

This document is the implementation contract for the Infrastructure Agent.

The Infrastructure Agent must be able to implement infrastructure/** without changing Frontend or Backend application code.

Infrastructure owns:

- CloudFormation resources
- S3 website hosting resources
- private S3 Files bucket
- DynamoDB application table and GSI
- SQS notification queue
- Backend Lambda resource
- Notification Worker Lambda resource
- SQS event source mapping
- API Gateway REST API, Deployment and Stage
- Lambda invocation permission for API Gateway
- CloudWatch Log Groups and infrastructure logging configuration
- environment-variable injection
- CORS resource configuration
- stack outputs
- LabRole wiring

Infrastructure does not own:

- API business behavior
- Express routes
- authorization decisions
- DynamoDB repository code
- Frontend UI
- deployment shell orchestration

---

## 2. Final Learner Lab Baseline

FINAL architecture:

~~~text
Browser
├── HTTP → S3 Static Website
└── HTTPS → API Gateway → Backend Lambda / Express
                           ├── DynamoDB
                           ├── Pre-signed URL → Browser ↔ Private S3 Files
                           └── SQS → Worker Lambda → DynamoDB Notification

API Gateway / Lambda / SQS / Worker
→ CloudWatch

AWS Usage
→ Cost Explorer / Learner Lab Budget
~~~

Required services:

- Amazon S3
- Amazon API Gateway
- AWS Lambda
- Amazon DynamoDB
- Amazon SQS
- Amazon CloudWatch
- AWS Cost Explorer / Learner Lab Budget
- existing LabRole

Learner Lab baseline must not depend on:

- CloudFront
- Cognito
- SES
- EC2
- RDS
- NAT Gateway
- Load Balancer
- ECS / EKS
- custom IAM role creation

---

## 3. Target Infrastructure Structure

PROJECT DECISION

~~~text
infrastructure/
├── template.yaml
├── parameters.example.json
└── README.md
~~~

template.yaml is the canonical CloudFormation template.

Do not split resources across multiple nested stacks for the MVP unless integration review explicitly changes this decision.

Reason:

- Learner Lab project size is small
- one stack simplifies one-command deployment
- shared outputs remain easy to consume

---

## 4. Stack Identity

Baseline:

~~~text
Region: us-east-1
Stack: unistore-hub-dev
Stage: dev
~~~

Region is FINAL.

Stack/stage naming is the documented development/demo baseline.

Production-like naming beyond the Learner Lab stack is outside current scope.

---

## 5. CloudFormation Resource Inventory

The template must create at least:

~~~text
FrontendBucket
FrontendBucketPolicy
FilesBucket
AppTable
NotificationQueue
BackendFunction
WorkerFunction
NotificationEventSourceMapping
ApiGatewayRestApi
ApiGatewayDeployment
ApiGatewayStage
BackendInvokePermission
BackendLogGroup
WorkerLogGroup
ApiAccessLogGroup
~~~

Additional API Gateway resources/methods required for Lambda proxy routing are allowed.

No IAM User / Group resource is allowed.

No custom Lambda execution role is created.

---

## 6. CloudFormation Parameters

PROJECT DECISION

Minimum parameters:

~~~text
StageName
JWTSecret
JWTExpiresIn
~~~

Backend/Worker code paths are not CloudFormation parameters. The pre-package template references the canonical local artifact `backend/.build/lambda/`, and `aws cloudformation package` rewrites that local reference to S3.

Recommended defaults:

~~~text
StageName = dev
JWTExpiresIn = 1d
~~~

JWTSecret:

- NoEcho: true
- no default secret value
- must be supplied by deployment workflow
- must not be committed in parameters.example.json

Source does not require a secrets-management AWS service for this Learner Lab baseline.

Do not add Secrets Manager or SSM Parameter Store silently.

---

## 7. Existing LabRole

FINAL

Both Lambda functions use the pre-created Learner Lab role.

Canonical ARN pattern:

~~~text
arn:<partition>:iam::<account-id>:role/LabRole
~~~

CloudFormation implementation should derive partition/account from AWS pseudo-parameters rather than hard-coding account values.

No AWS::IAM::Role resource is created.

If LabRole lacks a required permission, treat that as a Learner Lab deployment blocker and report it.

Do not work around the problem by silently creating a custom execution role.

---

## 8. Frontend S3 Website

Logical resource:

~~~text
FrontendBucket
~~~

Purpose:

- host Next.js Static Export
- serve frontend/out files
- provide S3 website endpoint

Required configuration:

- WebsiteConfiguration with index document
- public read for website objects
- bucket policy limited to GetObject
- bucket used only for generated frontend static assets

Suggested index:

~~~text
index.html
~~~

### 8.1 Public Access Configuration

FINAL architecture requires direct S3 Static Website hosting.

Therefore the Frontend bucket must permit public website reads.

PROJECT DECISION:

Configure the Frontend bucket public-access-block settings so the specific public-read bucket policy can function.

Do not apply public access to the Files bucket.

### 8.2 HTTP Caveat

FINAL diagram shows:

~~~text
Browser → HTTP → S3 Static Website
~~~

This is a Learner Lab/demo constraint.

Do not represent direct S3 Website HTTP as the preferred production security architecture.

CloudFront/HTTPS frontend hosting is explicitly not part of this Learner Lab baseline.

---

## 9. Frontend Bucket Policy

Logical resource:

~~~text
FrontendBucketPolicy
~~~

Required policy intent:

~~~text
Principal: *
Action: s3:GetObject
Resource: FrontendBucket/*
~~~

Do not grant:

- PutObject
- DeleteObject
- ListBucket

to the public principal.

Frontend deployment writes are performed by the authenticated deployment environment, not by website users.

---

## 10. Private Files S3 Bucket

Logical resource:

~~~text
FilesBucket
~~~

Purpose:

~~~text
Product Images
Payment Slips
~~~

FINAL:

Payment Slips are private.

Required baseline:

- no public bucket policy
- S3 Public Access Block enabled
- direct browser transfer only through authorized Pre-signed URL
- backend receives bucket name via environment variable

Canonical object-key paths:

~~~text
products/{organizationId}/{productId}/{uuid}
payments/{organizationId}/{orderId}/{uuid}
~~~

Database stores object keys, not public URLs.

---

## 11. Files Bucket Encryption

PROJECT DECISION

Enable S3 server-side encryption using S3-managed keys:

~~~text
SSE-S3 / AES256
~~~

Reason:

- no additional KMS infrastructure/cost/permissions needed
- keeps Learner Lab architecture simple
- does not change application contract

Do not add a customer-managed KMS key unless the shared architecture is changed.

---

## 12. Files Bucket CORS

Direct Browser ↔ S3 Pre-signed requests require CORS.

PROJECT DECISION baseline:

Allowed origin for the AWS demo deployment:

~~~text
FrontendBucket WebsiteURL
~~~

Allowed methods:

~~~text
GET
PUT
HEAD
~~~

Allowed headers:

~~~text
*
~~~

Expose:

~~~text
ETag
~~~

MaxAge:

~~~text
3000 seconds
~~~

Rules:

- CORS does not make the bucket public
- authorization still comes from the Pre-signed URL
- DELETE is not required for the Browser flow
- POST multipart upload is not part of the current API contract
- local Dev Mode origins belong to Dev Mode configuration, not the deployed Learner Lab bucket unless explicitly enabled

---

## 13. File Size Policy

**PROJECT DECISION**

Shared MVP limits:

```text
Product Image: max 5 MiB
Payment Slip: max 10 MiB
Allowed MIME: image/jpeg, image/png, image/webp
```

Infrastructure does not need to make the Files bucket public or add a new service for these limits.

Frontend validates for UX; Backend remains authoritative when issuing/accepting the upload flow. Any S3 policy/pre-signed conditions used later must stay consistent with these values.

---

## 14. DynamoDB AppTable

Logical resource:

~~~text
AppTable
~~~

FINAL baseline:

~~~text
one application table
BillingMode = PAY_PER_REQUEST
~~~

Primary key:

~~~text
PK  String
SK  String
~~~

GSI1:

~~~text
GSI1PK  String
GSI1SK  String
~~~

GSI projection:

PROJECT DECISION

~~~text
ProjectionType = ALL
~~~

Reason:

- MVP access patterns use varied entity fields
- avoids additional read-back complexity
- table is demo/educational scale

Infrastructure must not introduce a second application table merely for Notifications.

Notifications are logically separated by key namespace in the same table baseline.

---

## 15. DynamoDB Schema Ownership

Infrastructure defines physical key/index resources only.

Data semantics belong to:

~~~text
docs/specs/data/SPEC.md
~~~

Infrastructure must match exactly:

- PK
- SK
- GSI1PK
- GSI1SK
- GSI1 index presence
- PAY_PER_REQUEST

Do not invent a second GSI without a documented access pattern and shared Data contract update.

---

## 16. DynamoDB Optional Features

Not required by the source:

- DynamoDB Streams
- Global Tables
- provisioned capacity
- DAX

Do not enable them in the baseline.

**PROJECT DECISION**

No DynamoDB TTL or automatic data cleanup is enabled in the MVP.

Notifications and AuditLogs remain until explicit dev-stack destroy/manual cleanup or a future retention contract change. Point-in-time recovery is not required by the source.

---

## 17. Notification SQS Queue

Logical resource:

~~~text
NotificationQueue
~~~

Purpose:

~~~text
Business Lambda
→ SQS
→ Worker Lambda
~~~

Backend receives queue URL via:

~~~text
NOTIFICATION_QUEUE_URL
~~~

PROJECT DECISION baseline:

- Standard Queue
- no FIFO requirement
- message body follows canonical versioned event payload in Data Spec

The Worker must be idempotent because Standard Queue delivery can repeat.

---

## 18. SQS Visibility / Worker Relationship

PROJECT DECISION

Worker timeout baseline:

~~~text
30 seconds
~~~

Queue visibility timeout must be longer than Worker timeout.

Baseline:

~~~text
VisibilityTimeout = 120 seconds
~~~

This gives processing headroom without changing business semantics.

---

## 19. DLQ / Retry Policy

**PROJECT DECISION**

The MVP does **not** create a project-specific Dead Letter Queue.

Baseline behavior:

- use normal SQS redelivery
- Worker remains idempotent by eventId
- failed records are returned through partial batch failure behavior
- notification failure remains independent from the core Order/Payment transaction

A DLQ may be added only through a future architecture/contract change.

---

## 20. Backend Lambda

Logical resource:

~~~text
BackendFunction
~~~

Purpose:

- Express.js API
- authentication
- JWT
- business logic
- DynamoDB access
- S3 Pre-signed URL generation
- SQS publish

PROJECT DECISION baseline runtime:

~~~text
nodejs22.x
~~~

Handler contract:

~~~text
src/lambda.handler
~~~

PROJECT DECISION baseline sizing:

~~~text
MemorySize = 512 MB
Timeout = 28 seconds
~~~

These are tuning defaults, not business contracts.

---

## 21. Backend Lambda Environment

Required application-configured variables:

~~~text
NODE_ENV=production
APP_TABLE_NAME=<AppTable>
FILES_BUCKET_NAME=<FilesBucket>
NOTIFICATION_QUEUE_URL=<NotificationQueue>
JWT_SECRET=<parameter>
JWT_EXPIRES_IN=<parameter>
CORS_ALLOWED_ORIGINS=<FrontendBucket WebsiteURL>
~~~

`AWS_REGION` is supplied automatically by the AWS Lambda runtime. CloudFormation must not set `AWS_REGION` inside Lambda `Environment.Variables`.

Do not expose JWT_SECRET or AWS credentials to Frontend outputs or website files.

---

## 22. Notification Worker Lambda

Logical resource:

~~~text
WorkerFunction
~~~

Purpose:

~~~text
SQS event
→ validate
→ idempotency
→ write In-app Notification to DynamoDB
~~~

Runtime:

~~~text
nodejs22.x
~~~

Handler contract:

~~~text
src/worker.handler
~~~

PROJECT DECISION baseline sizing:

~~~text
MemorySize = 256 MB
Timeout = 30 seconds
~~~

Required application-configured environment:

~~~text
NODE_ENV=production
APP_TABLE_NAME=<AppTable>
~~~

`AWS_REGION` is runtime-provided by Lambda and must not be injected manually.

Worker does not need JWT_SECRET or Frontend API URL.

---

## 23. SQS Event Source Mapping

Logical resource:

~~~text
NotificationEventSourceMapping
~~~

Connect:

~~~text
NotificationQueue
→ WorkerFunction
~~~

PROJECT DECISION baseline:

~~~text
Enabled = true
BatchSize = 10
FunctionResponseTypes = ReportBatchItemFailures
~~~

Reason:

- supports partial batch failure behavior
- avoids acknowledging failed records in a mixed-success batch

**PROJECT DECISION:** MVP uses normal SQS redelivery and does not create a project DLQ/redrive policy. Adding a DLQ later requires an explicit shared architecture update.

---

## 24. API Gateway REST API

Logical resource:

~~~text
ApiGatewayRestApi
~~~

Type:

~~~text
Amazon API Gateway REST API
~~~

Frontend uses HTTPS for Auth/Business API requests.

### 24.1 Lambda Proxy Integration

PROJECT DECISION

Use Lambda proxy integration for the Express application.

Routing baseline:

~~~text
ANY /
ANY /{proxy+}
~~~

This allows Express to own:

~~~text
/api/v1/*
/health
~~~

without reproducing every business endpoint in CloudFormation.

Infrastructure does not define API business authorization.

---

## 25. API Gateway CORS

Browser origin is the Frontend S3 Website URL.

PROJECT DECISION:

API response CORS is coordinated between API Gateway/proxy behavior and Express configuration.

Canonical allowed AWS demo origin:

~~~text
FrontendBucket WebsiteURL
~~~

Allowed request methods:

~~~text
GET
POST
PATCH
DELETE
OPTIONS
~~~

Allowed headers:

~~~text
Authorization
Content-Type
~~~

Rules:

- do not use unrestricted wildcard origin when the concrete Frontend origin is known
- OPTIONS/preflight must succeed
- CORS is not authorization
- Backend still verifies JWT, membership, role and ownership

Dev Mode local origins are defined separately.

---

## 26. API Gateway Deployment and Stage

Required logical resources:

~~~text
ApiGatewayDeployment
ApiGatewayStage
~~~

Stage is parameterized by StageName with default:

~~~text
dev
~~~

Stage deployment must depend on API methods/resources so the deployed snapshot contains the proxy integration.

---

## 27. API Gateway Lambda Permission

Logical resource:

~~~text
BackendInvokePermission
~~~

Purpose:

Allow API Gateway to invoke BackendFunction.

Scope SourceArn to the created REST API execution ARN rather than all APIs when practical.

Do not create a new IAM execution role for this permission.

---

## 28. API Gateway Logging / Metrics

Architecture requires API Gateway observability in CloudWatch.

Create:

~~~text
ApiAccessLogGroup
~~~

PROJECT DECISION:

- RetentionInDays = 7
- Stage metrics enabled
- access logging enabled where Learner Lab account configuration permits
- logs include request ID, method/route, status and integration error context without Authorization contents

Do not log JWT Authorization headers.

### 28.1 Learner Lab Account Role Caveat

REST API execution logging can depend on account-level API Gateway CloudWatch role configuration.

Baseline rules:

- do not create a custom IAM role
- do not create IAM Users/Groups
- use existing Learner Lab/account capability
- if account-level logging permission is unavailable, report it during deployment validation instead of changing architecture silently

Lambda logs remain mandatory.

---

## 29. Backend CloudWatch Log Group

Logical resource:

~~~text
BackendLogGroup
~~~

Baseline:

~~~text
RetentionInDays = 7
~~~

CloudFormation should manage retention intentionally for the demo stack.

---

## 30. Worker CloudWatch Log Group

Logical resource:

~~~text
WorkerLogGroup
~~~

Baseline:

~~~text
RetentionInDays = 7
~~~

Worker logs should support debugging event processing, invalid events, notification-write failures and idempotent duplicates without logging secrets.

---

## 31. SQS Monitoring

Architecture maps SQS metrics/monitoring to CloudWatch.

Native SQS CloudWatch metrics are the baseline.

Useful metrics include:

- ApproximateNumberOfMessagesVisible
- ApproximateAgeOfOldestMessage

Custom alarms are not required by the source.

---

## 32. Lambda Monitoring

Native Lambda metrics are baseline.

At minimum observe:

- Invocations
- Errors
- Duration
- Throttles

Do not configure provisioned concurrency.

Learner Lab/demo workload is not a capacity benchmark.

---

## 33. Cost Monitoring

FINAL architecture includes:

~~~text
AWS Cost Explorer
Learner Lab Budget
~~~

These are learner-account monitoring capabilities, not application CloudFormation resources in this baseline.

Do not create:

~~~text
AWS::Budgets::Budget
~~~

The final architecture uses Learner Lab Budget instead.

---

## 34. Packaging Boundary

Infrastructure template references the canonical local Backend/Worker artifact:

```text
backend/.build/lambda/
```

Both Lambda resources use the same code artifact with different handlers:

```text
BackendFunction → src/lambda.handler
WorkerFunction  → src/worker.handler
```

The pre-package CloudFormation code reference must point to this local artifact in the form supported by `aws cloudformation package`.

**PROJECT DECISION**

`aws cloudformation package` uses a tooling-only S3 artifact bucket bootstrapped by the deployment script. This bucket is not an application runtime resource and is not part of the AWS architecture diagram.

Expected flow:

~~~text
Backend artifacts
→ aws cloudformation package
→ packaged template
→ aws cloudformation deploy
~~~

Infrastructure Agent must not create a second application build pipeline.

---

## 35. Stack Outputs

Expected outputs:

~~~text
FrontendBucketName
FrontendWebsiteURL
FilesBucketName
AppTableName
NotificationQueueURL
BackendFunctionName
WorkerFunctionName
ApiBaseURL
~~~

PROJECT DECISION exact meanings:

FrontendBucketName:
- physical S3 bucket name used by deployment sync

FrontendWebsiteURL:
- S3 website endpoint including HTTP scheme

FilesBucketName:
- private business-files bucket

AppTableName:
- physical DynamoDB table name

NotificationQueueURL:
- queue URL consumed by Backend configuration

BackendFunctionName:
- Backend Lambda physical function name

WorkerFunctionName:
- Worker Lambda physical function name

ApiBaseURL:
~~~text
https://<api-id>.execute-api.us-east-1.amazonaws.com/dev
~~~

Frontend deployment derives:

~~~text
NEXT_PUBLIC_API_BASE_URL = <ApiBaseURL>/api/v1
~~~

Health smoke test uses:

~~~text
<ApiBaseURL>/health
~~~

---

## 36. CloudFormation Output Consumption

Infrastructure owns output names.

Deployment/Tooling consumes them.

Applications do not query CloudFormation at runtime.

Mappings:

~~~text
AppTableName → APP_TABLE_NAME
FilesBucketName → FILES_BUCKET_NAME
NotificationQueueURL → NOTIFICATION_QUEUE_URL
ApiBaseURL + /api/v1 → NEXT_PUBLIC_API_BASE_URL
FrontendBucketName → aws s3 sync target
~~~

---

## 37. Resource Naming Strategy

PROJECT DECISION

Prefer CloudFormation-generated physical names unless a stable name is explicitly required.

Reasons:

- avoids S3 global-name collision
- supports student/parallel deployments
- stack outputs provide physical names

Do not hard-code account IDs.

---

## 38. S3 Deletion Behavior

PROJECT DECISION

Learner Lab development stack should be destroyable.

CloudFormation cannot remove non-empty S3 buckets automatically.

Destroy tooling must empty FrontendBucket and FilesBucket before stack deletion.

Normal MVP uploaded files have no automatic cleanup policy. Development-stack destroy tooling empties the bucket explicitly; future retention automation requires a contract change.

---

## 39. DynamoDB Deletion Behavior

PROJECT DECISION

The Learner Lab development/demo stack may delete AppTable when the stack is destroyed.

This is not a production data-retention policy.

---

## 40. CORS Origin Dependency

Frontend WebsiteURL is generated by Infrastructure.

Where supported, use the generated WebsiteURL as the single source for:

- Files bucket AllowedOrigins
- Backend CORS_ALLOWED_ORIGINS

Avoid duplicated hard-coded origin strings.

---

## 41. Security Boundary

Infrastructure must enforce:

1. Frontend bucket public read only for static website objects.
2. Files bucket private.
3. Files bucket Public Access Block enabled.
4. no public Payment Slip policy.
5. Lambda uses existing LabRole.
6. no AWS access keys in template parameters.
7. JWTSecret is NoEcho.
8. Backend receives only required resource configuration.
9. Worker receives only required configuration.
10. API Gateway invokes intended Backend Lambda.
11. no Authorization/JWT value is intentionally logged.
12. no CloudFront/Cognito/SES dependency.

---

## 42. Network Architecture

FINAL Learner Lab baseline does not require a VPC.

Do not add:

- VPC
- subnets
- NAT Gateway
- security groups for Lambda
- ALB

unless the shared architecture is intentionally changed.

---

## 43. API Security Ownership

Infrastructure provides:

- HTTPS API Gateway endpoint
- Lambda integration
- CORS transport configuration

Backend provides:

- JWT
- membership
- RBAC
- tenant isolation
- ownership
- business policy

Do not replace Backend JWT auth with API Gateway Cognito authorizer.

---

## 44. File Security Ownership

Infrastructure:

- private FilesBucket
- Public Access Block
- CORS
- LabRole runtime access

Backend:

- requester authorization
- object-key validation
- Pre-signed URL generation

Frontend:

- direct use of returned Pre-signed URL

Payment Slip must never become public-read.

---

## 45. Notification Reliability Boundary

Infrastructure guarantees wiring:

~~~text
NotificationQueue
→ NotificationEventSourceMapping
→ WorkerFunction
~~~

Backend guarantees canonical event shape and idempotent Worker behavior.

MVP retry policy is resolved: use normal SQS redelivery with no project-created DLQ; future DLQ support requires a contract change.

---

## 46. Learner Lab Cost Rules

Prefer:

- S3
- Lambda
- API Gateway
- DynamoDB PAY_PER_REQUEST
- SQS
- short CloudWatch retention

Avoid:

- EC2
- RDS
- NAT Gateway
- Load Balancer
- ECS/EKS
- provisioned Lambda concurrency
- extra databases/queues without requirement
- customer-managed KMS without requirement

---

## 47. parameters.example.json

May contain safe non-secret examples such as:

~~~text
StageName
JWTExpiresIn
~~~

Must not contain a real JWTSecret.

If the key is shown, use an obvious placeholder only.

---

## 48. infrastructure/README.md

Must document:

- prerequisites
- us-east-1
- LabRole dependency
- template parameters
- expected build artifacts
- package command
- deploy command
- outputs
- destroy caveat for non-empty buckets
- Learner Lab limitations
- absence of CloudFront/Cognito/SES

Detailed one-command orchestration belongs to docs/deployment/DEPLOYMENT_SPEC.md.

---

## 49. Infrastructure Validation Responsibilities

Infrastructure Agent must validate:

### CloudFormation

- template syntax
- required resources present
- dependencies valid
- no custom IAM role
- output names match contract

### S3 Frontend

- website configuration
- public GetObject only
- website URL output

### S3 Files

- Public Access Block
- no public policy
- SSE-S3
- CORS GET/PUT/HEAD
- Frontend WebsiteURL origin

### DynamoDB

- PK/SK String
- GSI1PK/GSI1SK String
- PAY_PER_REQUEST
- GSI1 Projection ALL

### Lambda

- Backend/Worker runtime and handlers
- LabRole
- environment variables
- timeouts/memory
- no provisioned concurrency

### SQS

- queue exists
- visibility timeout exceeds Worker timeout
- event source mapping enabled
- partial batch failure support

### API Gateway

- REST API
- proxy integration
- Deployment + Stage
- Lambda permission
- HTTPS URL output
- CORS preflight behavior

### CloudWatch

- Backend Log Group
- Worker Log Group
- API access Log Group
- 7-day retention where specified

---

## 50. Infrastructure Acceptance Criteria

Infrastructure subsystem is implementation-ready when:

- [ ] infrastructure/template.yaml can represent every required resource
- [ ] CloudFormation is the IaC mechanism
- [ ] region baseline is us-east-1
- [ ] existing LabRole is wired to Backend/Worker
- [ ] no custom Lambda execution role is created
- [ ] FrontendBucket serves Next.js Static Export through S3 Website
- [ ] FrontendBucketPolicy grants only required public read
- [ ] FilesBucket remains private
- [ ] FilesBucket Public Access Block is enabled
- [ ] FilesBucket CORS supports direct Pre-signed GET/PUT/HEAD
- [ ] AppTable is one DynamoDB table with PAY_PER_REQUEST
- [ ] AppTable has PK/SK and GSI1PK/GSI1SK
- [ ] NotificationQueue connects to WorkerFunction
- [ ] Worker event source supports partial batch failure
- [ ] BackendFunction receives table/files/queue/JWT config
- [ ] WorkerFunction receives only needed table/runtime config
- [ ] API Gateway REST API proxies root and proxy path to Backend Lambda
- [ ] API Gateway Deployment/Stage exists
- [ ] API Gateway can invoke Backend Lambda
- [ ] CORS uses configured Frontend origin
- [ ] Backend/Worker logs retain 7 days
- [ ] stack outputs match this spec
- [ ] Cost Explorer/Learner Lab Budget are external learner-account monitoring
- [ ] no AWS Budgets resource is created
- [ ] no CloudFront/Cognito/SES dependency exists
- [ ] no EC2/RDS/NAT/ALB/ECS/EKS resources exist
- [ ] this phase does not require application implementation changes outside infrastructure/**

---

## 51. Infrastructure Decision Closure

The previous Infrastructure blockers are resolved as explicit PROJECT DECISIONs:

- no automatic DynamoDB/S3 retention cleanup in MVP
- Product Image max 5 MiB
- Payment Slip max 10 MiB
- JPEG/PNG/WebP upload MIME set
- no project-created SQS DLQ in MVP
- deployment tooling bootstraps one S3 artifact bucket for `aws cloudformation package`

Production-grade HTTPS frontend architecture and any new AWS service remain outside the Learner Lab baseline rather than unresolved implementation choices.
