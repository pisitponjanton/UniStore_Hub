# AWS Learner Lab — Live Validation and Cleanup

**Execution date:** 2026-10-27 (Asia/Bangkok)
**Project:** UniStore Hub
**Environment:** AWS Academy Learner Lab, `us-east-1`
**Stack:** `unistore-hub-dev`
**Source baseline:** commit `474133f` plus the Learner Lab compatibility/test corrections described below
**Final environment status:** **Destroyed and independently verified absent**

## Executive result

| Verification | Observed result |
|---|---|
| CloudFormation infrastructure | `CREATE_COMPLETE` after removing API Gateway Stage access logging |
| Backend unit tests | 309/309 passed during AWS Lambda build |
| Frontend production build | Passed; static pages uploaded to S3 |
| AWS live smoke | **13/13 passed on final rerun** |
| Isolated AWS business E2E | **1/1 passed** |
| Real deployed website/browser smoke | **6/6 checks passed** (five page routes plus browser-origin API health/CORS) |
| Local infrastructure regression | 28/28 passed after corrections |
| Teardown script | Exit code **0** |
| Final resource audit | No UniStore Hub stack, S3 buckets, Lambda functions, DynamoDB tables, SQS queues, API Gateway APIs, or associated CloudWatch log groups found |

Results are from actual AWS services, **not** LocalStack. This is a course/lab validation, not a blanket production security or load-test certification.

## Execution chronology

1. **Initial deploy:** API Gateway Stage creation failed with `CloudWatch Logs role ARN must be set in account settings to enable logging`. The stack rolled back. Verified project-only cleanup completed.
2. **Second deploy:** Infrastructure and S3 static website deployed successfully. Initial AWS smoke had two test-runner mismatches (missing private S3 bucket policy incorrectly treated as a failure; AWS CloudShell cannot use `/dev/stdout` as the Lambda CLI output file). After test fixes, the smoke suite passed **13/13**. Business E2E reached payment and ready-for-pickup but asserted the **Order ID** instead of the emitted **Pickup ID** on `READY_FOR_PICKUP`. All project AWS resources were deleted and audited.
3. **Final deploy:** Infrastructure and static frontend deployed successfully. Updated business E2E passed **1/1** end-to-end. AWS smoke first reported missing Worker log stream while CloudWatch was still propagating the first invocation; the subsequent live run passed **13/13**. Browser checks were performed from a separate MacBook Chromium process against the actual S3 website/API before teardown. Mandatory cleanup returned exit code **0**, followed by independent AWS CLI inventory checks.

## Verified business flow (live AWS)

`Register` → `Login` → `Create Organization` → `Platform Approval` → `Add Staff` → `Create Store` → `Private S3 Image Upload` → `Create Product + Variant` → `Create/Open Campaign` → `Create Order` → `Private S3 Payment Slip Upload` → `Payment Approval` → `SQS / Worker Notifications` → `Ready for Pickup` → `Pickup Confirmation` → `Received Order` → `Audit Log`.

All accounts, entities, orders, and uploaded files were synthetic and disposable. The test verified the actual worker-mediated `PAYMENT_APPROVED` and `READY_FOR_PICKUP` notifications, including the correct Pickup ID linkage.

## Browser verification

The separately executed Chromium smoke visited the deployed S3 site at:

- `/`
- `/login/`
- `/register/`
- `/shops/`
- `/org/stores/view/`

Each returned HTTP **200** and produced no page JavaScript error during this check. A browser-origin fetch of API `/health` also returned HTTP **200**, confirming the tested CORS path.

**Scope limitation:** This checks page availability, client initialization, and API CORS. It is **not** an exhaustive click-through test of every role, modal, negative case, or responsive state. The AWS business journey was tested by API E2E separately.

## Changes retained in source

- Removed API Gateway Stage `AccessLogSetting`, which needs an account-level CloudWatch Logs role not configured in this Learner Lab. Backend and Worker Lambda CloudWatch Logs and Stage Metrics remain configured.
- Fixed AWS caller Account ID regex in smoke preflight.
- Correctly accept a missing *private* S3 bucket policy when all public-access-block flags are enabled.
- Use a regular CloudShell `/tmp` path for Lambda CLI invocation result instead of `/dev/stdout`.
- Add bounded retry for the eventual consistency of first Lambda CloudWatch log stream.
- Match pickup readiness notifications using `pickupId`, not `orderId`.
- Make project teardown work when CloudFormation CREATE fails before stack Outputs exist, while verifying the AWS account, fixed stack identity, expected physical S3 bucket names and explicit deletion result.

## Cleanup evidence

After the final test:

- `cloudformation describe-stacks --stack-name unistore-hub-dev` returned **Stack does not exist**.
- `s3api list-buckets`, filtered for `unistore-hub-`, returned `[]`.
- `lambda list-functions`, filtered for `unistore-hub-dev-`, returned `[]`.
- `dynamodb list-tables`, filtered for the stack name, returned `[]`.
- `sqs list-queues --queue-name-prefix unistore-hub-dev-` returned no queue URLs.
- `apigateway get-rest-apis`, filtered for the stack name, returned `[]`.
- CloudWatch log groups with prefixes `/aws/lambda/unistore-hub-dev-` and `/aws/apigateway/unistore-hub` returned `[]`.
- Lifecycle controller recorded **mandatory cleanup finished and verified**, with `cleanup.exit = 0`.

These queries were limited to **project-owned resource names**. Existing Learner Lab resources outside the project were not intentionally changed or deleted.

## Evidence storage and billing

The original terminal logs for this session were retained in the CloudShell Home Directory at `/home/cloudshell-user/unistore-aws-evidence/` (including `attempt1/`, `attempt2/`, and final logs). They are **not** committed to Git. This report records the reproducible summary without embedding credentials or private account secrets.

**AWS Learner Lab credit consumption was not measurable from the accessible CLI data.** Deployments, Lambda invocations, S3/DynamoDB requests, CloudWatch, and data transfer may consume credits. Deleting resources prevents continuing project resource usage, but does not cancel charges already incurred or guarantee instantaneous billing updates.

## Remaining limitations

The tests did not execute a complete production Browser E2E suite, destructive/negative-path matrix, performance/load test, penetration test, or AWS billing reconciliation. The S3 static site uses HTTP (Learner Lab teaching baseline, no CloudFront), so do not present this deployment pattern as production-grade HTTPS hosting. A future lab deployment will require fresh ephemeral credentials and may need to recheck learner account settings.
