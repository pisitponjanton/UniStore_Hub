# Artifact Naming and Consolidation Policy

**Status:** Mandatory for all UniStore Hub contributors and AI Agents, including the root, Frontend, Backend, Infrastructure, Testing, Integration and documentation agents.

## Problem this prevents

Splitting each iteration of a project into separate milestone-named test files, reports, screenshots and folders causes fragmented ownership, duplicate assertions, stale references and confusing handoffs. The user has requested this cleanup repeatedly. This policy is a **repository-wide permanent constraint**, not a temporary cleanup note.

## Naming requirements

1. **Never create any source-controlled project file or directory with `phase` anywhere in its name** (case-insensitive). This includes `phase1.md`, `component-phase-4.tsx`, `campus-a-phase11-customer.spec.ts`, generated documents, evidence directories, screenshots, and files under `docs/`, `frontend/`, `backend/`, `tests/` and `scripts/`.
2. **Name by durable behavior, feature or ownership domain**, not by when the work happened. Planning phases may appear *inside* a document or external plan status; they are never part of its path. Also avoid aliases that merely replace `phase` with `step01`, `stage02`, `iteration03` or timestamps without a subject.
3. **One test suite per coherent concern.** When extending authentication tests, add cases to the existing authentication/return suite. For storefront behavior, use the storefront suite; Staff + Organization Admin use organization operations. Separate unrelated behaviors. Preserve every existing test, import, fixture, permission assertion, network interception and rollback guard when merging. Never remove tests only to reduce file count.
4. **Documentation is topic-based.** Update the current foundation, storefront, customer, operations or QA/security document instead of authoring a new numbered report. Preserve historical findings and limitations in a named review appendix as needed; do not duplicate a report as another active file.
5. **QA evidence is also included.** Keep ignored screenshots, JSON, logs and their parent folders in feature-named locations. These files may remain ignored, but their filenames should obey the same rules. Always keep or update the evidence pointers in documents and scripts.
6. **Migrations must be complete.** Update imports, references in tests/scripts, package commands, README indexes, CI/test selections and links. Do not leave a renamed source file alongside a second identical copy. Preserve source-to-destination mapping in `frontend/quality-audit/artifact-migration-map.json` for provenance.

## Mandatory pre-handoff check

From the repository root:

```bash
npm run check:artifact-names
git diff --check
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend test
npm --prefix frontend exec playwright test e2e/quality-audit/ --list --project=chromium
```

Run applicable Browser/Integration tests as well when local services and safely disposable fixtures are available. **Never run real mutation suites against production or delete existing records for a rename-only task.** Tests not executed must remain `NOT_TESTED`.

The filename check inspects Git-tracked/new files plus ignored `frontend/quality-audit/.evidence/`. It excludes tool-owned cache/dependency directories such as `.git`, `node_modules`, `.next` and Playwright's transient `test-results`.

## Responsibility

Every Agent must read this before creating reports/tests, regardless of subsystem ownership. Root Integration Agent checks naming and links as part of review. Frontend Agent adds new browser assertions to subject suites. Testing Agent uses the same rule for integration specifications. Documentation Agent edits topical docs. A request to "work one phase at a time" does **not** grant permission to create files named by phase; task progress belongs in the task plan.

**Naming violations are a handoff blocker.** Do not disable or weaken the check to pass a build. If the user specifically requests a different naming scheme, clarify and document the explicit exception before implementation.

## Consolidated reference locations

- `docs/design/README.md`: current design and review index.
- `frontend/e2e/quality-audit/README.md`: browser tests indexed by behavior.
- `frontend/quality-audit/README.md`: QA reports, evidence and status.
- `frontend/quality-audit/artifact-migration-map.json`: legacy path mapping.
- `scripts/quality/check-artifact-names.cjs`: enforcement guard.
