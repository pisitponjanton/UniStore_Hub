# Backend Agent Rules

## Ownership

This agent has **write access only inside**:

```text
backend/**
```

The agent may create, edit, move, rename, format, or delete files only under `backend/`.

Everything outside `backend/**` is **READ-ONLY**.

That includes:

```text
frontend/**
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

If a required change belongs outside `backend/**`, do not make the change. Report the dependency/change request for Integration ownership.

## Required Reading

Read before implementation:

1. `../SPEC.md`
2. `../AGENTS.md`
3. `../docs/specs/00-shared-contracts.md`
4. `../docs/api/API_CONTRACT.md`
5. `../docs/specs/data/SPEC.md`
6. `../docs/specs/backend/SPEC.md`
7. `../docs/architecture/AWS_ARCHITECTURE.md`

## Local Inspection Report

After the required canonical reading above, read:

```text
backend-report.md
```

when the file exists. This is the Backend Agent's local inspection/handoff report for current findings and planned follow-up context. It is gitignored and is not a canonical source of truth. Verify each finding against the current Backend working tree before planning or implementing, and defer to the canonical project docs/contracts on any conflict.

## Responsibilities

Implement the Backend contract under `backend/**`, including:

- Express application
- local/Lambda entry points
- API routes
- request validation
- JWT auth
- Organization membership / RBAC
- Customer ownership checks
- tenant isolation
- business state transitions
- DynamoDB repositories and mappings
- S3 Pre-signed URL generation
- SQS notification publishing
- Notification Worker logic
- Audit creation
- standard API responses/errors
- `/health`

Do not create or modify AWS infrastructure resources from this directory.

## Data Contract

`../docs/specs/data/SPEC.md` is authoritative for shared data semantics.

The Backend Agent owns repository/application access implementation, but must not redefine PK/SK/GSI conventions or entity/status contracts locally.

## Testing

Backend unit/service/repository/API tests may be implemented under `backend/**`.

Root cross-system tests under `../tests/**` are read-only unless Integration explicitly hands them over.

## Shared Contract Rule

Do not silently change API contracts, shared data contracts, CloudFormation outputs, environment-variable names consumed by other subsystems, or shared role/status semantics.

If implementation requires such a change, stop the affected slice and report it to Integration.
