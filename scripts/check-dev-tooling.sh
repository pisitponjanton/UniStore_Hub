#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

pass_count=0

pass() {
  printf '[PASS] %s\n' "$1"
  pass_count=$((pass_count + 1))
}

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  local file="${1:?file is required}"
  local pattern="${2:?pattern is required}"
  local label="${3:?label is required}"

  grep -F -- "${pattern}" "${file}" >/dev/null 2>&1     && pass "${label}"     || fail "${label}"
}

assert_not_contains() {
  local file="${1:?file is required}"
  local pattern="${2:?pattern is required}"
  local label="${3:?label is required}"

  if grep -F -- "${pattern}" "${file}" >/dev/null 2>&1; then
    fail "${label}"
  fi

  pass "${label}"
}

assert_executable() {
  local file="${1:?file is required}"
  local label="${2:?label is required}"

  [[ -x "${file}" ]]     && pass "${label}"     || fail "${label}"
}

assert_json_script() {
  local package_file="${1:?package file is required}"
  local script_name="${2:?script name is required}"
  local expected="${3:?expected command is required}"
  local label="${4:?label is required}"
  local actual

  actual="$(
    node - "${package_file}" "${script_name}" <<'NODE'
const fs = require('node:fs');

const packageFile = process.argv[2];
const scriptName = process.argv[3];
const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));

process.stdout.write(pkg.scripts?.[scriptName] || '');
NODE
  )"

  [[ "${actual}" == "${expected}" ]]     && pass "${label}"     || fail "${label} (expected: ${expected}; got: ${actual:-<missing>})"
}

printf 'Running UniStore Hub Dev Mode tooling contract checks\n'

for shell_file in   "${SCRIPT_DIR}/lib/dev-common.sh"   "${SCRIPT_DIR}/dev-setup.sh"   "${SCRIPT_DIR}/dev.sh"   "${SCRIPT_DIR}/dev-seed.sh"   "${SCRIPT_DIR}/dev-outputs.sh"   "${SCRIPT_DIR}/dev-reset.sh"   "${SCRIPT_DIR}/dev-down.sh"
do
  bash -n "${shell_file}" || fail "Shell syntax: ${shell_file}"
  pass "Shell syntax: ${shell_file}"
done

for executable_file in   "${SCRIPT_DIR}/dev-setup.sh"   "${SCRIPT_DIR}/dev.sh"   "${SCRIPT_DIR}/dev-seed.sh"   "${SCRIPT_DIR}/dev-outputs.sh"   "${SCRIPT_DIR}/dev-reset.sh"   "${SCRIPT_DIR}/dev-down.sh"
do
  assert_executable "${executable_file}" "Executable Dev workflow: ${executable_file}"
done

assert_contains "${SCRIPT_DIR}/dev/compose.yaml"   'image: localstack/localstack:3.8.1'   "LocalStack image is pinned"
assert_contains "${SCRIPT_DIR}/dev/compose.yaml"   '127.0.0.1:4566:4566'   "LocalStack edge port binds loopback only"
assert_contains "${SCRIPT_DIR}/dev/compose.yaml"   'SERVICES: dynamodb,s3,sqs'   "LocalStack enables only required AWS-compatible services"
assert_contains "${SCRIPT_DIR}/dev/compose.yaml"   'PERSISTENCE: "1"'   "LocalStack persistence is explicitly enabled"
assert_contains "${SCRIPT_DIR}/dev/.gitignore" \
  '.state/' \
  "Generated LocalStack state is ignored"
assert_contains "${SCRIPT_DIR}/dev.sh" \
  'require_port_available 3000 "Frontend"' \
  "Dev orchestration preflights the canonical Frontend port"
assert_contains "${SCRIPT_DIR}/dev.sh" \
  'require_port_available 4000 "Backend"' \
  "Dev orchestration preflights the canonical Backend port"
assert_contains "${SCRIPT_DIR}/lib/dev-common.sh"   'DEV_DEFAULT_LOCALSTACK_ENDPOINT="http://localhost:4566"'   "Canonical LocalStack endpoint is fixed"
assert_contains "${SCRIPT_DIR}/lib/dev-common.sh"   'DEV_DEFAULT_FRONTEND_URL="http://localhost:3000"'   "Canonical Frontend URL is fixed"
assert_contains "${SCRIPT_DIR}/lib/dev-common.sh"   'DEV_DEFAULT_BACKEND_URL="http://localhost:4000"'   "Canonical Backend URL is fixed"
assert_contains "${SCRIPT_DIR}/lib/dev-common.sh"   'DEV_DEFAULT_APP_TABLE_NAME="unistore-hub-dev-local"'   "Canonical local DynamoDB table is fixed"
assert_contains "${SCRIPT_DIR}/lib/dev-common.sh"   'DEV_DEFAULT_FILES_BUCKET_NAME="unistore-hub-files-local"'   "Canonical local Files bucket is fixed"
assert_contains "${SCRIPT_DIR}/lib/dev-common.sh"   'DEV_DEFAULT_NOTIFICATION_QUEUE_NAME="unistore-hub-notifications-local"'   "Canonical local Notification queue is fixed"
assert_contains "${SCRIPT_DIR}/lib/dev-common.sh"   '"http://localhost:4566"|"http://127.0.0.1:4566"|"http://[::1]:4566"'   "Destructive endpoint guard permits only exact loopback LocalStack URLs"

