# Phase 24 — AWS Deployment Smoke Verification

## Source-backed scope

These checks are defined to run after deployment of:

```text
region = us-east-1
stack  = unistore-hub-dev
```

Mandatory smoke IDs:

- AWS-001 — Learner Lab identity / region / stack
- AWS-002 — all expected CloudFormation outputs exist
- AWS-003 — `FrontendWebsiteURL` serves static content
- AWS-004 — `GET <ApiBaseURL>/health` returns the canonical healthy envelope
- AWS-005 — AppTable has expected keys/GSI/billing mode
- AWS-006 — FilesBucket is not publicly readable
- AWS-007 — NotificationQueue is connected to WorkerFunction
- AWS-008 — Backend/Worker CloudWatch logs appear after invocation
- AWS-009 — no forbidden Learner Lab baseline dependency has been introduced

The test suite reads deployed stack outputs rather than assuming physical resource names.

## Execution safety

The smoke suite is read-only except for the AWS-008 Worker invocation. AWS-008 invokes the Worker with an empty SQS Records array only to create an execution/log event; it does not intentionally create or modify application business data.

If the AWS CLI, active Learner Lab credentials, or deployed `unistore-hub-dev` stack are unavailable, each AWS smoke case is explicitly marked TODO/BLOCKED rather than passed or misreported as an application failure.

## Current environment observation

Before creating this suite, the Testing Agent machine was probed with read-only AWS CLI commands. The `aws` command is currently unavailable (`command not found`), so the live Learner Lab deployment cannot be inspected from this environment yet.

## Latest execution

Command:

```bash
node --test smoke/aws-deployment.test.mjs
```

Result:

- AWS-001 — TODO/BLOCKED
- AWS-002 — TODO/BLOCKED
- AWS-003 — TODO/BLOCKED
- AWS-004 — TODO/BLOCKED
- AWS-005 — TODO/BLOCKED
- AWS-006 — TODO/BLOCKED
- AWS-007 — TODO/BLOCKED
- AWS-008 — TODO/BLOCKED
- AWS-009 — TODO/BLOCKED

Focused summary: 9 tests total — 0 pass, 0 fail, 9 todo.

Blocking reason for all nine live-deployment checks: the Testing Agent machine does not currently have the AWS CLI available. A direct prerequisite probe returned `aws: command not found`.

These are not passing AWS smoke checks. The test implementation is ready to execute against the real `unistore-hub-dev` stack once an AWS CLI plus active Learner Lab credentials are available.
