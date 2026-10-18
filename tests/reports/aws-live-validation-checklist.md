# UniStore Hub — AWS Live Validation Checklist (Deferred)

> **Status:** NOT RUN / BLOCKED — AWS account-level evidence required, **not** a report of completed AWS tests
> **Created:** 2026-10-16 (Asia/Bangkok)
> **Purpose:** Handoff for a future separately authorized test on an **isolated AWS Academy Learner Lab** environment.
> **Workspace:** `UniStore_Hub`
> **Canonical architecture:** `SPEC.md`, `docs/architecture/AWS_ARCHITECTURE.md`, `docs/deployment/DEPLOYMENT_SPEC.md`, `docs/specs/00-shared-contracts.md`
> **Prior audit evidence:** tests/reports/local-ux-audit-2026-10-16.md#record-01-local-audit-remediation-2026-10-16, tests/reports/local-ux-audit-2026-10-16.md#record-07-local-audit-remediation-2026-10-16 and tests/reports/production-readiness-2026-10-11.md#record-04-production-readiness-2026-10-11 (root audit removed by request)
> **Owners:** AWS/Infrastructure for service proof; Deployment/Tooling for rollout/rollback; Testing for evidence; Integration for contract, security and release gate

## 0. Scope and strict safety boundary

This file is a **future execution checklist**, not authority to connect to AWS, access credentials, deploy, create billable resources, change IAM/S3 policies, upload files, reset data or destroy a stack. Each state begins as `NOT RUN`; later update individual IDs to `PASS`, `FAIL` or `BLOCKED` with dated, sanitized evidence. Never turn LocalStack PASS or offline CloudFormation static PASS into real-AWS PASS.

Current project **Learner Lab baseline** from the canonical documentation:
- Target region `us-east-1`, stack `unistore-hub-dev`, stage `dev`.
- Next.js **static export** hosted by **Amazon S3 Static Website (HTTP)**; **HTTPS** API Gateway → Express.js on Lambda; application JWT authentication (not Cognito).
- DynamoDB AppTable, private S3 Files (product images/payment slips), SQS → Lambda Worker → DynamoDB Notifications, CloudWatch; effective runtime IAM supplied by existing `LabRole`.
- Architecture intentionally remains **demo-only** under documented restrictions. Do **not** silently add CloudFront, Cognito, SES, a custom IAM role, or other AWS architecture while following this checklist.
- **Real personal credentials, real payment slips, real money, real user data and production environment are not approved test fixtures.** Use only newly created and traceably owned synthetic resources.

### Entry gates (all must be recorded and approved before ANY live AWS write)

- [ ] The owner explicitly approves a **disposable** Learner Lab session, intended account/region/stack and a maximum test budget/credit spend. Stop on ambiguous account or missing permission.
- [ ] AWS CLI version and a **valid, expiring** Academy session are available locally; region/account identity match the allowlisted target. Never copy full credentials, JWT secrets or account IDs into this file or ChatGPT responses.
- [ ] Verify whether the target stack, buckets and DynamoDB table already exist; record sanitized ownership and current resource counts. Existing resources are read-only until authorized otherwise.
- [ ] Review planned CloudFormation change set and IAM role effects, service quotas, possible costs, blast radius, rollback and cleanup **before** owner approval for deployment.
- [ ] Agree a unique run marker (`aws-qa-YYYYMMDD-<random>`) and allowlist for test-owned S3 keys, DynamoDB PK/SK, Organization/User/Order records, queue messages and artifacts. Do not use a global cleanup that selects historical QA rows by name pattern alone.
- [ ] Obtain a separate explicit approval for **deploy**, test-data **writes/uploads**, load tests, IAM changes, rollback rehearsal and any destructive cleanup; each needs its own bounded scope.
- [ ] Identify operational exit criteria: maximum cost, duration, rate, error threshold and emergency stop method; no benchmark traffic without approved limits.
- [ ] Pre-agree where to store redacted test evidence, never log access tokens, presigned URLs with query signatures, sensitive S3 object keys or live JWT values.

