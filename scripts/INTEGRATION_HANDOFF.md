# UniStore Hub Deployment Tooling — Integration Handoff

## Ownership

This handoff is produced by the Deployment / Tooling subsystem.

Deployment tooling changes are intentionally limited to `scripts/**`.
Integration owns root-level command wiring such as `package.json`.

## Tooling delivered

The following deployment workflows are implemented under `scripts/**`:

- `scripts/build-backend.sh`
- `scripts/deploy-infra.sh`
- `scripts/deploy-frontend.sh`
- `scripts/deploy-all.sh`
- `scripts/destroy.sh`
- `scripts/check-tooling.sh`
- `scripts/lib/common.sh`
- `scripts/lib/stack-outputs.sh`

Run the local non-destructive contract checks with:

```bash
bash scripts/check-tooling.sh
```

Current result: 50/50 tooling contract checks pass.

## Required root package.json aliases

The deployment specification requires Integration to expose these exact root scripts:

```json
{
  "scripts": {
    "deploy": "bash scripts/deploy-all.sh",
    "deploy:infra": "bash scripts/deploy-infra.sh",
    "deploy:frontend": "bash scripts/deploy-frontend.sh",
    "destroy": "bash scripts/destroy.sh"
  }
}
```

Do not rename or redefine these aliases in a subsystem package.

Current repository state: root `package.json` is not present yet, so Integration must create/merge the root package manifest and preserve any other root scripts owned by Integration.

## Runtime deployment inputs

Deployment uses these baseline values:

```text
AWS_REGION=us-east-1
STACK_NAME=unistore-hub-dev
STAGE_NAME=dev
JWT_EXPIRES_IN=1d
JWT_SECRET=<required runtime secret; no default>
```

`JWT_SECRET` must be provided at runtime and must not be committed.

The operator environment also needs:

- Node.js and npm
- AWS CLI
- active AWS Academy Learner Lab credentials that pass `aws sts get-caller-identity`

Current local tooling environment has Node.js and npm, but AWS CLI is not installed.

## Upstream prerequisites still blocking full deployment

### Backend

Present:

- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/lambda.js`

Still required:

- `backend/src/worker.js`

`build-backend.sh` intentionally fails before modifying the artifact when the Worker handler is missing.

### Frontend

Still required:

- `frontend/package.json`
- `frontend/package-lock.json`
- a successful static-export build that produces `frontend/out/index.html`

The deployment script expects the Frontend package to provide working:

```text
npm test
npm run build
```

and the Next.js build contract must produce `frontend/out`.

### Infrastructure

`infrastructure/template.yaml` is present and now exposes the required CloudFormation outputs:

- `FrontendBucketName`
- `FrontendWebsiteURL`
- `FilesBucketName`
- `AppTableName`
- `NotificationQueueURL`
- `BackendFunctionName`
- `WorkerFunctionName`
- `ApiBaseURL`

Deployment tooling reads these values by `OutputKey`; it does not guess physical resource names.

## Expected integrated flow

After the upstream prerequisites and root aliases are available:

```bash
export JWT_SECRET='<runtime-secret>'
npm run deploy
```

The deployment flow will:

1. validate required local files, region, stack name, secret, and AWS identity;
2. run Backend `npm ci`, `npm test`, and `npm run check`;
3. build `backend/.build/lambda`;
4. validate/package/deploy CloudFormation in `us-east-1`;
5. read required stack outputs by key;
6. build the Frontend with `NEXT_PUBLIC_API_BASE_URL=<ApiBaseURL>/api/v1`;
7. sync only `frontend/out` to `FrontendBucketName`;
8. verify `GET <ApiBaseURL>/health`;
9. print the non-secret deployment endpoints/resources.

A normal redeploy uses `--no-fail-on-empty-changeset` and does not intentionally clear DynamoDB or the Files bucket.

## Destroy flow

Interactive:

```bash
npm run destroy
```

Intentional noninteractive execution:

```bash
bash scripts/destroy.sh --yes
```

Destroy validates account/region/stack first, empties only the stack-discovered Frontend and Files buckets, waits for CloudFormation stack deletion, then removes only the exact tooling artifact bucket derived as:

```text
unistore-hub-cfn-artifacts-{accountId}-us-east-1
```

No wildcard bucket deletion is used.
