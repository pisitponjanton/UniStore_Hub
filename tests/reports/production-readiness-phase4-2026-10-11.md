# UniStore Hub — Production Readiness Phase 4: AWS Staging, Security & Rollback (Dry Run)

- **Date:** 2026-10-11 (Asia/Bangkok)
- **Workspace:** `UniStore_Hub`
- **bdxa task:** Production Readiness & Quality Assurance — **Phase 4**
**Environment:** Read-only repository inspection, offline CloudFormation validation, loopback-only existing Docker Compose/LocalStack health. **No AWS credentials, account access, changeset, staging deploy, CloudFormation package, S3 sync or destroy was performed.**

## 1. Outcome and evidence boundaries

**PHASE 4 DRY-RUN REVIEW: COMPLETED. AWS STAGING/PRODUCTION DEPLOYMENT READINESS: BLOCKED pending items in §3.**

The checked AWS Academy Learner Lab baseline is `us-east-1`, stack `unistore-hub-dev`, existing `LabRole`, S3 static website (HTTP), API Gateway REST + Backend Lambda, one DynamoDB table, private S3 Files, SQS + Lambda Worker, CloudWatch. This **matches the documented project architecture**, not a claim that those resources exist in a live AWS account.

| Executed read-only/local validation | Result |
|---|---|
| `python3 infrastructure/validate_infrastructure.py` | **PASS**: YAML parser and template contract; **20 resources, 8 outputs** |
| `npm --prefix tests run test:infrastructure` | **19/19 PASS** (12 existing CFN checks + **7 new offline deployment readiness checks**) |
| `bash scripts/check-tooling.sh` | **50/50 PASS** (syntax, deployment handoff, outputs, health, confirmation and no direct echo of JWT) |
| `node --test tests/frontend/static-export.test.mjs` (from `tests/`) | **10/10 PASS** (direct-refresh S3 Website routing and static export artifact) |
| `docker compose -f docker-compose.dev.yml config --quiet` | **PASS** (no resolved secrets printed) |
| `bash scripts/destroy.sh --help` | **PASS**: displays safe help only, **no destroy attempted** |
| Loopback `GET /health` and LocalStack health | **HTTP 200, healthy**; not an AWS Gateway/Lambda result |
| `git diff --check` | **PASS** |
| AWS CLI / cfn-lint / SAM CLI / shellcheck on this machine | **NOT INSTALLED / NOT EXECUTED**; CloudFormation service validation and SAM simulation remain blocked |

New automated regression: `tests/infrastructure/staging-readiness.test.mjs`. It **only reads files** and runs `bash -n` and the Python offline validator. There is **no mock claiming real AWS verification** and no command invoking `deploy`, `destroy` or `aws`.

## 2. Configuration and service-by-service checklist

