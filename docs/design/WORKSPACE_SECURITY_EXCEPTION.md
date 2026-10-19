# UniStore Hub — Workspace-Only Security Risk Acceptance

Decision date: 2026-10-19
Workspace: `UniStore_Hub`
Scope: Local project development, local build, test, and final review **inside this workspace only**.
Authorization: Project owner/user explicitly approved proceeding on 2026-10-19, with the condition **"ต้องทำภายใน workspace เท่านั้น"** (must work inside the workspace only).
Decision type: **TIME-BOUNDED, WORKSPACE-ONLY RISK ACCEPTANCE**; not a production or independent external security signoff.
Effective until: **2026-11-18**, or until any material dependency/patch/architecture change, a new related advisory, or deployment request, whichever occurs first. The date is a conservative review deadline imposed for this local exception, **not a duration specified by the user**.

## Decision

**Accepted for local workspace continuation and completion of the current UX/UI redesign plan only**, subject to the conditions below. The residual npm advisory remains documented; **do not label the full `npm audit` clean**. An independent Security/code-owner review has not been performed or attested in this decision.

- **F-SEC-01:** patched at the scanned production dependency level. Next.js `16.4.2`, `source-map-js` `1.2.2`; most recent documented production `npm audit --omit=dev` reported zero vulnerabilities.
- **F-SEC-02:** locally mitigated and accepted **for local workspace testing and plan review only**, not permanently resolved upstream. Full npm audit continues to flag five High-affected package nodes propagated from one `braces@3.0.3` development-only advisory `GHSA-vfj7-8cjw-p6xm`.
- The reviewed MIT-licensed `frontend/vendor/braces` local patch guards deep recursion/AST paths and caps explicit expansion outputs at 65,536 values. Original package version and advisory visibility are preserved. This is a narrow mitigation, **not proof of complete DoS resistance**.

## Evidence supporting a bounded local decision

1. `docs/design/BRACES_PATCH_TECHNICAL_REVIEW.md` records a 672/672 ordinary-pattern compatibility comparison against upstream, after a discovered discrepancy was corrected.
2. `docs/design/BRACES_EXPANSION_BUDGET_IMPLEMENTATION.md` records deep nesting and shallow Cartesian output hardening, with residual byte/CPU/heap limits not guaranteed.
3. `docs/design/RUNTIME_DEPENDENCY_ISOLATION.md` documents the dependency as development-only in the current static export, including 75 built assets scanned; this is bounded evidence only.
4. `docs/design/SECURITY_PATCH_ACCEPTANCE_PACKET.md` and `docs/design/FINAL_DIFF_REVIEW.md` retain the audit chain, integrity fingerprint verification and test history.
5. In a 2026-10-19 continuation check, `test:security:braces`, security gate tests 9/9, runtime-isolation tests 6/6, Unit 360/360, TypeScript, ESLint, static Build 30/30 and `git diff --check` passed. The live audit review returned **exit 2 — MANUAL_SECURITY_REVIEW_REQUIRED**, not exit 0.

## Conditions / retained boundaries

- All activity remains within the currently selected `UniStore_Hub` workspace. No write to a different workspace, machine path, external service or account.
- **No Commit, Push, Deploy, cloud/prod access, data reset, real business-record mutation, or remote changes** under this approval.
- Do not change the audit gate to treat the residual advisory as an unconditional PASS. Keep `npm audit` result visible and fail closed on unexpected findings or changed file fingerprints.
- Do not change Backend, RBAC, organization/tenant isolation, payment, order, pickup or AWS contracts.
- Re-check security after dependency or vendor patch updates; require new approval for production deployment, external sharing/release, or use beyond the effective date.
- The user/project owner is the authorizing decision-maker for **local workspace work**; their personal identity was not collected. **No independent Security reviewer was identified or impersonated.**
- Follow-up owner: project owner or assigned Security/code owner before any release. Review due **no later than 2026-11-18**; track upstream patched release and replace or re-review local patch when one becomes available.

## Plan disposition

With this **strictly local, time-limited user acceptance**, Phase 15 may be closed as a *workspace-only mitigation with accepted residual risk*, provided final source/test checks remain successful. Final Phase 14 must still independently review the entire task diff, record missing real-production/cross-role evidence as NOT_TESTED, and must not describe production security approval.
