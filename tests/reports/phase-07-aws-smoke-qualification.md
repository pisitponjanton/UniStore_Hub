# Phase 7 — AWS Smoke Qualification

## Goal

Run the live AWS-001..AWS-009 Learner Lab qualification when the AWS environment is available. If the required live environment is unavailable, preserve the checks as BLOCKED rather than replacing them with static assertions.

## Runtime baseline

Qualification command ran under:

```text
Node v24.2.0
```

which satisfies the project `>=22` requirement.

## AWS prerequisite discovery

The Testing Agent environment currently does not have a usable AWS CLI.

Observed:

```text
command -v aws
→ no result

aws --version
→ command not found
```

Common executable locations were also checked:

```text
/opt/homebrew/bin/aws
/usr/local/bin/aws
/usr/bin/aws
```

No executable was found.

No AWS credential/profile inputs were present in the current Testing Agent environment:

```text
AWS_ACCESS_KEY_ID=unset
AWS_SECRET_ACCESS_KEY=unset
AWS_SESSION_TOKEN=unset
AWS_PROFILE=unset
AWS_DEFAULT_PROFILE=unset
AWS_REGION=unset
AWS_DEFAULT_REGION=unset
```

Local AWS config files were also absent:

```text
~/.aws/credentials = absent
~/.aws/config      = absent
```

No credential values were printed or persisted by Testing.

## Live AWS smoke result

Executed:

```text
node --test smoke/aws-deployment.test.mjs
```

Result:

```text
9 tests
0 pass
0 fail
9 todo/blocked
```

All nine checks remained blocked for the same prerequisite reason:

```text
AWS CLI is not installed/available on the Testing Agent machine
```

Blocked checks:

- AWS-001 — Learner Lab identity + `unistore-hub-dev` deployment in `us-east-1`
- AWS-002 — required CloudFormation outputs
- AWS-003 — deployed static Frontend availability
- AWS-004 — deployed API health
- AWS-005 — deployed DynamoDB key/GSI/billing configuration
- AWS-006 — private Files bucket public-access posture
- AWS-007 — SQS → Worker Lambda event-source mapping
- AWS-008 — Backend/Worker CloudWatch log evidence
- AWS-009 — deployed Learner Lab baseline service-family guard

These were **not** marked PASS.

## Static infrastructure compatibility

Executed separately:

```text
npm run test:infrastructure
```

Result:

```text
12 tests
12 pass
0 fail
0 todo
```

This confirms the current Infrastructure static/template checks are executable on the Node 22+ baseline, but this result is **not a substitute** for AWS-001..AWS-009 live deployment qualification.

## Live qualification behavior review

`smoke/aws-deployment.test.mjs` still performs live checks when prerequisites exist.

The suite requires real AWS CLI calls for:

- STS caller identity
- CloudFormation stack discovery
- DynamoDB table inspection
- S3 public access inspection
- SQS queue ARN resolution
- Lambda event-source mapping
- Lambda invocation
- CloudWatch log stream inspection
- deployed resource-family inspection

It also performs real HTTP requests to the deployed Frontend and API health endpoint.

Therefore the current blocked result preserves the project requirement that AWS smoke remain a **live qualification**, not a template-only test.

## Prerequisites required for a future live rerun

Testing needs all of the following before AWS-001..AWS-009 can produce PASS/FAIL evidence:

```text
1. AWS CLI installed and available on PATH
2. active AWS Academy Learner Lab credentials/session
3. region us-east-1
4. deployed CloudFormation stack: unistore-hub-dev
5. permission to read stack/resources/logs and invoke the Worker test payload
```

The test suite defaults to:

```text
TEST_AWS_REGION=us-east-1
TEST_AWS_STACK_NAME=unistore-hub-dev
```

unless explicitly overridden.

## Phase outcome

Phase 7 qualification is complete as an environment-blocked qualification:

```text
AWS live smoke:       0 PASS / 0 FAIL / 9 BLOCKED
Infrastructure static: 12 PASS / 0 FAIL / 0 TODO
```

No AWS check was weakened, mocked, converted to a static substitute, or falsely marked PASS.

The current blocker belongs to the execution environment / Learner Lab access prerequisites, not to a demonstrated AWS deployment defect.