(
  export AWS_ENDPOINT_URL='https://dynamodb.us-east-1.amazonaws.com'
  source "${SCRIPT_DIR}/lib/dev-common.sh"
  dev_validate_local_contract
) >/dev/null 2>&1   && fail "Non-local AWS endpoint is rejected"   || pass "Non-local AWS endpoint is rejected"

(
  export AWS_ENDPOINT_URL='http://localhost.example.com:4566'
  source "${SCRIPT_DIR}/lib/dev-common.sh"
  dev_validate_local_contract
) >/dev/null 2>&1   && fail "Lookalike localhost hostname is rejected"   || pass "Lookalike localhost hostname is rejected"

(
  export AWS_ACCESS_KEY_ID="host-real-key"
  export AWS_SECRET_ACCESS_KEY="host-real-secret"
  export JWT_SECRET="host-real-jwt"
  export NODE_ENV="production"
  source "${SCRIPT_DIR}/lib/dev-common.sh"
  dev_export_environment
  [[ "${AWS_ACCESS_KEY_ID}" == "test" ]]
  [[ "${AWS_SECRET_ACCESS_KEY}" == "test" ]]
  [[ "${JWT_SECRET}" == "${DEV_DEFAULT_JWT_SECRET}" ]]
  [[ "${NODE_ENV}" == "development" ]]
) >/dev/null 2>&1 \
  && pass "Dev environment does not inherit host AWS/JWT/production mode values" \
  || fail "Dev environment does not inherit host AWS/JWT/production mode values"

assert_contains "${SCRIPT_DIR}/dev-setup.sh"   'dev_compose up -d localstack'   "dev-setup starts/resumes LocalStack"
assert_contains "${SCRIPT_DIR}/dev-setup.sh"   'dynamodb describe-table'   "dev-setup checks DynamoDB before create"
assert_contains "${SCRIPT_DIR}/dev-setup.sh"   's3api head-bucket'   "dev-setup checks Files bucket before create"
assert_contains "${SCRIPT_DIR}/dev-setup.sh"   'sqs get-queue-url'   "dev-setup checks Notification queue before create"
assert_contains "${SCRIPT_DIR}/dev-setup.sh"   'put-bucket-cors'   "dev-setup applies local S3 CORS"
assert_contains "${SCRIPT_DIR}/dev-setup.sh"   'VisibilityTimeout=120'   "dev-setup preserves canonical queue visibility timeout"
assert_not_contains "${SCRIPT_DIR}/dev-setup.sh"   'delete-table'   "dev-setup is non-destructive for DynamoDB"
assert_not_contains "${SCRIPT_DIR}/dev-setup.sh"   's3 rm'   "dev-setup is non-destructive for Files bucket"
assert_contains "${SCRIPT_DIR}/dev-setup.sh" \
  'validate_app_table_contract' \
  "dev-setup validates existing DynamoDB schema/billing parity"

assert_contains "${SCRIPT_DIR}/dev.sh"   'bash "${SCRIPT_DIR}/dev-setup.sh"'   "dev orchestration ensures local dependencies"
assert_contains "${SCRIPT_DIR}/dev.sh"   'exec npm run dev'   "dev orchestration launches application dev commands"
assert_contains "${SCRIPT_DIR}/dev.sh"   'worker:dev dev:worker'   "dev orchestration delegates local Worker to Backend"
assert_contains "${SCRIPT_DIR}/dev.sh"   'NEXT_PUBLIC_API_BASE_URL="${DEV_API_BASE_URL}"'   "Frontend receives canonical local API URL"
assert_contains "${SCRIPT_DIR}/dev.sh"   'DEV_RUN_PID_FILE'   "Dev runner records a managed PID"
assert_contains "${SCRIPT_DIR}/dev.sh"   'stop_children'   "Dev runner cleans child processes"
assert_contains "${SCRIPT_DIR}/dev.sh"   'unset'   "Frontend environment is sanitized before launch"

assert_contains "${SCRIPT_DIR}/dev-seed.sh"   'for candidate in dev:seed seed:dev seed:local'   "Dev seed delegates to Backend deterministic seed contract"
assert_not_contains "${SCRIPT_DIR}/dev-seed.sh"   'npm run seed:platform-admin'   "Platform Admin-only seed is not treated as full Dev seed"
assert_contains "${SCRIPT_DIR}/dev-seed.sh"   'npm run "${SEED_SCRIPT}"'   "Dev seed executes only the resolved Backend-owned seed script"

