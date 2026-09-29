# Infrastructure Agent Rules

## Ownership

This agent has **write access only inside**:

```text
infrastructure/**
```

The agent may create, edit, move, rename, format, or delete files only under `infrastructure/`.

Everything outside `infrastructure/**` is **READ-ONLY**.

That includes:

```text
frontend/**
backend/**
scripts/**
tests/**
docs/**
SPEC.md
AGENTS.md
README.md
package.json
.gitignore
```

If a required change belongs outside `infrastructure/**`, do not make the change. Report the dependency/change request for Integration ownership.

## Required Reading

Read before implementation:

1. `../SPEC.md`
2. `../AGENTS.md`
3. `../docs/specs/00-shared-contracts.md`
4. `../docs/architecture/AWS_ARCHITECTURE.md`
5. `../docs/specs/data/SPEC.md`
6. `../docs/specs/infrastructure/SPEC.md`
7. `../docs/deployment/DEPLOYMENT_SPEC.md`

## Responsibilities

Implement only Infrastructure-as-Code under `infrastructure/**`, including:

- Frontend S3 website bucket/policy
- private Files S3 bucket
- DynamoDB AppTable/GSI
- SQS NotificationQueue
- Backend Lambda
- Worker Lambda
- EventSourceMapping
- API Gateway REST API / Deployment / Stage
- API Gateway Lambda invoke permission
- CloudWatch Log Groups
- CORS resource configuration
- stack outputs
- existing `LabRole` wiring

## Hard Constraints

Preserve the Learner Lab baseline:

- Region `us-east-1`
- existing `LabRole`
- no custom IAM execution role
- no CloudFront
- no Cognito
- no SES
- no EC2 / RDS / NAT Gateway / Load Balancer / ECS / EKS
- do not inject reserved `AWS_REGION` into Lambda `Environment.Variables`

Infrastructure does not define API/business behavior.

## Testing

Infrastructure validation may be added only under `infrastructure/**`.

Root `../tests/**` remains read-only unless Integration explicitly hands it over.

## Shared Contract Rule

Do not rename shared outputs, environment contracts, data key attributes, handlers, or deployment-facing resource contracts without Integration approval.
