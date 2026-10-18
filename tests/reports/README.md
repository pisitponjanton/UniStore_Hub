# Cross-system Testing Reports

This directory contains API, security, integration, infrastructure and full-stack verification records. Files are named by **subject** rather than implementation milestone. Historical evidence has been retained and grouped; older results may no longer describe the latest build.

## Start here

- [Testing handoff](testing-handoff.md) — architecture and prerequisites
- [Traceability map](fr-traceability.md) / [machine-readable traceability](fr-traceability.json) — original feature coverage
- [Test harness validation](test-harness-validation.md) — concurrency, environment isolation and traceability evidence
- [Local UX audit](local-ux-audit-2026-10-16.md) — historical mobile/browser remediation records
- [Production readiness history](production-readiness-2026-10-11.md) — historical integration checks; **not** a new production approval
- [Runtime stability](runtime-stability-verification.md) — runtime and test-process stability
- [Frontend scoped QA status](../../frontend/quality-audit/README.md) — **current** frontend evidence and remaining risk register

Other records are organized by descriptive names such as `orders.md`, `payment-review.md`, `tenant-isolation-records.md`, `file-security.md`, `aws-deployment.md` and `full-regression.md`. The matching `full-regression.log` is retained as raw historical test output.

Earlier report filenames and their current destinations are indexed in [artifact-migration-map.json](../../frontend/quality-audit/artifact-migration-map.json). Consolidated documents include anchors for individual original records so existing citations remain traceable.

**Important:** Do not infer current test success or authorization for production release from a historical report. Re-run the canonical suite in the supported Node.js version and with permitted local/disposable fixtures before making release claims. Do not reset or delete real test or production data.