| Area | Verified from files/local validation | AWS-backed proof still required |
|---|---|---|
| Region / account | Scripts constrain `us-east-1`, stack `unistore-hub-dev`, stage `dev`, and require STS identity and JWT input before deploy | Confirm real Learner Lab account, expiry, session time, permissions, region and budget; **NOT TESTED** |
| Packaging | Single Lambda artifact includes `src/lambda.js` and `src/worker.js`; `npm ci --omit=dev`; build refuses `.env*` in artifact. Tooling bucket is account/region derived with Public Access Block | AWS CLI package/validate and packaging bucket policy/ownership; **NOT TESTED** |
| Frontend S3 | Next.js `output: export`; S3 Website `index.html`; anonymous read policy permits only `s3:GetObject`; `frontend/out` sync targeted to frontend bucket; query-ID direct refresh verified by static tests | Live bucket policies, account-level Public Access Block settings, website endpoint HTTP routing, content types, assets, deep links and CORS; **NOT TESTED** |
| Private Files S3 | File bucket public-access block true in all 4 flags; SSE-S3 AES256; browser GET/PUT/HEAD CORS tied to website origin; no public bucket policy | **CRITICAL:** Verify anonymous GET is denied (HTTP 403) on authorized isolated AWS S3 test object, and signed image/payment-slip URLs work. Phase 1 LocalStack 3.8.1 paradoxically returned HTTP **200** unsigned GET despite all flags; simulator **cannot prove** real AWS privacy. |
| API Gateway / Lambda | Regional REST, `ANY` Lambda proxy, explicit mock OPTIONS, bounded backend 28s timeout and Worker 30s timeout, Node.js 22.x, app's JWT/RBAC/tenant policies independently tested | CloudFormation runtime creation, API Gateway CloudWatch account role/stage logging, live `GET /health`, API CORS from actual WebsiteURL, Lambda invocation permissions and timeout behavior; **NOT TESTED** |
| IAM | No `AWS::IAM::Role/User/Group` created; both Lambdas reference pre-existing `LabRole`; invoke permission scoped to API's ARN | Check role trust, effective least-privilege posture, DynamoDB/S3/SQS/CloudWatch access and actual AWS permissions. **LabRole is account-defined and cannot be proven least-privilege from this template** |
| DynamoDB | One `PAY_PER_REQUEST` AppTable with PK/SK and GSI1; LocalStack Order/Payment/Pickup disposable round-trip passed in Phase 1 | Real table state, PITR/backups, RCU/WCU budget, migration/restoration and isolated test data retention; **NOT TESTED** |
| SQS / Worker | Standard queue, 120s visibility, no DLQ per Learner Lab baseline; Worker receives batches of 10 with `ReportBatchItemFailures`; LocalStack Integration/Security suites passed earlier | Live event-source mapping, partial retries/idempotency, age and invisibility of failed events, alerting for poison messages; **NOT TESTED** |
| Monitoring | CloudWatch API, Backend and Worker log groups have 7-day retention; API stage metrics enabled and access format omits JWT/Authorization; request IDs used in application | Actual log delivery, 4xx/5xx/error/throttle alarms, API Gateway account-role limitation, access log sanitization and cost-budget monitoring; **NOT TESTED** |
| Environment / secrets | No committed JWT default; `JWTSecret` NoEcho, `frontend/.env.example` contains only public API URL; dev JWT values restricted to local dev Compose; backend Lambda does not inject reserved AWS_REGION | Use strong distinct staging secret and temporary academy credentials from safe injection; confirm no shell history, CI logs, generated HTML or build artifacts contain tokens. **CLI argv secret exposure remains a risk** (§3). |

### Expected stack outputs

All eight output names are implemented and checked: `FrontendBucketName`, `FrontendWebsiteURL`, `FilesBucketName`, `AppTableName`, `NotificationQueueURL`, `BackendFunctionName`, `WorkerFunctionName` and `ApiBaseURL`. `NEXT_PUBLIC_API_BASE_URL` derives as `ApiBaseURL + /api/v1`. The post-deploy health endpoint derives as `ApiBaseURL + /health`.

## 3. Release-risk register (not solved by successful offline tests)

| ID | Severity / state | Grounded observation | Required before any real-user production sign-off |
|---|---|---|---|
| AWS-SEC-01 | **CRITICAL / BLOCKED** | LocalStack 3.8.1 File bucket returned unsigned GET **HTTP 200** despite all four Public Access Block flags. This is an emulator finding only, **not evidence of a public real S3 bucket**. | Authorized isolated real AWS S3 anonymous-read negative test, signed PUT/GET verification, scope-limited keys, public-access-block/policy and account-level restrictions confirmed; never use a real payment slip as the probe. |
| AWS-REL-01 | **HIGH / NOT IMPLEMENTED** | `deploy-frontend.sh` uses `aws s3 sync --delete` against a non-versioned static bucket. Frontend upload is not atomic and has no automatic restoration of prior static assets. | Maintain versioned/archived prior `frontend/out` release plus explicit rollback and verification commands; rehearse on disposable staging. Avoid treating CloudFormation rollback as Frontend rollback. |
| AWS-DATA-01 | **HIGH / NOT IMPLEMENTED** | AppTable has no CloudFormation PITR/backup configuration; Files bucket has no object versioning; neither declares `DeletionPolicy: Retain`. `destroy.sh` intentionally empties both stack buckets upon confirmation. | Define RPO/RTO and data retention; approved backup/export/restore procedure with ownership checks before destructive operations; test with disposable records and files; do not reset existing data. |
| AWS-SEC-02 | **HIGH / REVIEW REQUIRED** | Although `set +x` and CFN `NoEcho` prevent direct shell tracing/template display, `deploy-infra.sh` expands `JWTSecret=${JWT_SECRET}` in an AWS CLI process argument, potentially visible in local process listings/debug tooling. | Decide an approved secret-safe CLI invocation/injection mechanism and verify process/log exposure policy; never store JWT_SECRET in repo/parameters or print its value. |
| AWS-ARCH-01 | **HIGH / DEMO-ONLY CONSTRAINT** | The architecture uses **HTTP** S3 Website for public frontend, including pages where users log in, with HTTPS API. Page JavaScript delivered over HTTP can be modified in transit; the API's HTTPS does not fix compromised frontend delivery. | Restrict to course demo with synthetic accounts; production with actual user identities requires an approved **HTTPS frontend architecture change** (not silently adding CloudFront under Learner Lab rules). |
| AWS-IAM-01 | **MEDIUM-HIGH / BLOCKED** | Pre-created LabRole trust and effective permissions are unverified; role is shared by Backend and Worker, so least privilege cannot be asserted from IaC. | Authorized role policy review and least-privilege gap decision within academy constraints; no custom IAM role without approved architecture change. |
| AWS-OPS-01 | **MEDIUM / GAP** | CloudWatch log groups/7-day retention exist, but no alarm resources and no SQS DLQ by baseline; API Gateway account log-role prerequisite uncertain. | Document manual/allowed alerts for Lambda errors, SQS age, API 5xx and projected credits; rehearse fallback escalation and verify actual log delivery. |
| AWS-PERF-01 | **MEDIUM / OPEN** | Phase 3 local Dev Lighthouse reported 9.2s LCP; new aggregate Directory still emits complete lists and queries each Organization partition. | Measure optimized static site and real AWS latency/RCUs with approval; set acceptable scale threshold and plan indexed server-side search if growth exceeds it. |

