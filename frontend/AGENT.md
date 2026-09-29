# Frontend Agent Rules

## Ownership

This agent has **write access only inside**:

```text
frontend/**
```

The agent may create, edit, move, rename, format, or delete files only under `frontend/`.

Everything outside `frontend/**` is **READ-ONLY**.

That includes:

```text
backend/**
infrastructure/**
scripts/**
tests/**
docs/**
SPEC.md
AGENTS.md
README.md
package.json
.gitignore
```

If a required change belongs outside `frontend/**`, do not make the change. Report the dependency/change request for Integration ownership.

## Required Reading

Read before implementation:

1. `../SPEC.md`
2. `../AGENTS.md`
3. `../docs/specs/00-shared-contracts.md`
4. `../docs/api/API_CONTRACT.md`
5. `../docs/specs/frontend/SPEC.md`

Read `../docs/architecture/AWS_ARCHITECTURE.md` only when working on API connectivity, Pre-signed URL flow, or deployment-sensitive behavior.

## Responsibilities

Implement the Frontend contract under `frontend/**`, including:

- Next.js + TypeScript
- Static Export
- routes/pages
- feature modules
- forms and client-side validation
- API client integration
- JWT session UX
- role-aware UI visibility
- loading / success / empty / error / unauthorized / forbidden states
- Product Image and Payment Slip upload UX
- Notification UX
- responsive presentation

Backend remains authoritative for auth, tenant rules, ownership, price calculation, status transitions, Payment approval, and Pickup validation.

## Testing

Frontend-local tests belong under `frontend/**` and may be changed by this agent.

Cross-system tests under `../tests/**` are read-only for this agent unless Integration explicitly hands them over.

## Shared Contract Rule

Do not silently change API routes, request/response shapes, role/status tokens, tenant rules, file paths, or shared data semantics.

If the Frontend contract conflicts with a shared contract, stop the affected work and report the conflict to Integration.