Useful read-only preflight **only after account access permission** (replace any identifiers using trusted local config, not source modifications):
```bash
aws sts get-caller-identity
aws configure get region
aws cloudformation describe-stacks --region us-east-1 --stack-name unistore-hub-dev
```
These can reveal identifiers; sanitize outputs before sharing. Non-existent stack is `BLOCKED / NOT DEPLOYED`, not an authorization to auto-deploy. Never run `npm run deploy`, `npm run destroy`, `aws s3 sync --delete`, cleanup, or stack updates as part of this document alone.

## 1. AWS-001 … AWS-009 — existing live smoke suite

The repository already provides `tests/smoke/aws-deployment.test.mjs` and documented `TEST_AWS_REGION=us-east-1`, `TEST_AWS_STACK_NAME=unistore-hub-dev`. The historical `tests/reports/aws-smoke-qualification.md` lists these nine checks as blocked when AWS CLI/credentials were unavailable; status below **has not changed**.

| ID | Real-AWS proof to obtain | Minimum PASS evidence (redacted) | Current status |
|---|---|---|---|
| AWS-001 | Learner Lab caller identity, region and `unistore-hub-dev` stack existence | Authorized identity match and stack in expected stable state | NOT RUN |
| AWS-002 | CloudFormation stack outputs | Eight output keys present: `FrontendBucketName`, `FrontendWebsiteURL`, `FilesBucketName`, `AppTableName`, `NotificationQueueURL`, `BackendFunctionName`, `WorkerFunctionName`, `ApiBaseURL` | NOT RUN |
| AWS-003 | Deployed Frontend static website | HTTP Website URL loads asset/index and direct-refresh deep links, no missing file/MIME/CORS failures, **demo-only** warning recorded | NOT RUN |
| AWS-004 | Live API Gateway → Backend Lambda | HTTPS `GET /health` 200 via stack API URL, documented CORS preflight from actual website Origin, normal error mapping | NOT RUN |
| AWS-005 | Real AppTable | PK/SK, GSI1, PAY_PER_REQUEST and expected table ARN/name verified; no existing data modified for read-only schema check | NOT RUN |
| AWS-006 | Private S3 Files posture | Real bucket + account-level Public Access Block, policy/object ownership and encryption inspected; run negative anonymous-object GET test described in AWS-SEC-01 | NOT RUN |
| AWS-007 | SQS → Worker Lambda mapping | Real queue ARN, live event-source mapping and enabled state, bounded single disposable notification with verified side effect **only if separately approved** | NOT RUN |
| AWS-008 | Backend/Worker CloudWatch | Fresh sanitized invocation logs, retention and permission, no credentials/presigned URLs leaked | NOT RUN |
| AWS-009 | Learner Lab service-family guard | Deployed resources match documented constrained architecture with pre-existing LabRole, no unexpected service families | NOT RUN |

**Execution handoff (do not execute until approved):**
1. From `tests/`, precheck `node --version`, `aws --version`, signed-in role, budget and deployed stack. Use `TEST_AWS_REGION` and `TEST_AWS_STACK_NAME` for the approved target.
2. Only then invoke the existing live smoke test by its documented local suite, e.g. `node --test smoke/aws-deployment.test.mjs`. Inspect its source and current guard behavior first; it may invoke Lambda test paths and must not run against another account/stack.
3. Capture individual results by AWS ID with timestamps, sanitized stack output names, error codes, relevant log request IDs and traceability to the synthetic run marker.
4. If a precondition fails, mark `BLOCKED` with reason and **do not** replace it with offline mock PASS.

## 2. Critical security and architecture release gates

### AWS-SEC-01 — Real Files S3 privacy (CRITICAL, NOT RUN)

**Why AWS-only:** Historical LocalStack 3.8.1 returned anonymous unsigned S3 GET HTTP 200 despite four Public Access Block flags; the emulator result does **not** prove that the real AWS bucket is public or private.

**Approved isolated test:** Inspect bucket/account Public Access Block, Object Ownership, bucket policy, encryption and CORS; create one uniquely owned, synthetic non-sensitive test object only after write approval. Request **anonymous unsigned GET** against that exact synthetic key and verify denied access (typically HTTP 403); separately verify authorized backend-issued presigned PUT/GET, scope and expiry. Test expired or tampered signed URLs and cross-user/tenant authorization without existing customer files. Remove only the owned synthetic key after confirming the explicit deletion authorization.

