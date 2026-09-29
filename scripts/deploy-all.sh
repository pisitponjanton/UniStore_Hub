#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/stack-outputs.sh
source "${SCRIPT_DIR}/lib/stack-outputs.sh"

health_check() {
  local health_url="${1:?health URL is required}"

  log_info "Checking Backend health: ${health_url}"

  node - "${health_url}" <<'NODE'
const healthUrl = process.argv[2];

async function main() {
  let response;

  try {
    response = await fetch(healthUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error(`[ERROR] Health request failed: ${error.message}`);
    process.exit(1);
  }

  if (!response.ok) {
    console.error(`[ERROR] Health request returned HTTP ${response.status}.`);
    process.exit(1);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    console.error('[ERROR] Health response is not valid JSON.');
    process.exit(1);
  }

  if (body?.success !== true || body?.data?.status !== 'ok') {
    console.error('[ERROR] Health response does not match the required healthy contract.');
    process.exit(1);
  }

  console.error('[INFO] Backend health check passed.');
}

main();
NODE
}

require_command node
require_command npm
require_command aws

require_file "$(repo_path backend/package.json)"
require_file "$(repo_path backend/package-lock.json)"
require_file "$(repo_path infrastructure/template.yaml)"
require_file "$(repo_path frontend/package.json)"
require_file "$(repo_path frontend/package-lock.json)"

require_deployment_secret
validate_deployment_baseline

# Validate the active Learner Lab session before any AWS-changing step.
validate_aws_identity

log_info "Step 1/5: build and verify Backend/Worker artifact"
bash "${SCRIPT_DIR}/build-backend.sh"

log_info "Step 2/5: package and deploy AWS infrastructure"
bash "${SCRIPT_DIR}/deploy-infra.sh"

log_info "Step 3/5: load deployed stack outputs"
load_stack_outputs

log_info "Step 4/5: build and sync Frontend static export"
export ApiBaseURL FrontendBucketName
bash "${SCRIPT_DIR}/deploy-frontend.sh"

HEALTH_URL="${ApiBaseURL%/}/health"

log_info "Step 5/5: verify deployed Backend"
health_check "${HEALTH_URL}"

printf '\nUniStore Hub deployment complete\n'
printf 'Stack Name: %s\n' "${STACK_NAME}"
printf 'Region: %s\n' "${AWS_REGION}"
printf 'Frontend URL: %s\n' "${FrontendWebsiteURL}"
printf 'API Base URL: %s\n' "${ApiBaseURL}"
printf 'Health URL: %s\n' "${HEALTH_URL}"
printf 'Backend Function: %s\n' "${BackendFunctionName}"
printf 'Worker Function: %s\n' "${WorkerFunctionName}"
printf 'App Table: %s\n' "${AppTableName}"
printf 'Files Bucket: %s\n' "${FilesBucketName}"
printf 'Notification Queue: %s\n' "${NotificationQueueURL}"
