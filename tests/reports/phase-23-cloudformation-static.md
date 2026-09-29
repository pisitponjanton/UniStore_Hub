# Phase 23 — CloudFormation Static Verification

## Contract basis

The canonical Infrastructure source requires one CloudFormation template for the Learner Lab baseline.

Required primary resources:

- FrontendBucket
- FrontendBucketPolicy
- FilesBucket
- AppTable
- NotificationQueue
- BackendFunction
- WorkerFunction
- NotificationEventSourceMapping
- ApiGatewayRestApi
- ApiGatewayDeployment
- ApiGatewayStage
- BackendInvokePermission
- BackendLogGroup
- WorkerLogGroup
- ApiAccessLogGroup

Required static properties include:

- AppTable `PAY_PER_REQUEST`
- DynamoDB `PK/SK` plus `GSI1PK/GSI1SK` on `GSI1`
- FilesBucket private with full Public Access Block
- FilesBucket SSE-S3 / AES256
- FilesBucket CORS `GET/PUT/HEAD`
- Frontend bucket static website + public `s3:GetObject` only
- Backend/Worker use existing `LabRole`
- no custom IAM execution role/user/group
- no Lambda `Environment.Variables.AWS_REGION`
- one Standard SQS queue with normal redelivery/no project DLQ
- SQS EventSourceMapping → Worker with `ReportBatchItemFailures`
- Backend/Worker/API access log retention = 7 days
- API Gateway Lambda proxy wiring and invoke permission
- no CloudFront/Cognito/SES
- no EC2/RDS/NAT/ALB/ECS/EKS
- no AWS Budgets CloudFormation resource in this MVP
- JWTSecret is `NoEcho` and has no committed default
- documented stack outputs remain available

## Test IDs

`infrastructure/cloudformation-static.test.mjs` defines:

- INFRA-CFN-001 — required resource inventory/types
- INFRA-CFN-002 — DynamoDB billing/key/GSI contract
- INFRA-CFN-003 — private Files bucket/encryption/CORS
- INFRA-CFN-004 — Frontend website/public-read-only policy
- INFRA-CFN-005 — LabRole and no custom IAM role/user/group
- INFRA-CFN-006 — reserved `AWS_REGION` not injected
- INFRA-CFN-007 — SQS/Worker mapping and redelivery baseline
- INFRA-CFN-008 — 7-day CloudWatch log retention
- INFRA-CFN-009 — API Gateway/Lambda proxy wiring
- INFRA-CFN-010 — forbidden service absence
- INFRA-CFN-011 — JWT parameter/output contract
- INFRA-CFN-012 — canonical Infrastructure validator execution

The cross-system tests independently inspect the template source, while INFRA-CFN-012 also runs the Infrastructure-owned validator as an additional consistency check.

## Latest execution

Command:

```bash
node --test infrastructure/cloudformation-static.test.mjs
```

Result:

- INFRA-CFN-001 — PASS
- INFRA-CFN-002 — PASS
- INFRA-CFN-003 — PASS
- INFRA-CFN-004 — PASS
- INFRA-CFN-005 — PASS
- INFRA-CFN-006 — PASS
- INFRA-CFN-007 — PASS
- INFRA-CFN-008 — PASS
- INFRA-CFN-009 — PASS
- INFRA-CFN-010 — PASS
- INFRA-CFN-011 — PASS
- INFRA-CFN-012 — PASS

Focused summary: 12 tests total — 12 pass, 0 fail, 0 todo.

The current CloudFormation template satisfies the static Learner Lab contract covered by this phase, including required resource inventory/wiring, DynamoDB billing/key shape, private Files bucket/CORS/encryption, Frontend public-read-only website policy, LabRole reuse, no reserved AWS_REGION injection, Standard SQS redelivery baseline, 7-day log retention, forbidden-service absence, and expected output/parameter constraints.

The Infrastructure-owned `validate_infrastructure.py` also returns both `YAML_PARSE=PASS` and `CONTRACT_CHECK=PASS`.
