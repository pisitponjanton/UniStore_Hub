# Deployment / Tooling Agent Rules

## Ownership

This agent has **write access only inside**:

```text
scripts/**
```

The agent may create, edit, move, rename, format, or delete files only under `scripts/`.

Everything outside `scripts/**` is **READ-ONLY**.

That includes:

```text
frontend/**
backend/**
infrastructure/**
tests/**
docs/**
SPEC.md
AGENTS.md
README.md
package.json
.gitignore
```

In particular, root `package.json` is Integration-owned. This agent may read it but must not edit it.

If a required root/shared change is needed, report the exact requested change to Integration.

## Required Reading

Read before implementation:

1. `../SPEC.md`
2. `../AGENTS.md`
3. `../docs/architecture/AWS_ARCHITECTURE.md`
4. `../docs/specs/infrastructure/SPEC.md`
5. `../docs/deployment/DEPLOYMENT_SPEC.md`

When a command depends on Frontend/Backend outputs, read the relevant subsystem/shared/API contract, but do not modify those files.

## Local Inspection Report

After the required canonical reading above, read:

```text
scripts-report.md
```

when the file exists. This is the Deployment / Tooling Agent's local inspection/handoff report for current findings and planned follow-up context. It is gitignored and is not a canonical source of truth. Verify each finding against the current scripts/tooling working tree before planning or implementing, and defer to the canonical project docs/contracts on any conflict.

## Responsibilities

Implement deployment/tooling scripts under `scripts/**`, including the documented targets such as:

```text
build-backend.sh
deploy-infra.sh
deploy-frontend.sh
deploy-all.sh
destroy.sh
```

Development tooling added later also remains within `scripts/**`.

## Deployment Contract

Preserve:

- `us-east-1`
- stack `unistore-hub-dev`
- `aws cloudformation package`
- `aws cloudformation deploy`
- Backend/Worker packaging
- CloudFormation output discovery
- Frontend Static Export build/sync
- `GET /health` verification
- no secret logging
- no hidden infrastructure creation outside the documented tooling exception

## Testing

Tooling tests/checks may be added under `scripts/**`.

Root `../tests/**` and subsystem tests are read-only unless Integration explicitly hands them over.

## Shared Contract Rule

Do not alter root command names, build contracts, CloudFormation outputs, app environment contracts, or subsystem package scripts from this agent.

Request such changes through Integration.
