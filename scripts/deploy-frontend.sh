#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/stack-outputs.sh
source "${SCRIPT_DIR}/lib/stack-outputs.sh"

FRONTEND_DIR="$(repo_path frontend)"
FRONTEND_OUT_DIR="${FRONTEND_DIR}/out"

export AWS_PAGER=""

require_command node
require_command npm
require_command aws

require_file "${FRONTEND_DIR}/package.json"
require_file "${FRONTEND_DIR}/package-lock.json"

validate_deployment_baseline

# Standalone deploy:frontend can discover values from CloudFormation.
# deploy-all may pre-populate them after infrastructure deployment.
if [[ -z "${ApiBaseURL:-}" || -z "${FrontendBucketName:-}" ]]; then
  load_stack_outputs
fi

[[ -n "${ApiBaseURL:-}" ]]   || die "ApiBaseURL is required for Frontend deployment."
[[ -n "${FrontendBucketName:-}" ]]   || die "FrontendBucketName is required for Frontend deployment."

NEXT_PUBLIC_API_BASE_URL="${ApiBaseURL%/}/api/v1"
export NEXT_PUBLIC_API_BASE_URL

log_info "Building Frontend against API base: ${NEXT_PUBLIC_API_BASE_URL}"
(
  cd "${FRONTEND_DIR}"
  npm ci
  npm test
  npm run build
)

require_directory "${FRONTEND_OUT_DIR}"
require_file "${FRONTEND_OUT_DIR}/index.html"

log_info "Syncing frontend/out to FrontendBucketName: ${FrontendBucketName}"
aws s3 sync   "${FRONTEND_OUT_DIR}"   "s3://${FrontendBucketName}"   --delete   --region "${AWS_REGION}"   || die "Frontend S3 sync failed for bucket ${FrontendBucketName}."

log_info "Frontend deployment completed: s3://${FrontendBucketName}"
