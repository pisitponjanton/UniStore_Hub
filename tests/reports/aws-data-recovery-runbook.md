# UniStore Hub — AWS DynamoDB + Files S3 Data Recovery Runbook

> **Prepared:** 2026-10-16 (Asia/Bangkok)
> **Status:** DESIGN / NOT RUN ON AWS. The user has not approved any live backup, restore, IAM mutation, S3 upload, deletion or infrastructure changes.
> **Canonical source:** `SPEC.md`, `infrastructure/template.yaml`, `docs/specs/infrastructure/SPEC.md`, `docs/deployment/DEPLOYMENT_SPEC.md`.
> **Target only after approval:** AWS Academy Learner Lab, `us-east-1`, `unistore-hub-dev`.

## A. Confirmed current data-protection gaps (as deployed source)

- `AppTable` is DynamoDB PAY_PER_REQUEST with `PK/SK` and `GSI1`; **PITR is not configured** in `infrastructure/template.yaml`.
- `FilesBucket` is private, AES256 encrypted and has upload/download CORS, but **S3 Versioning is not configured**.
- `FrontendBucket` is a public **HTTP S3 Static Website**, not a suitable real-identity production frontend by itself.
- `AppTable`, `FilesBucket` and `FrontendBucket` lack explicit `DeletionPolicy: Retain` in the current template. Template/stack deletion can result in data loss or orphaned site/API state.
- The canonical `npm run destroy` path is deliberately destructive and **not** a backup, restore or rollback solution.
- An on-device snapshot of website files (see `scripts/FRONTEND_RECOVERY.md`) protects **only static website files during one frontend deploy**. It does **not** preserve DynamoDB records or payment-slip/product-image objects in the private Files bucket.

## B. Recovery objectives to decide *before* AWS writes

Record an **owner-approved** value rather than inventing a target:

| Data set | Proposed recovery source for decision | RPO (maximum accepted data loss) | RTO (maximum accepted recovery time) | Ownership / retention |
|---|---|---|---|---|
| DynamoDB `AppTable` Orders, Payments, Users, Audit | PITR or separately authorized on-demand backup/export | **UNDECIDED** | **UNDECIDED** | **UNDECIDED** |
| S3 `FilesBucket` product images and payment slips | S3 Versioning and/or independent encrypted copy with retention | **UNDECIDED** | **UNDECIDED** | **UNDECIDED** |
| Frontend public `out/` static website | Verified release manifest and archived known-good build / protected object versions | **UNDECIDED** | **UNDECIDED** | **UNDECIDED** |
| CloudFormation / Backend Lambda code and environment | Reproducible tagged artifact and approved stack change set | **UNDECIDED** | **UNDECIDED** | **UNDECIDED** |

A classroom demo might tolerate more recovery delay than a real-user service, but this is a **decision**, not a default. Consider Academy credits, IAM limitations, storage growth and resource persistence when the lab session ends.

## C. AWS test-entry gates

1. **Explicit user approval** of exact test account/session, current identity and region, stack, budget, IAM scope, synthetic run ID, intended write limits and object prefixes.
2. Identify currently deployed resource names through CloudFormation outputs **read-only**; do not guess bucket/table names and do not assume the CLI is logged in.
3. Inspect currently configured S3 Versioning, Public Access Block, encryption, lifecycle policies, DynamoDB continuous backups, table ARN and deletion protections. Record *redacted* output.
4. Require separate approval for making backups, creating backup buckets/tables, changing versioning/PITR/DeletionPolicy, restoring, testing failures and deleting temporary test resources. These are **out of scope** of offline Phase 6.
5. Never use production customer identities, real medical/payment records, sensitive slips or real money as fixtures. Never dump database contents into logs or this document.

## D. DynamoDB restore rehearsal — real AWS, **NOT RUN**

- Capture table creation parameters, index names (including GSI1), data shape, TTL settings and current PITR/backup status. Determine the safest supported snapshot mechanism in the currently allowed Learner Lab IAM capabilities; do **not** assume PITR permissions.
- After backup approval, generate a timestamped backup or export with an agreed run marker. Record request IDs and backup ARN **privately**. Verify status is completed before a restore attempt.
- **Restore to a new uniquely named disposable table, never directly over `AppTable`**, with approval. Compare synthetic partition/item counts, hash digests of selected synthetic records, index schema, security and tenant ownership, and time to restore. DynamoDB restore does not automatically reconnect the application or guarantee reconciliation with concurrently changed S3 objects.
- Measure actual RPO/RTO. Do not promote, rename, point API to, overwrite, or delete application tables during rehearsal without a separate approved migration/cutover plan.
- Close with an authorized cleanup list for *only* individually identified disposable resources. Existing table/history is not test cleanup data.

## E. Private Files S3 restore rehearsal — real AWS, **NOT RUN**

- Inspect `FilesBucket` block-public-access policy, public/object ACL behavior, KMS/SSE-S3 encryption, object key structure, CORS, Versioning and any lifecycle policy.
- Test a small **synthetic** file key placed under a uniquely approved prefix; never inspect or copy actual users' payment slips without explicit permission.
- If S3 Versioning/backup copy is approved and supported, create a distinct synthetic version or backup, mutate *only that test key*, and restore a previous version to a separate, owned test key; do **not** overwrite the original customer key.
- Verify checksums, MIME type, metadata, access control, presigned URL restrictions, tenant isolation and expired-link behavior. LocalStack S3 privacy results cannot certify real AWS.
- Measure time, track storage costs and compare restored object IDs with corresponding synthetic DynamoDB references. Note consistency gap between database and Files S3 if recovered from mismatched timestamps.

## F. Disaster drill, release decision and evidence

For each owner-approved test, append a record containing: `test-id`, date/time, scrubbed account/region, approved run ID, resource ownership, declared RPO/RTO, read-only checks, exact synthetic write/restore actions, expected vs observed result, request ID or artifact path, cost impact, access-control outcome, whether individual resource cleanup was approved/completed, and PASS/FAIL/BLOCKED.

**GO for production requires** independently demonstrated, repeatable DynamoDB **and** Files S3 recovery, validated release rollback, real AWS private-bucket checks, secrets review, IAM effective permissions and a separately approved HTTPS real-identity frontend.

**Current state:** Recovery mechanism and live permissions **not proven**; AppTable PITR, Files S3 Versioning and deletion protection remain gaps in the source template. Do not set AWS-DATA-01 or production release gate to PASS until approved, measured real AWS recovery evidence exists.
