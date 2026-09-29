#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

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

printf 'Running UniStore Hub deployment tooling contract checks\n'

for shell_file in   "${SCRIPT_DIR}/lib/common.sh"   "${SCRIPT_DIR}/lib/stack-outputs.sh"   "${SCRIPT_DIR}/build-backend.sh"   "${SCRIPT_DIR}/deploy-infra.sh"   "${SCRIPT_DIR}/deploy-frontend.sh"   "${SCRIPT_DIR}/deploy-all.sh"   "${SCRIPT_DIR}/destroy.sh"
do
  bash -n "${shell_file}" || fail "Shell syntax: ${shell_file}"
  pass "Shell syntax: ${shell_file}"
done

assert_contains "${SCRIPT_DIR}/lib/common.sh"   'DEPLOY_DEFAULT_AWS_REGION="us-east-1"'   "AWS region baseline is fixed to us-east-1"
assert_contains "${SCRIPT_DIR}/lib/common.sh"   'DEPLOY_DEFAULT_STACK_NAME="unistore-hub-dev"'   "Stack baseline is fixed to unistore-hub-dev"
assert_contains "${SCRIPT_DIR}/lib/common.sh"   'require_secret_env JWT_SECRET'   "JWT_SECRET is required through secret-safe preflight"
assert_not_contains "${SCRIPT_DIR}/lib/common.sh"   'set -x'   "Shared helpers do not enable shell xtrace"

assert_contains "${SCRIPT_DIR}/build-backend.sh"   'npm ci'   "Backend build performs npm ci"
assert_contains "${SCRIPT_DIR}/build-backend.sh"   'npm test'   "Backend build runs tests"
assert_contains "${SCRIPT_DIR}/build-backend.sh"   'npm run check'   "Backend build runs static/syntax check"
assert_contains "${SCRIPT_DIR}/build-backend.sh"   'npm ci --omit=dev'   "Backend artifact installs production dependencies only"
assert_contains "${SCRIPT_DIR}/build-backend.sh"   'src/worker.js'   "Backend artifact requires Worker handler"

assert_contains "${SCRIPT_DIR}/deploy-infra.sh"   'aws cloudformation validate-template'   "Infrastructure deployment validates template"
assert_contains "${SCRIPT_DIR}/deploy-infra.sh"   'aws cloudformation package'   "Infrastructure deployment uses CloudFormation package"
assert_contains "${SCRIPT_DIR}/deploy-infra.sh"   'aws cloudformation deploy'   "Infrastructure deployment uses CloudFormation deploy"
assert_contains "${SCRIPT_DIR}/deploy-infra.sh"   '--no-fail-on-empty-changeset'   "Infrastructure redeploy accepts empty changesets"
assert_contains "${SCRIPT_DIR}/deploy-infra.sh"   'unistore-hub-cfn-artifacts-${AWS_ACCOUNT_ID}-${AWS_REGION}'   "Artifact bucket name is account/region derived"
assert_not_contains "${SCRIPT_DIR}/deploy-infra.sh"   'CAPABILITY_NAMED_IAM'   "Infrastructure tooling does not request named IAM capability"

for output_key in   FrontendBucketName   FrontendWebsiteURL   FilesBucketName   AppTableName   NotificationQueueURL   BackendFunctionName   WorkerFunctionName   ApiBaseURL
do
  assert_contains "${SCRIPT_DIR}/lib/stack-outputs.sh"     "${output_key}"     "Required CloudFormation output: ${output_key}"
done
assert_contains "${SCRIPT_DIR}/lib/stack-outputs.sh"   'describe-stacks'   "Stack outputs are read from CloudFormation"

assert_contains "${SCRIPT_DIR}/deploy-frontend.sh"   'NEXT_PUBLIC_API_BASE_URL="${ApiBaseURL%/}/api/v1"'   "Frontend API URL derives from ApiBaseURL + /api/v1"
assert_contains "${SCRIPT_DIR}/deploy-frontend.sh"   '"s3://${FrontendBucketName}"'   "Frontend sync targets FrontendBucketName"
assert_contains "${SCRIPT_DIR}/deploy-frontend.sh"   '--delete'   "Frontend sync uses --delete"
assert_not_contains "${SCRIPT_DIR}/deploy-frontend.sh"   's3://${FilesBucketName}'   "Frontend deployment never targets FilesBucketName"

assert_contains "${SCRIPT_DIR}/deploy-all.sh"   'HEALTH_URL="${ApiBaseURL%/}/health"'   "Health URL derives directly from ApiBaseURL"
assert_contains "${SCRIPT_DIR}/deploy-all.sh"   'AbortSignal.timeout(10000)'   "Health check has a bounded timeout"
assert_contains "${SCRIPT_DIR}/deploy-all.sh"   "body?.success !== true || body?.data?.status !== 'ok'"   "Health check validates the documented JSON contract"

assert_contains "${SCRIPT_DIR}/destroy.sh"   'Type the exact stack name'   "Destroy requires exact interactive stack confirmation"
assert_contains "${SCRIPT_DIR}/destroy.sh"   'ASSUME_YES=false'   "Destroy defaults to interactive mode"
assert_contains "${SCRIPT_DIR}/destroy.sh"   'empty_stack_bucket "${FrontendBucketName}"'   "Destroy empties only discovered Frontend bucket"
assert_contains "${SCRIPT_DIR}/destroy.sh"   'empty_stack_bucket "${FilesBucketName}"'   "Destroy empties only discovered Files bucket"
assert_contains "${SCRIPT_DIR}/destroy.sh"   'aws cloudformation wait stack-delete-complete'   "Destroy waits for CloudFormation deletion"
assert_contains "${SCRIPT_DIR}/destroy.sh"   'aws s3api delete-bucket'   "Destroy removes the exact derived tooling artifact bucket"

for secret_file in   "${SCRIPT_DIR}/lib/common.sh"   "${SCRIPT_DIR}/build-backend.sh"   "${SCRIPT_DIR}/deploy-infra.sh"   "${SCRIPT_DIR}/deploy-frontend.sh"   "${SCRIPT_DIR}/deploy-all.sh"   "${SCRIPT_DIR}/destroy.sh"
do
  if grep -E '(echo|printf).*JWT_SECRET' "${secret_file}" >/dev/null 2>&1; then
    fail "JWT_SECRET is never printed: ${secret_file}"
  fi
  pass "JWT_SECRET is never printed: ${secret_file}"
done

printf 'All %s tooling contract checks passed.\n' "${pass_count}"
