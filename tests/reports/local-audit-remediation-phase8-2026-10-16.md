# UniStore Hub — Phase 8: Final Diff, Security & Reliability Review

- **Date:** 2026-10-16 (Asia/Bangkok)
- **Workspace:** `UniStore_Hub`
- **Review outcome:** **PASS for the approved local/offline remediation scope**. Real AWS and real-user production readiness: **NOT CERTIFIED / NO-GO**.
- **Changes:** All Phases 1–7 source/test/docs reviewed, plus targeted Phase 8 remediation below. No Commit, Push, live AWS command, Deployment, Compose reset, destructive LocalStack cleanup, or removal of unknown Orders.

## 1. Scope reviewed and original guardrails

Compared all tracked Git differences and new files against the master/shared/system specifications and established Phase 1–7 reports. Reviewed Backend BatchGet and platform RBAC, Payment approval/rejection state, role-aware E2E test readiness and Inventory cleanup, mobile responsive behavior, AWS Learner Lab deployment scripts, temporary JWT handling, Frontend snapshots, and AWS-only handoff.

All historical `WEB_QUALITY_AUDIT.md` Sections 1–22 remain preserved. `infrastructure/template.yaml` and the architectural Region `us-east-1`, Stack `unistore-hub-dev`, LabRole/S3 Website demo/SQS/CloudFormation outputs are unchanged. No new production service or custom IAM role was introduced.

## 2. Confirmed and corrected Phase 8 findings

### F8-01 — P2: Post-commit Payment readback could suppress required session invalidation

**Files:** `frontend/src/modules/payments/organization-payments-view.tsx` and its `*.test.tsx`.

Phase 4 correctly separated a successfully committed Payment approve/reject from a later, possibly failed refresh of Order/Payment details. However the post-commit nested `catch` handled **every** readback error as merely stale details. If the second request returned a definitive `TOKEN_INVALID`/`TOKEN_EXPIRED` error, it would not run the existing `authSession.logout()` security/session path.

**Fix:** Both approve/reject post-commit readback catch blocks now invoke `isDefinitiveSessionFailure(error)` and logout/return when appropriate. Other readback failures still preserve a truthful successful-mutation notice with guidance to reload details. Neither error branch re-submits approve/reject or rewrites the committed Backend state.

**Evidence:** Two new unit cases for Token-expired post-approval/rejection. The Payment view unit suite **10/10 PASS** and full Frontend unit suite **301/301 PASS** across 80 files. Targeted real-browser Organization Admin Order Cancellation→Payment Approval→Pickup Flow **1/1 PASS** with `--workers=1 --retries=0`, including persisted Payment `APPROVED` and Order `PAID` verification already asserted by the E2E.

### F8-02 — P2: JWT secret was unnecessarily inherited by deployment subprocesses

**Files:** `scripts/deploy-all.sh`, `scripts/deploy-infra.sh`, `scripts/deploy-frontend.sh` and `scripts/tests/deployment-hardening.test.cjs`.

The Phase 6 private JSON file eliminated JWT values from CloudFormation deploy **arguments**, but an exported `JWT_SECRET` could still be inherited by unrelated Backend `npm`, AWS identity/package/validate commands, and Frontend build/S3 commands. In addition, a Shell-local `JWT_SECRET` that had **not been exported** passed the Bash preflight but was absent from the Node child writing the CloudFormation JSON parameter file.

**Fix:**
- `deploy-all.sh`: retain the Bash-local secret but revoke export before identity and Backend build; pass the value **only** to the separate `deploy-infra.sh` subprocess for infrastructure configuration.
- `deploy-infra.sh`: immediately revoke `JWT_SECRET` export after validation, so all AWS CLI commands cannot inherit it; pass it explicitly to only the Node child writing the mode-600 private JSON parameter file; keep `env -u JWT_SECRET` on the actual CloudFormation deploy subprocess as defense in depth.
- `deploy-frontend.sh`: `unset JWT_SECRET` because the static Next.js Frontend and S3 Website upload do not use it. The frontend deploy continues to produce an independently validated SHA-256 previous-release snapshot before the canonical `s3 sync --delete`.
- Mock test now checks **every** mock AWS subprocess for an inherited `JWT_SECRET`, covers non-exported Bash secret handling and the canonical `deploy-all` split into Build/Infra/Frontend subprocesses. Fake CLI and fake subprocesses operate only on disposable `/tmp` copies, never a real account.

**Evidence:** Deployment Mock **8/8 PASS**, including successful/failing secret-file cleanup, read-only previous release snapshot + hashing/restore, failure preventing upload, special characters and private file permissions. Shell Syntax PASS; Tooling contract **50/50 PASS**; Infrastructure Static **19/19 PASS**. No actual AWS CLI was invoked.

**Residual risk:** The invocation process and the designated Node file writer must temporarily possess JWT values in Bash memory/environment per the existing contract. There is **no** claim of protection from privileged same-host inspection or CloudFormation/Lambda configuration disclosure. Real IAM, CLI, secret rotation and audit logs remain AWS-only validations.

## 3. Regression results actually observed