These risks are **explicit blockers/conditions**, not test failures from the Offline CloudFormation validator. Some require shared architecture decisions that may exceed available Learner Lab services. Do not claim production-ready based on the local tests.

## 4. Safe next-step staging verification procedure (NOT EXECUTED)

**Preconditions:** Explicit owner permission to use a disposable Learner Lab session, confirmed account ID, `us-east-1`, stack `unistore-hub-dev`, valid/approved `LabRole`, credits reviewed and no real-user records. Prepare secure distinct JWT secret without pasting it into chat/commits/logs. Confirm all changesets/resources with an owner **before** real deployment.

1. Read-only account discovery: use `aws sts get-caller-identity` and `aws configure get region` **only after approval**; compare account/region against allowlist without posting personal identifiers.
2. Optional service-backed template check: `aws cloudformation validate-template` using an explicitly reviewed packaged template and role; local `Code: ../backend/.build/lambda/` is a packaging placeholder and the real Lambda artifact must be prepared.
3. Capture a safe manifest of present stack resources, prior `frontend/out` release, actual frontend/Files bucket policy and Object Ownership, DynamoDB backup settings, SQS mapping, Lambda role and CloudWatch log access. Securely store **sanitized** results.
4. Verify independent no-secret build, intended `LabRole` permissions, account-level S3 public-access settings, HTTP Website direct routing, HTTPS API health and CORS preflight, runtime logs and worker delivery. Deploy only when separately authorized; this Phase 4 performed no such operation.
5. For private S3, create a *unique synthetic test object in an isolated owned bucket*, verify signed PUT and GET, prove anonymous GET denied; delete only the new test key. Never test with an existing customer slip.
6. Restore/rollback rehearsal must be separately authorized. Confirm CloudFormation rollback and correct `frontend/out` version restoration, plus DynamoDB/Persistent Files recovery. Record ownership, rollback triggers, elapsed time and data-loss window (RTO/RPO). `npm run destroy` is **not a rollback mechanism**.
7. Recheck health, core Customer/Staff/Tenant-security journey, CloudWatch log delivery, SQS queue age and budget; decide **GO/NO-GO** with user/owner sign-off. Never run `npm run deploy` or `npm run destroy` automatically.

**Strict exclusions:** No automatic `aws cloudformation deploy`, `aws s3 sync --delete`, `aws s3 rm`, `aws cloudformation delete-stack`, real AWS STS invocation, platform-admin seeding, E2E credentials disclosure or database cleanup as part of Phase 4. The existing LabRole and no-CloudFront/Cognito/SES baseline remain authoritative.

## 5. Handoff

- **Current result:** Offline contract/tooling/static/health checks pass, but **AWS-backed identity, S3 private-file enforcement, IAM, actual logging, CloudWatch alerts, backup/rollback and production Web Vitals remain unverified or incomplete**.
- **Phase 4 scope disposition:** Completed with evidence and explicit unresolved blockers; **not an approval to deploy**.
- **Next bdxa Workspace Plan phase:** Phase 5 `review_diff`; reconcile Phase 1–4 reports and pending file scope, secrets, end-to-end test TODOs, plus conditional release recommendation. No Commit/Push/Deploy.