**PASS:** anonymous access denied, valid presigned flows work for authorized subject only, signed expiries enforced, no sensitive data leak. **FAIL:** unexpected anonymous readable payment-scope key, cross-user exposure, excessive presign scope, or log leakage. **BLOCKED:** no isolated test object/account rights.

### AWS-ARCH-01 — HTTP frontend vs HTTPS authenticated production use (HIGH, DECISION GATE)

Current source-defined Learner Lab S3 Website runs **HTTP** and exposes browser-executed sign-in JavaScript over an integrity-unprotected transport while the API is HTTPS. This is a known **DEMO-ONLY constraint**, not a test failure fixed by HTTPS API.

**PASS for course-demo-only handoff:** Confirm actual frontend endpoint scheme, limit to synthetic accounts, document accepted demo risk and refrain from claiming real-user production security. **Real-user Production GO requires a separately approved HTTPS frontend architecture and threat review**; not achievable simply by locally passing a test. No CloudFront or other architecture modification without explicit sign-off.

### AWS-SEC-02 — Deployment JWT secret exposure (HIGH, PREPARE LOCALLY + AWS PROCESS REVIEW)

Review `scripts/deploy-infra.sh` handling of CloudFormation `JWTSecret`; the historical audit found value expansion into AWS CLI argv even with `set +x` / `NoEcho`. Prefer a safer approved secret delivery mechanism while preserving the deployment contract; inspect shell/process exposure on an isolated host and review CLI logs/CI traces. Never write the actual secret into evidence. **PASS:** no plaintext JWT_SECRET in source files, argv/process listing, shell history, generated frontend, logs or committed artifacts. Live runtime secret-rotation capability requires authorization.

### AWS-IAM-01 — Effective LabRole permissions (MEDIUM–HIGH, NOT RUN)

Review actual role trust and effective permissions for Backend and Worker; verify required DynamoDB, S3, SQS, CloudWatch paths and identify extra privileges. IAM least-privilege claims need live effective policy evidence. Do **not** create custom IAM role or change the account role without a separate architecture and permission decision.

## 3. Reliability, deployment and data recovery gates

### AWS-REL-01 — Frontend S3 release and rollback (HIGH, NOT RUN)

Historical finding: `scripts/deploy-frontend.sh` uses `aws s3 sync --delete` to a non-versioned Website bucket; sync is non-atomic and no automatic previous asset restore is guaranteed. Before any live rehearsal, implement and locally dry-run an explicit immutable/versioned artifact manifest and restoration approach compatible with approved architecture. **AWS rehearsal (separate approval):** deploy a synthetic build to **owned disposable staging**, confirm expected content, perform controlled partial/failure simulation, restore previous known-good assets, check deep links, cache headers and time to restore. **PASS:** rollback to previous fully functional frontend within agreed RTO; no existing unrelated objects deleted. CloudFormation rollback does **not** count as restoring frontend static files. No destructive `--delete` against an existing shared bucket without separately reviewed target manifest and approval.

### AWS-DATA-01 — DynamoDB + Files backup / restore (HIGH, NOT RUN)

Historical gap: AppTable not configured for PITR/backups; private Files S3 has no object versioning; templates lacked Retain deletion controls. Decide acceptable **RPO/RTO**, retention, cost, restore ownership, snapshots/export/versioning or an approved backup alternative **before** changing infrastructure. Execute restore only onto isolated, newly owned resources; compare record/object hashes and tenant boundaries, measure recovery time/data loss window. **PASS:** documented, authorized, tested recovery for both relational entity snapshots in DynamoDB and payment/product files in S3. `npm run destroy` is destructive, **not** rollback.

### AWS-OPS-01 — SQS retries and observability (MEDIUM, NOT RUN)