| Suite | Latest proven result |
|---|---|
| Phase 7 **full Chromium 17 specs** before Phase 8 edits | **75/75 PASS**, zero retries, zero unexpected, zero skipped, ~7.2 minutes |
| Phase 8 **targeted Payment/Pickup Chromium**, after fixes | **1/1 PASS**, zero retries |
| Full Frontend Vitest, after Phase 8 edits | **301/301 PASS**, 80 files |
| Backend Unit, Phase 8 isolated | **297/297 PASS** |
| Security tenant boundary tests | **16/16 PASS** |
| Infrastructure/static architecture checks | **19/19 PASS** |
| Deployment offline fake AWS/restore tests, after Phase 8 edits | **8/8 PASS** |
| `bash scripts/check-tooling.sh` | **50/50 PASS** |
| Frontend TypeScript `npx tsc --noEmit` | **PASS** |
| Frontend ESLint `npm run lint` | **PASS** |
| `bash -n scripts/deploy-all.sh scripts/deploy-infra.sh scripts/deploy-frontend.sh` | **PASS** |
| `git diff --check` | **PASS** |

**Scope qualification:** The complete 75-case Chromium suite was **not** repeated after Phase 8's narrow Payment/Deployment fixes. The affected Payment E2E was repeated successfully, the entire Frontend unit suite was repeated, and Deployment Mock/Static/Security tests ran against the final edits. **Do not report 75/75 as a second Phase 8 full-run result.**

## 4. Diff/security and cleanup integrity

- Scoped source changes: Backend `dynamodb.js`, `platform-admin.service.js`, `user.repository.js`; frontend Platform, Payment, Storefront layout, Auth/Audit responsive modules; E2E/Unit test-owned files; Deployment/Tooling scripts, plus dated reports/AWS checklist. No changed CloudFormation template, real AWS resources, application API contract schema or new runtime package dependencies.
- Backend `BatchGet` keeps table scope, maximum 100 unique User keys, bounded unprocessed-key retries, order reconstruction and **fail-closed missing profile** semantics. Persisted role and tenant checks remain authoritative. There is no new Scan of the database or exposure of passwordHash in public DTOs.
- Payment approve/reject remains one Backend mutation followed by readback; no duplicate writes, unauthorized cross-tenant access or synthetic real-money operations were introduced.
- `Inventory` keeps exactly one **journal-owned** disposable Order per browser run, uses an independent cleanup context and verifies `CANCELLED` before publishing the complete 28-path/33-snapshot artifact. Its eight existing ownership journals were all verified-cancelled in Phase 7. A hard power-off may interrupt teardown and requires journal-guided recovery. Business soft-cancellation preserves historic audit records intentionally.
- The user-owned LocalStack data and **three unattributed pre-existing pending Demo Customer Orders** remain unmodified; no blanket fixture purge performed. Other successful synthetic E2E scenarios may leave owned data for Dev audit.
- No local temporary `scripts/.deploy-infra.*` secret directories or `scripts/.releases/*` snapshots remained after the fake/mock tests; those tests use disposable folders. No Git commit/push or intentional changes to Docker container state.

## 5. Non-blocking deferred items / production release gates

The following are **not** signed off as PASS by this local/offline Phase 8 review:

1. **AWS live tests ALL NOT RUN**: real Learner Lab identity/IAM, file-based CloudFormation override behavior with AWS CLI v2, real anonymous Files S3 privacy and presigned URL isolation, HTTPS architecture for real users, real Lambda/API Gateway/Worker/SQS/CloudWatch, cost and p95 performance, rollback, production backups/PITR/S3 Versioning, actual restore and measured RPO/RTO. S3 Static Website HTTP is classroom **DEMO ONLY**.
2. **Separate environment-gated Cross-System E2E:** **5 TODO / NOT EXECUTED**; Local Smoke **12 TODO**; Contract **2 TODO**. These do not disappear because the 75 Playwright cases passed.
3. **Concurrency quality:** One Backend test invocation in Phase 7 exited 1 when launched simultaneously with several other suites; two isolated Phase 7 runs and this Phase 8 isolated run all passed 297/297. The precise initial failure was not preserved/root-caused. Do not certify arbitrary CI parallel workload.
4. **Device and accessibility:** Physical iOS/Safari, Android, VoiceOver/TalkBack, actual screen-reader reading sequence vs CSS mobile visual order and full WCAG verification remain manual follow-up. Automated viewport/axe coverage is not a substitute.
5. **Resilience:** Frontend snapshot is operator-local, not immutable/durable remote backup; real interrupted-S3-upload rollback must be rehearsed after approval. Inventory teardown is robust against a test timeout but not an OS crash without manual journal recovery.

All AWS-only items and approvals remain documented in `tests/reports/aws-live-validation-checklist.md`, `tests/reports/aws-data-recovery-runbook.md`, and `scripts/FRONTEND_RECOVERY.md`.

**Phase 8 review conclusion: PASS for local/offline remediation readiness; NOT CERTIFIED for actual AWS or production.** No further phase is pending in this particular BDXA plan. Do not Commit, Push, Deploy, reset Compose, or delete historical data unless instructed separately.
