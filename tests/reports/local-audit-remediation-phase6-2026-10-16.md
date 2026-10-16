# UniStore Hub — Local Audit Remediation Phase 6: Offline AWS Readiness Hardening

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace plan:** UniStore Hub — Local Audit Remediation & AWS Handoff / Phase 6
- **Status:** **COMPLETED — OFFLINE preparation only**. Real AWS deployment, recovery, security validation, cost/IAM proof and production certification remain **NOT RUN / NO-GO**.
- **Environment:** BDXA Mac workspace `UniStore_Hub`; disposable local filesystem/mock AWS CLI test fixtures. The actual `aws` CLI command was **NOT INSTALLED** on the host during this Phase.
- **Safety boundary:** No real AWS CLI call, AWS credentials/session, CloudFormation create/update/delete, S3 sync, IAM modification, data backup/restore, Docker reset, Git Commit or Push was performed. All old user changes from Phases 1–5 and `WEB_QUALITY_AUDIT.md` preserved.

## 1. Canonical baseline and source decisions

Consulted `SPEC.md`, `AGENTS.md`, `scripts/AGENT.md`, `docs/architecture/AWS_ARCHITECTURE.md`, `docs/specs/infrastructure/SPEC.md`, `docs/deployment/DEPLOYMENT_SPEC.md`, `infrastructure/template.yaml`, `scripts/lib/common.sh` and `scripts/lib/stack-outputs.sh`.

Preserved **region `us-east-1`**, stack `unistore-hub-dev`, stage `dev`, existing `LabRole`, `aws cloudformation package/deploy`, static Next.js S3 Website hosted on **HTTP** for Learner Lab Demo, eight required stack outputs, Lambda/SQS/DynamoDB/CloudWatch topology, `JWTSecret` NoEcho parameter and canonical Frontend `aws s3 sync --delete`. **No** CloudFront, Cognito, Secrets Manager/SSM, custom IAM role, IAM modification, CloudFormation template modification, backup service or unrelated AWS resource was introduced.

AWS CLI **v2** officially supports CloudFormation deploy parameter overrides through a `file://` JSON file; reference: `https://docs.aws.amazon.com/cli/latest/reference/cloudformation/deploy.html`. Local mock acceptance of this syntax does **not** prove behavior with an installed/live AWS CLI version.

## 2. Secret exposure remediation (local scripts)

Original `scripts/deploy-infra.sh` expanded `JWT_SECRET` directly into the process argument `JWTSecret=<value>` even though `set +x` hid shell tracing. This could disclose values to process-argument inspection.

**Change:** `scripts/deploy-infra.sh` now:
1. Creates a randomly named temporary directory with restrictive `umask 077`.
2. Uses built-in Node.js JSON.stringify to write a **mode 0600** CloudFormation parameter file inside that private directory, preserving special characters in JWT values.
3. Passes `--parameter-overrides file://<private-json-path>` to AWS CLI; the JWT plaintext is not present in AWS CLI argv. Uses `env -u JWT_SECRET` for the CloudFormation **deploy child** so that particular AWS CLI process does not inherit JWT_SECRET as an environment variable.
4. Retains the existing `trap cleanup EXIT` to delete the temporary directory on success or failure; does not log the secret or change the real application's JWT contract.
5. Keeps NoEcho and the documented environment-based secret supply: no AWS Secrets Manager/SSM dependency introduced.

**Limitations:** Initial invoking shell and Node parameter writer still receive the secret via environment as specified by the project contract. A privileged same-host observer or Lambda configuration API may access secrets despite NoEcho; actual policy/process protection and rotation need a live approved AWS assessment.

**Evidence:** Mock AWS CLI **success** and **forced CloudFormation failure** both verify mode 600, parameter content and path-only argv; temporary directory absent after exit; no synthetic secret in logs or captured CLI argv. No actual AWS CLI was installed/executed.

## 3. Frontend static release snapshot and rollback preparation

Original `scripts/deploy-frontend.sh` ran `aws s3 sync frontend/out s3://FrontendBucketName --delete`, which is non-atomic and without recovery artifacts could remove previous static files without a rollback source.

**Changes:**
- `scripts/deploy-frontend.sh` now reads the current S3 Website into a **private local snapshot** before invoking the unchanged canonical `--delete` upload. A failed snapshot stops the upload rather than risking an unbacked write.
- Snapshot location `scripts/.releases/frontend.<random>/`, with `previous/`, `previous-manifest.json`, `candidate-manifest.json`, `frontend-bucket.txt` and `stack-name.txt`. Root has private umask and is excluded from Git through `scripts/.gitignore`.
- `scripts/lib/frontend-release-manifest.cjs` computes/checks sorted relative file paths, byte size and **SHA-256** for previous/candidate files; rejects symlinks, unsupported entries and self-inclusion.
- `scripts/FRONTEND_RECOVERY.md` documents offline SHA verification and a **separately approved** manual, real-AWS recovery rehearsal. It does **not** contain an automatic live rollback command.