Verify SQS queue, Lambda event source mapping, event shape, batch failure response, worker idempotency on safe synthetic duplicate input, retry/delivery visibility and CloudWatch log generation. The documented Learner Lab baseline has no DLQ and no alarm resources by default; record an approved manual response plan or explicitly approved monitoring enhancement. Test poison-message behavior only with controlled TTL/bounded retries and permission. Verify no personal data, JWT or presigned tokens in logs.

### AWS-OPS-02 — Real DynamoDB and Lambda operational limits (NOT RUN)

Observe AppTable throughput/RCU impacts, GSI queries, Backend Lambda cold start / timeout, API Gateway errors/CORS and request IDs under **rate-limited synthetic** traffic. Confirm alarms/budget threshold and all resource costs are within the approved Academy session. Do not load-test unknown real-user or externally shared resources.

## 4. Real deployed functional and performance acceptance

### AWS-E2E-01 — Core synthetic cross-role journey (NOT RUN)

After staging deploy **with permission to mutate only disposable data**, use synthetic Customer, Staff, Organization Admin and Platform Admin accounts (never actual user identities); verify:
- Platform approves synthetic Organization; Admin creates Store → Product/Variant → Campaign; Customer places one Order.
- Customer uploads one fake payment-slip image via presigned S3 URL; Staff rejects with reason; Customer resubmits; Staff approves; Order status and Production Summary reflect transition.
- Pickup QR/Token and Staff pickup confirmation update Order/Pickup; notification delivered via real SQS/Worker → DynamoDB; Audit records preserved.
- Negative cases: cross-tenant Staff and Customer forbidden on others' Order/Payment/Pickup, expired/tampered JWT and URLs denied.

**PASS:** authoritative API/database state matches UI for each stage, no unexpected duplicate side effects or cross-tenant leaks, every synthetic object ID is recorded for *individually approved* cleanup. No real payment transfer.

### AWS-PERF-01 — Static build, API Gateway, directory and Core Web Vitals (MEDIUM, NOT RUN)

Historical **local Next.js Dev** Lighthouse Performance 69 / LCP 9.2s is **not AWS or production evidence**; Platform Summary local API ~2.65s and Users ~4.59s (~190KB response) are similarly **local** observations. Re-measure on approved optimized static site and deployed HTTPS API, with 2G/4G and desktop synthetic throttling, screen sizes 320/390/768/1440, LCP/INP/CLS, directory search/filter, populated Users table, RCU and p95 cold/warm navigation latencies. Agree realistic budgets with the owner before PASS/FAIL; no invented universal timing threshold. Capture sanitized HAR/request-id data but no authorization headers.

### AWS-OPS-03 — Budget & account expiration (NOT RUN)

Review Academy credits/cost controls before and after every live test; confirm stack resource families match allowlist, storage logs/snapshots and unexpectedly retained assets do not accumulate. Capture anonymized cost snapshots. Stop/disable owned test resources at end according to the separately approved cleanup scope, **without destroying existing or unrelated stack data**.

## 5. Pending TODO and unverified manual release gates

The 2026-10-11 audit reports **2 Contract TODO, 12 Smoke TODO and 5 legacy Live Node E2E TODO** remaining, plus non-certification of real phones/Safari.app, actual VoiceOver/TalkBack, real AWS file privacy, frontend rollback, DynamoDB restore and HTTPS production suitability. TODOs are not automatically AWS-only: assess each on the current source before classifying as local-resolvable, contract OPEN DECISION, or genuinely cloud-blocked.

- [ ] Reconcile the specific unfinished AWS-related smoke IDs with `tests/smoke/aws-deployment.test.mjs` and `tests/reports/todo-inventory.md`; no blanket automatic PASS.
- [ ] Confirm actual deployed public browser entry, HTTPS API gateway, CORS, S3 signing and Lambda/Worker logs together; do not mark local-only smoke as AWS backed.
- [ ] Run actual mobile devices, physical keyboard and screen-reader journeys (not achieved by Chromium/Playwright WebKit emulation).
- [ ] Record architecture or security decisions requiring owner/instructor approval separately from bug fixes (HTTP→HTTPS, IAM, backup/retention, monitoring/DLQ, spending).
- [ ] Confirm production-like scaling/search/permission behavior on optimized build before stating any deployment is production ready.

