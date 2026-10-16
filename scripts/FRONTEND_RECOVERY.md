# UniStore Hub — Frontend Static Website Recovery (Learner Lab)

> **Prepared offline only; AWS restore NOT TESTED.** This is an operator runbook, not permission to deploy, restore, delete S3 objects or access an AWS account.
> Source-defined deployment: `scripts/deploy-frontend.sh`, `docs/deployment/DEPLOYMENT_SPEC.md`. Only `us-east-1` / `unistore-hub-dev` / FrontendBucket are in scope.

## Snapshot generated before each frontend upload

Before the canonical `aws s3 sync frontend/out s3://<FrontendBucketName> --delete`, the deploy script now reads the existing public website to a **local private** directory under:

```text
scripts/.releases/frontend.<random>/
├── frontend-bucket.txt
├── stack-name.txt
├── previous/
├── previous-manifest.json
└── candidate-manifest.json
```

The previous release's file names, sizes and SHA-256 digests are recorded in `previous-manifest.json`; the locally built Next.js output is recorded in `candidate-manifest.json`. The directory and manifest are local only (`umask 077`) and Git-ignored. The deployment stops before its destructive upload if S3 snapshot or manifest generation fails. A failed frontend upload **does not automatically roll back**, but preserves the snapshot for explicit recovery.

**Limitations:** A local snapshot is not an immutable remote recovery copy and does not prove snapshot consistency under concurrent writes; it may not survive deletion of the operator computer, disk failure, expired Learner Lab or missing S3 IAM permissions. Multiple snapshots consume local disk. First-ever deployment will have an empty previous state; **do not restore an empty snapshot**. S3 sync with `--delete` is not atomic and failure may leave partial content. These risks remain for live AWS approval/rehearsal.

## Offline snapshot validation (safe; no AWS access)

From the project root, with the exact release directory from the deployment log:

```bash
RELEASE_DIR="scripts/.releases/frontend.<approved-run-id>"
node scripts/lib/frontend-release-manifest.cjs verify \
  "$RELEASE_DIR/previous" "$RELEASE_DIR/previous-manifest.json"
node scripts/lib/frontend-release-manifest.cjs verify \
  "frontend/out" "$RELEASE_DIR/candidate-manifest.json"
```

The candidate verification only applies if `frontend/out` still matches the release's candidate. A checksum mismatch, missing file, unexpected symlink, absent manifest or zero previous files blocks rollback. Check `frontend-bucket.txt` and `stack-name.txt` against the currently approved stack. Never assume the snapshot is safe solely because it has a matching directory name.

The offline tooling mock test is `node --test scripts/tests/deployment-hardening.test.cjs`; it verifies that backup occurs before upload, a failed backup prevents upload and tampering is detected.

## Live restore workflow — **requires separate explicit approval**

1. **STOP further frontend deployments.** Record incident ID, UTC time, account/region, current stack, target FrontendBucket and desired last known-good snapshot. Confirm the approved S3 website is demo-only HTTP.
2. Obtain separate written approval for **S3 overwrites and deletion**, including the exact target bucket, approved snapshot directory, object count, estimated cost and blast radius. Confirm current account/region/CloudFormation outputs through read-only AWS CLI. **Never infer a bucket name.**
3. Verify the snapshot's `previous-manifest.json` and the previous release contains `index.html`. Inspect existing S3 objects, unrelated prefixes and any concurrent deploys. If uncertain, block the restore.
4. Before modifying anything, take an additional **read-only current-state S3 snapshot** in a different private directory and generate its SHA-256 manifest (so a mistaken restore can itself be reversed). Review this backup's completeness.
5. For a **separately approved disposable staging FrontendBucket**, first rehearse restoring the validated `previous/` files using AWS CLI S3 Sync. Only after validating the dry-run object delta, approved key allowlist, release artifact and intended removal list should a responsible operator consider executing the final `--delete` to the exact approved target bucket.
6. Confirm index and deep links render with expected HTTP/Cache-Control behavior, API integration and browser Console; measure recovery time. Confirm the final object count/checksums and no unrelated objects deleted. An AWS 200 response or CloudFormation status alone does not prove all published files are correct.
7. Redact S3 paths/URLs if sensitive, record audit evidence and the release decision. Retain snapshots per owner-agreed retention. Do **not** run `npm run destroy` as a substitute for Frontend recovery.

The live restore command is intentionally **not automated** by this Phase. A command containing `aws s3 sync ... --delete` against a shared bucket must be assembled and authorized during the approved AWS rehearsal, not executed from this document. LocalStack success does not satisfy this gate.

## Recovery readiness criteria

- Measurable, owner-agreed **RTO** to restore the last stable complete website, and **RPO** for changes lost during the deployment.
- Proven recovery from a **partially completed** frontend upload, including API compatibility, CDN/browser cache effects if applicable, and missing asset checks.
- Separate rollback for Backend/API/CloudFormation, whose rollback cannot reconstruct overwritten/deleted S3 website files.
- Evidence of effective S3 read/write permissions and credits/quota; safe cleanup of the disposable staging objects only with approval.
- Production real-user HTTPS architecture remains a **separate NO-GO gate**; S3 Website HTTP is course-demo-only.

**Status: offline mock preparation PASS; live rollback drill NOT RUN.**