**Mock acceptance:** previous release copied before upload; manifests verify; tampered snapshot is detected; failure copying old bucket prevents upload. A **filesystem-only** rehearsal reconstructs the old release under a separate disposable destination and passes hash verification.

**Important residual risk:** private snapshots live only on the operator machine, not a durable remote backup; no S3 Versioning or immutable archive was added. Initial empty buckets have no previous release. A partially completed real S3 sync, concurrent upload, expired Lab session, wrong target bucket, interrupted machine, and actual recovery RTO remain **NOT PROVEN**. In particular, snapshot safety is not a substitute for checking exact CloudFormation outputs and separately approving any future `s3 sync --delete` rollback.

## 4. AWS data recovery decisions captured without changing infrastructure

Created `tests/reports/aws-data-recovery-runbook.md`:
- `AppTable`: DynamoDB PAY_PER_REQUEST with GSI1 but **PITR not configured** in source.
- `FilesBucket`: private S3 AES256 with defined Public Access Block, but **Versioning not configured**.
- Bucket/table deletion retention protections are **not defined** in the baseline template.
- All application data restore steps must use **isolated, traceably owned synthetic** resources after explicit authorization; never restore over the existing `AppTable` or user-owned File keys during rehearsal.
- **RPO, RTO, retention, IAM capability and budget are open owner decisions.** No silent versioning/PITR/Retain template edits, and `npm run destroy` is not a recovery mechanism.

Appended a dated offline evidence ledger to `tests/reports/aws-live-validation-checklist.md`. All **AWS-001…AWS-009**, AWS-SEC/REL/DATA/OPS/E2E/PERF live gates remain `NOT RUN`.

## 5. Real locally executed offline checks

| Check | Observed result |
|---|---|
| `node --test scripts/tests/deployment-hardening.test.cjs` | **6/6 PASS**, 0 fail — fake AWS CLI only, including malicious/special JWT fixture, cleanup failure path, snapshot and local restore |
| `bash -n scripts/deploy-infra.sh scripts/deploy-frontend.sh` | **PASS** |
| `bash scripts/check-tooling.sh` | **50/50 PASS** |
| `cd tests && npm run test:infrastructure` | **19/19 PASS**, static/template semantic validation |
| `cd tests && npm run test:contract` | **196 PASS / 2 TODO**, 0 fail (do not mark TODOs passed) |
| `cd tests && npm run test:security` | **16/16 PASS** |
| `git diff --check` | **PASS**, 0 whitespace errors |
| Actual `aws --version` command | **Unavailable/COMMAND_NOT_FOUND** — live CLI syntax/network/role/permissions **NOT TESTED** |

Source changes confined to `scripts/deploy-infra.sh`, `scripts/deploy-frontend.sh`, new `scripts/lib/frontend-release-manifest.cjs`, new `scripts/tests/deployment-hardening.test.cjs`, new `scripts/.gitignore`, new `scripts/FRONTEND_RECOVERY.md` and two owned Cross-system Test reports/updates: this document, `tests/reports/aws-data-recovery-runbook.md`, `tests/reports/aws-live-validation-checklist.md`. No CloudFormation or application code edited in this Phase.

## 6. Remaining gates and next phase

- **AWS CLI v2 + Learner Lab:** obtain explicit permission, verify real identity/region/budget, inspect CloudFormation change set, and confirm the installed CLI supports file-based parameters and the temporary secret file has no process/log leak in practice. No real deployment here.
- **Private S3:** real unsigned download denial and authorized presigned GET/PUT validation are critical and still NOT RUN (LocalStack is not reliable for anonymous access proof).
- **Frontend rollback:** intentionally requires manual approval on a disposable staging bucket; test recovery after partial S3 sync and prove RTO without touching customer data.
- **Data:** implement or formally accept changes to backup/PITR/S3 Versioning/retention only after authorizing budget and architecture implications; rehearse isolated restores.
- **IAM, logs, SQS, HTTP frontend:** unchanged AWS-only or architecture-decision gates; a successful local mock does not make real-user production secure. The HTTP S3 Website is **DEMO ONLY**.
- **Phase 7 next:** full local E2E, unit/contract/security/deployment offline regression and append updated count/result to `WEB_QUALITY_AUDIT.md`; expected distinct-case count differs from historical 67 because Inventory was split and Phase 5 added tests.
- **Phase 8:** final source diff, application contract/security and no hidden resource side effects; no commit/push/deploy by default.

**Phase 6 offline acceptance:** **PASS for code-level preparation and mock tests; NOT CERTIFIED for live AWS/recovery.** Next phase only on separate user instruction.