## 6. Evidence worksheet (complete during a future *authorized* AWS session)

Copy one row per test ID (never overwrite historical evidence):

| Field | Required entry |
|---|---|
| Test ID / owner | e.g. AWS-006 / Testing |
| Environment | Academy Learner Lab only; redacted account ID; region; approved stack and stage |
| Approval & safe scope | Link to owner's approval, budget and named synthetic fixture marker; approval for write/destruction must be separate |
| Date/time | Timestamp (timezone) of execution |
| Prerequisites | CLI, active temporary credentials, approved resources/budget, isolation and prior snapshot |
| Action taken | Read-only checks vs explicit synthetic writes clearly differentiated |
| Expected / observed | Exact sanitized status codes, response timing, resource configuration and state transitions |
| Evidence artifact | Safe relative path to redacted logs/captures or CloudWatch request ID; no credentials/signed URLs |
| Result | PASS, FAIL, BLOCKED or NOT RUN |
| Cleanup | Exact owned keys/IDs, whether deleted with approval, and any known residual objects |
| Release decision | GO / NO-GO / DEMO-ONLY, rationale and owner/date |

### Final release gates

- **Local E2E clean green** and repeatable with safe fixture cleanup; any flaky/fail explained and addressed.
- **Real AWS security tests** and AWS-001…AWS-009 completed, not replaced by mocks.
- **Approved backup/restore + frontend rollback** and effective IAM protections verified against *real AWS*.
- **HTTPS architecture approved before actual identities**; current S3 HTTP Website stays course-demo-only.
- **Budget/owner approvals**, documented evidence and cleanup complete.

**Current release decision: NO-GO for real-user production. AWS live test status: NOT RUN.** No AWS action was executed by creating this checklist.


## 7. Phase 6 local-only hardening evidence (2026-10-16)

