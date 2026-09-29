# UniStore Hub — Deployment Specification

> Subsystem: Deployment / Tooling
> Primary implementation ownership: scripts/**
> Shared root integration: package.json
> Target: AWS Academy Learner Lab
> Region: us-east-1
> Stack: unistore-hub-dev
> Primary goal: npm run deploy
> Read first: SPEC.md, AGENTS.md, docs/architecture/AWS_ARCHITECTURE.md, docs/specs/infrastructure/SPEC.md

---

## 1. Purpose

This document defines the one-command deployment contract for the Learner Lab version of UniStore Hub.

The deployment workflow must connect four separately owned outputs:

~~~text
backend/**
infrastructure/**
frontend/**
scripts/**
~~~

without requiring application code to know physical AWS resource names.

The deployment workflow consumes CloudFormation outputs and injects only the configuration each subsystem needs.

---

## 2. Source-Defined Deployment Goal

Canonical goal:

~~~bash
npm run deploy
~~~

Required high-level flow:

~~~text
1. Validate AWS identity / region
2. Install backend dependencies
3. Package Backend + Worker
4. Deploy CloudFormation
5. Read Stack Outputs
6. Set Frontend API URL
7. Build Next.js Static Export
8. aws s3 sync frontend/out → Frontend Bucket
9. Call GET /health
10. Print Frontend URL + API URL
~~~

CloudFormation commands used by the source:

~~~bash
aws cloudformation package
aws cloudformation deploy
~~~

Baseline:

~~~text
Region: us-east-1
Stack: unistore-hub-dev
IAM runtime: LabRole
~~~

---

## 3. Deployment Ownership

Deployment / Tooling Agent owns:

~~~text
scripts/**
~~~

Expected scripts:

~~~text
scripts/
├── build-backend.sh
├── deploy-infra.sh
├── deploy-frontend.sh
├── deploy-all.sh
└── destroy.sh
~~~

Root package.json is a shared Integration-owned file.

PROJECT DECISION:

The root package.json exposes stable orchestration aliases:

~~~json
{
  "scripts": {
    "deploy": "bash scripts/deploy-all.sh",
    "deploy:infra": "bash scripts/deploy-infra.sh",
    "deploy:frontend": "bash scripts/deploy-frontend.sh",
    "destroy": "bash scripts/destroy.sh"
  }
}
~~~

Subsystem agents must not redefine these command names independently.

---

## 4. Prerequisites

The deployment command must validate:

- AWS CLI is installed
- Node.js is installed
- npm is installed
- AWS credentials/session are valid
- AWS account identity is readable
- active region resolves to or is explicitly set to us-east-1
- infrastructure/template.yaml exists
- frontend/package.json and frontend/package-lock.json exist
- backend/package.json and backend/package-lock.json exist
- required secret input for JWT is available

Useful validation commands:

~~~bash
aws sts get-caller-identity
aws configure get region
~~~

Do not continue a deployment against the wrong region silently.

---

## 5. Environment Inputs

Required deployment inputs:

~~~text
AWS_REGION=us-east-1
STACK_NAME=unistore-hub-dev
JWT_SECRET=<not committed>
JWT_EXPIRES_IN=1d
STAGE_NAME=dev
~~~

PROJECT DECISION:

Deployment scripts may provide safe defaults for:

~~~text
AWS_REGION=us-east-1
STACK_NAME=unistore-hub-dev
JWT_EXPIRES_IN=1d
STAGE_NAME=dev
~~~

They must not provide a production/demo default for JWT_SECRET.

If JWT_SECRET is missing, deployment stops before CloudFormation deploy.

---

## 6. Secret Handling

JWT_SECRET rules:

- must not be committed
- must not be written to frontend environment files
- must not be printed in shell output
- must be passed to CloudFormation as a NoEcho parameter
- must not be included in generated public artifacts

PROJECT DECISION:

For Learner Lab, the deployment command reads JWT_SECRET from the invoking shell environment.

No Secrets Manager/SSM dependency is added to the baseline.

---

## 7. Backend Build Contract

build-backend.sh prepares deployable code for:

~~~text
BackendFunction
WorkerFunction
~~~

The source requires packaging Backend + Worker.

PROJECT DECISION:

Both Lambda entries may be packaged from the same backend application artifact if infrastructure handlers point to different entry files.

Expected handler contracts:

~~~text
Backend: src/lambda.handler
Worker:  src/worker.handler
~~~

Canonical Backend command contract:

```bash
cd backend
npm ci
npm test
npm run check
```

Then `scripts/build-backend.sh` assembles Backend source + production/runtime dependencies for both Lambda handlers.

Build rules:

- install dependencies from the committed lockfile with `npm ci`
- run `npm test`
- run `npm run check`
- generate the canonical artifact at `backend/.build/lambda/`
- include both `src/lambda.js` and `src/worker.js` plus required runtime source/dependencies
- do not include .env files
- do not include frontend dependencies

Both Lambda resources reference this same pre-package artifact and select different handlers.

`backend/.build/**` is Git-ignored.

---

## 8. CloudFormation Package

deploy-infra.sh must run an equivalent of:

~~~bash
aws cloudformation package   --template-file infrastructure/template.yaml   --s3-bucket <packaging-bucket-if-required>   --output-template-file <packaged-template>   --region us-east-1
~~~

### 8.1 Packaging Bucket

**PROJECT DECISION — resolves deployment blocker**

The deployment script bootstraps one tooling-only S3 bucket for `aws cloudformation package`.

Canonical name:

```text
unistore-hub-cfn-artifacts-{accountId}-us-east-1
```

Flow:

1. read account ID from `aws sts get-caller-identity`
2. derive the bucket name
3. check whether the bucket exists and is accessible
4. if missing, create it with AWS CLI in `us-east-1` (omit `LocationConstraint` for `us-east-1`)
5. enable/verify S3 Public Access Block
6. use it as `--s3-bucket` for `aws cloudformation package`

This bucket:

- uses the already-approved S3 service
- is deployment tooling, not an application runtime component
- is not exposed to Frontend/Backend
- is not part of the application CloudFormation stack outputs
- must never be public

If Learner Lab permissions prevent bucket creation, deployment stops with a clear prerequisite error rather than silently changing architecture.

---

## 9. CloudFormation Deploy

Canonical deployment:

~~~bash
aws cloudformation deploy   --template-file <packaged-template>   --stack-name unistore-hub-dev   --region us-east-1   --parameter-overrides     StageName=dev     JWTSecret=<secret>     JWTExpiresIn=1d
~~~

PROJECT DECISION:

Deployment should use:

~~~text
--no-fail-on-empty-changeset
~~~

so rerunning an unchanged stack does not fail the entire workflow.

Do not add CAPABILITY_NAMED_IAM merely by habit.

The baseline template does not create a custom IAM role.

---

## 10. CloudFormation Failure Handling

If CloudFormation package/deploy fails:

- stop immediately
- do not attempt frontend upload
- print the stack name and region
- preserve enough command output for diagnosis
- never print JWT_SECRET
- do not automatically delete the failed stack unless explicitly requested

Deployment should fail fast rather than leave Frontend pointing at an unknown API state.

---

## 11. Required Stack Outputs

Deployment must read:

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

Infrastructure Spec owns the exact output names.

Deployment must not infer physical resource names.

PROJECT DECISION:

Use AWS CLI stack query rather than parsing human-formatted output.

Example intent:

~~~bash
aws cloudformation describe-stacks
~~~

and map output keys deterministically.

---

## 12. Frontend API Configuration

Infrastructure output:

~~~text
ApiBaseURL
~~~

Frontend build value:

~~~text
NEXT_PUBLIC_API_BASE_URL=<ApiBaseURL>/api/v1
~~~

Health endpoint:

~~~text
<ApiBaseURL>/health
~~~

Do not construct:

~~~text
<ApiBaseURL>/api/v1/health
~~~

because /health is outside /api/v1 in the API contract.

---

## 13. Frontend Build Contract

deploy-frontend.sh must:

1. receive/read ApiBaseURL
2. set NEXT_PUBLIC_API_BASE_URL
3. run `npm ci` in `frontend/`
4. run `npm test`
5. run `npm run build`
6. verify `frontend/out` exists
7. sync `frontend/out` to FrontendBucketName

Static Export is required.

The Frontend package contract is therefore:

```bash
npm ci
npm test
npm run build
```

and `npm run build` must produce `frontend/out`.

The build must not require live database entity IDs.

---

## 14. Frontend Upload

Canonical upload:

~~~bash
aws s3 sync frontend/out s3://<FrontendBucketName> --delete --region us-east-1
~~~

PROJECT DECISION:

Use --delete so removed static assets do not remain indefinitely in the demo bucket.

This command applies only to the Frontend bucket.

Never sync frontend/out into FilesBucket.

---

## 15. Deployment Health Check

After infrastructure deployment and frontend sync:

~~~text
GET <ApiBaseURL>/health
~~~

must return the documented healthy response.

PROJECT DECISION:

Health check must have a bounded timeout and fail the deployment verification step if:

- connection fails
- response is non-2xx
- documented response shape is not healthy

The script should not destroy the stack automatically after health failure.

---

## 16. Final Deployment Output

Successful deployment prints at least:

~~~text
Stack Name
Region
Frontend URL
API Base URL
Health URL
~~~

May also print non-secret operational identifiers:

~~~text
BackendFunctionName
WorkerFunctionName
AppTableName
FilesBucketName
NotificationQueueURL
~~~

Never print JWT_SECRET.

---

## 17. deploy-all.sh Sequence

PROJECT DECISION:

Canonical orchestration:

~~~text
validate prerequisites
→ validate AWS identity
→ validate region
→ validate secret inputs
→ build/test Backend
→ package CloudFormation
→ deploy stack
→ read outputs
→ build/test Frontend with deployed API URL
→ sync frontend/out
→ health check
→ print deployment summary
~~~

Do not run Frontend build before ApiBaseURL is known unless the frontend build system supports a deterministic post-build injection mechanism defined by the Frontend contract.

---

## 18. Idempotent Redeployment

Rerunning npm run deploy should be safe for the Learner Lab development stack.

Expected behavior:

- CloudFormation updates existing stack
- unchanged stack is accepted
- frontend assets are resynced
- health check runs again

Deployment must not reset DynamoDB data or delete Files bucket content during a normal redeploy.

---

## 19. Seed Platform Admin

Source target repository includes:

~~~text
backend/scripts/seed-platform-admin.js
~~~

PROJECT DECISION:

Platform Admin seeding is a separate explicit action and is not automatically run on every deploy.

Canonical root command:

```bash
npm run seed:platform-admin
```

Integration-owned root `package.json` delegates this to the Backend seed script:

```text
backend/scripts/seed-platform-admin.js
```

The seed sets the target User's `platformRole = PLATFORM_ADMIN`.

Required seed environment:

```text
PLATFORM_ADMIN_EMAIL
PLATFORM_ADMIN_PASSWORD
PLATFORM_ADMIN_NAME
```

These values are separate from `npm run deploy`; deployment never prints or embeds the seed password.

Reason:

- avoids overwriting existing admin state
- keeps deploy idempotent
- separates infrastructure from application seed behavior

---

## 20. Destroy Workflow

destroy.sh is allowed for the Learner Lab development stack.

Expected sequence:

~~~text
validate target stack/region
→ require explicit confirmation unless CI/noninteractive flag is intentionally provided
→ empty FrontendBucket
→ empty FilesBucket
→ delete CloudFormation stack
→ wait for deletion
→ empty the derived tooling-only CloudFormation artifact bucket
→ delete that artifact bucket
→ print result
~~~

PROJECT DECISION:

DynamoDB AppTable may be deleted with the development stack.

This is a dev/demo lifecycle rule, not a production retention policy.

---

## 21. Destroy Safety

destroy.sh must:

- target unistore-hub-dev by default
- show account/region/stack before destructive action
- avoid wildcard bucket deletion
- use exact application bucket names from stack outputs
- derive the tooling artifact bucket only from verified account ID + us-east-1
- stop if outputs/account/stack identity cannot be verified
- never target unrelated S3 buckets

---

## 22. CloudFormation Validation

Before package/deploy, run an equivalent validation step where practical:

~~~bash
aws cloudformation validate-template   --template-body file://infrastructure/template.yaml   --region us-east-1
~~~

If package syntax requires a transformed template path, validation order may be adjusted but must remain documented.

---

## 23. Git / Artifact Rules

Do not commit generated deployment artifacts such as:

~~~text
packaged templates generated from a local build
backend build bundles
frontend/out
temporary output JSON
.env files
secret files
~~~

Source-controlled files remain:

~~~text
frontend source
backend source
infrastructure/template.yaml
infrastructure/parameters.example.json
scripts/*
docs/*
root package.json
README.md
.gitignore
~~~

---

## 24. No Architecture Drift

Deployment scripts must not create alternative infrastructure outside CloudFormation merely for convenience.

Forbidden examples:

- create Cognito from shell
- create SES resources from shell
- create CloudFront distribution from shell
- launch EC2/RDS
- create custom Lambda IAM role

The tooling-only `unistore-hub-cfn-artifacts-{accountId}-us-east-1` bucket is the explicit exception: it exists only for `aws cloudformation package`, remains private, and is not application runtime architecture.

---

## 25. Learner Lab Session Caveat

AWS Academy Learner Lab credentials are temporary.

Deployment must expect that credentials can expire between sessions.

If aws sts get-caller-identity fails:

- stop
- tell operator to refresh/restart Learner Lab credentials
- do not misdiagnose the failure as an application bug

No credentials are stored in the repository.

---

## 26. Deployment Smoke Contract

A successful script-level smoke check verifies:

- stack exists in us-east-1
- expected outputs exist
- FrontendBucket exists
- FrontendWebsiteURL is non-empty
- ApiBaseURL is non-empty
- GET /health succeeds

Deeper business E2E belongs to Testing Spec.

---

## 27. Deployment Acceptance Criteria

- [ ] npm run deploy is the stable top-level deployment command
- [ ] AWS identity is validated before changes
- [ ] region is us-east-1
- [ ] stack is unistore-hub-dev
- [ ] missing JWT_SECRET stops before deployment
- [ ] Backend/Worker artifacts are prepared
- [ ] tooling-only CloudFormation artifact bucket is derived from account ID and kept private
- [ ] aws cloudformation package is used
- [ ] aws cloudformation deploy is used
- [ ] stack outputs are read by key, not guessed
- [ ] NEXT_PUBLIC_API_BASE_URL is derived from ApiBaseURL + /api/v1
- [ ] Next.js static export produces frontend/out
- [ ] frontend/out is synced only to FrontendBucketName
- [ ] GET <ApiBaseURL>/health is checked
- [ ] Frontend URL and API URL are printed
- [ ] rerunning deployment is safe
- [ ] normal redeploy does not reset DynamoDB/files
- [ ] destroy targets only verified stack resources
- [ ] no secrets are printed or committed
- [ ] no CloudFront/Cognito/SES dependency is added
- [ ] deployment scripts do not become an alternate IaC system

---

## 28. Deployment Decision Closure

The MVP deployment blockers are resolved as explicit PROJECT DECISIONs:

- CloudFormation package artifact bucket → tooling-only S3 bucket `unistore-hub-cfn-artifacts-{accountId}-us-east-1`
- dependency installation → `npm ci`
- Backend verification → `npm test` + `npm run check`
- Frontend verification/build → `npm test` + `npm run build`
- Platform Admin seed → `npm run seed:platform-admin`

CI/CD automation remains outside the source/MVP scope rather than an implementation blocker.