for output_key in   TEST_BACKEND_BASE_URL   TEST_API_BASE_URL   TEST_FRONTEND_BASE_URL   TEST_HEALTH_URL   TEST_AWS_ENDPOINT_URL   TEST_AWS_REGION   TEST_APP_TABLE_NAME   TEST_FILES_BUCKET_NAME   TEST_NOTIFICATION_QUEUE_URL   E2E_API_BASE_URL   E2E_AWS_ENDPOINT_URL   E2E_AWS_REGION   E2E_NOTIFICATION_QUEUE_URL
do
  assert_contains "${SCRIPT_DIR}/lib/dev-common.sh"     "${output_key}"     "Non-secret local output key: ${output_key}"
done

for forbidden_output in JWT_SECRET AWS_SECRET_ACCESS_KEY PASSWORD TOKEN=; do
  assert_not_contains "${SCRIPT_DIR}/dev-outputs.sh"     "${forbidden_output}"     "dev-outputs does not print ${forbidden_output}"
done

assert_contains "${SCRIPT_DIR}/dev-reset.sh"   'dev_validate_local_contract'   "dev-reset validates exact local endpoint/resource contract before reset"
assert_contains "${SCRIPT_DIR}/dev-reset.sh"   'Type "RESET LOCAL DEV" to continue'   "dev-reset requires explicit interactive confirmation"
assert_contains "${SCRIPT_DIR}/dev-reset.sh"   'dynamodb delete-table'   "dev-reset clears the canonical local DynamoDB table"
assert_contains "${SCRIPT_DIR}/dev-reset.sh"   's3 rm'   "dev-reset clears the canonical local Files bucket"
assert_contains "${SCRIPT_DIR}/dev-reset.sh"   'sqs receive-message'   "dev-reset drains the canonical local queue"
assert_contains "${SCRIPT_DIR}/dev-reset.sh"   'sqs delete-message'   "dev-reset deletes only received local queue messages"
assert_contains "${SCRIPT_DIR}/dev-reset.sh"   'bash "${SCRIPT_DIR}/dev-setup.sh"'   "dev-reset restores canonical local resources"
assert_not_contains "${SCRIPT_DIR}/dev-reset.sh"   'cloudformation'   "dev-reset never invokes CloudFormation"
assert_contains "${SCRIPT_DIR}/dev-reset.sh" \
  'bash "${SCRIPT_DIR}/dev-down.sh"' \
  "dev-reset stops the managed app/worker runner before destructive reset"


assert_contains "${SCRIPT_DIR}/dev-down.sh"   'dev_compose pause localstack'   "dev-down pauses LocalStack without erasing local state"
assert_not_contains "${SCRIPT_DIR}/dev-down.sh"   'down -v'   "dev-down never removes LocalStack volumes"
assert_not_contains "${SCRIPT_DIR}/dev-down.sh"   'dev-reset.sh'   "dev-down does not perform an implicit reset"
assert_not_contains "${SCRIPT_DIR}/dev-down.sh"   'rm -rf'   "dev-down does not recursively delete local state"

require_command node
require_command docker
docker compose --file "${SCRIPT_DIR}/dev/compose.yaml" config >/dev/null   || fail "LocalStack compose configuration is valid"
pass "LocalStack compose configuration is valid"

ROOT_PACKAGE="${REPO_ROOT}/package.json"
BACKEND_PACKAGE="${REPO_ROOT}/backend/package.json"

[[ -f "${ROOT_PACKAGE}" ]] || fail "Root package.json exists for Integration wiring"
[[ -f "${BACKEND_PACKAGE}" ]] || fail "Backend package.json exists for Dev dependencies"

assert_json_script "${ROOT_PACKAGE}" dev:setup   'bash scripts/dev-setup.sh'   "Root dev:setup delegates to Scripts tooling"
assert_json_script "${ROOT_PACKAGE}" dev   'bash scripts/dev.sh'   "Root dev delegates to Scripts tooling"
assert_json_script "${ROOT_PACKAGE}" dev:seed   'bash scripts/dev-seed.sh'   "Root dev:seed delegates to Scripts tooling"
assert_json_script "${ROOT_PACKAGE}" dev:reset   'bash scripts/dev-reset.sh'   "Root dev:reset delegates to Scripts tooling"
assert_json_script "${ROOT_PACKAGE}" dev:down   'bash scripts/dev-down.sh'   "Root dev:down delegates to Scripts tooling"

assert_json_script "${BACKEND_PACKAGE}" worker:dev   'node src/local-worker.js'   "Backend exposes local Worker entrypoint"
assert_json_script "${BACKEND_PACKAGE}" dev:seed   'node scripts/dev-seed.js'   "Backend exposes deterministic Dev seed entrypoint"

[[ -f "${REPO_ROOT}/backend/src/local-worker.js" ]]   && pass "Backend local Worker implementation is present"   || fail "Backend local Worker implementation is present"
[[ -f "${REPO_ROOT}/backend/scripts/dev-seed.js" ]]   && pass "Backend deterministic Dev seed implementation is present"   || fail "Backend deterministic Dev seed implementation is present"

printf 'All %s Dev Mode tooling contract checks passed.\n' "${pass_count}"