> **Important:** This section records offline source/test preparation. ALL real AWS entries above remain \`NOT RUN\`; no AWS CLI, Learner Lab session, CloudFormation deployment, account mutation, S3 sync or backup/restore execution was performed.

| Gate | Offline preparation and evidence | Real AWS decision |
|---|---|---|
| AWS-SEC-02 JWT deployment parameters | \`scripts/deploy-infra.sh\` now writes temporary mode-600 JSON overrides from environment, uses \`--parameter-overrides file://<path>\`, does not put JWT value in AWS CLI argv and unsets JWT_SECRET for the deploy CLI child process; trap removes the file on success/failure. Mock success/failure tests PASS in \`scripts/tests/deployment-hardening.test.cjs\`. | **NOT RUN:** install/use approved AWS CLI v2; validate real CloudFormation deploy/stack update, CLI process exposure, Lambda configuration disclosure, secret rotation and logs. No Secrets Manager/SSM introduced. |
| AWS-REL-01 website snapshot before destructive sync | \`scripts/deploy-frontend.sh\` copies the previous FrontendBucket website to private Git-ignored \`scripts/.releases/\` and writes previous/candidate SHA-256 manifests **before** the required \`s3 sync --delete\`. Mock tests verify backup ordering, tamper rejection and fail-closed behavior when backup fails. Manual runbook \`scripts/FRONTEND_RECOVERY.md\`. | **NOT RUN:** real S3 snapshot completeness, rollback of interrupted/static asset deploy, object/version handling, disk-failure resilience, atomicity and RTO. The old S3 Website still remains HTTP and is DEMO-ONLY. |
| AWS-DATA-01 application backups | \`tests/reports/aws-data-recovery-runbook.md\` documents current unprotected AppTable/FilesBucket state, isolation, approvals and measurable acceptance criteria. No PITR, S3 Versioning, Retain or new IAM resource was added. RPO/RTO, lifecycle/cost and owner remain OPEN DECISIONS. | **NOT RUN:** approved backup of DynamoDB + private S3, restore only into disposable resources, real integrity/tenant/privacy verification and recovery timing. |
| Baseline CloudFormation architecture | \`infrastructure/template.yaml\` and required Region/Stack/LabRole/8 outputs remain unchanged. Offline Infrastructure/Contract/Security/Deployment static tests are recorded in the Phase 6 audit report. | **NOT RUN:** actual IAM effective policies, real S3 PAB/anonymity, API Gateway/Lambda/SQS/CloudWatch health, CloudFormation change set and Academy credits. |

**Operator handoff:** Review \`scripts/FRONTEND_RECOVERY.md\` and \`tests/reports/aws-data-recovery-runbook.md\` together with this checklist before asking for real AWS approval. Never use the presence of local manifests as proof of tested AWS rollback. No live resource or destructive action is approved by these files.

**Release gate remains NO-GO for real-user production.**

## 8. Phase 7 full local regression — AWS status unchanged (2026-10-16)

- **Local Chromium:** 75/75 tests PASS, 0 retry, 17 spec files; this is evidence for local Browser paths, **not a live AWS smoke/production PASS**. Detailed results: tests/reports/local-ux-audit-2026-10-16.md#record-07-local-audit-remediation-2026-10-16.
- **Local supporting checks:** Backend 297/297 (isolated twice; initial concurrent attempt exited 1), Frontend 299/299, Contract 196 PASS/2 TODO, Security 16/16, Integration 36/36, Infrastructure 19/19, Static Export 33/33, Dev Smoke 12 PASS/12 TODO, Deployment Mock 6/6.
- **Separate opt-in Cross-System E2E:** 5 TODO due to missing dedicated local fixture/env prerequisites; these tests were enumerated but not run. Do not treat an opted-out TODO as PASS.
- **No live AWS access:** all AWS-001–AWS-009, AWS-SEC, AWS-REL, AWS-DATA, AWS-OPS, AWS-E2E and AWS-PERF gates remain **NOT RUN / BLOCKED**. IAM effective rights, actual anonymous S3 privacy, real Worker/SQS, backup/restore, rollback, credits and HTTPS real-user architecture require separate authorization and recorded AWS evidence.
- **Release posture:** Local browser regression PASSED; real-user production remains NO-GO / NOT CERTIFIED. The existing AWS checklist and approval entry gates still apply unchanged.

## 9. Phase 8 final offline security review — 2026-10-16

- **F8-01 Payment UI:** A committed approve/reject now follows the existing Token-invalid/expired logout path if a subsequent detail read fails due to definitive session invalidation. Ordinary readback failures do not misreport the committed mutation as a failed Payment.
- **F8-02 JWT child-process security:** `deploy-all.sh` limits JWT propagation to `deploy-infra.sh`. `deploy-infra.sh` can accept Shell-local/non-exported JWT values and uses a protected file parameter writer, while AWS CLI subprocesses do not inherit `JWT_SECRET`. `deploy-frontend.sh` never forwards unused `JWT_SECRET` to npm/Next.js/S3 sync.
- **Verified locally:** Deployment Mock **8/8 PASS** including a canonical Deploy-All subprocess Environment guard; Tooling Static **50/50 PASS**; Infrastructure **19/19 PASS**; Security **16/16 PASS**. Frontend Unit **301/301 PASS**, affected real-browser Payment flow **1/1 PASS**. Full local Browser suite was **75/75 PASS in Phase 7**, not repeated in entirety after the Phase 8 edits.
- **AWS production gates do not change:** cloud IAM/effective permissions, actual AWS CLI v2 parameter override, account/region/credits, private S3 anonymity, HTTPS for real identities, real Lambda/SQS/CloudWatch, rollback recovery, DynamoDB PITR and Files S3 backups, measured restore RTO/RPO are **NOT RUN**, and require explicit authorization.
- **Separate TODOs remain:** env-gated Cross-System E2E 5, Smoke 12, Contract 2. Any initial intermittent Backend parallelism behavior needs a controlled CI stress run before claiming arbitrary concurrency stability.

**Final local/offline Review Diff status:** PASS. **Real AWS/production release decision:** NO-GO / NOT CERTIFIED. See `tests/reports/local-ux-audit-2026-10-16.md#record-08-local-audit-remediation-2026-10-16` and prior AWS recovery runbooks. No AWS modification, Commit, Push, LocalStack reset, or historical-data cleanup has been performed.
