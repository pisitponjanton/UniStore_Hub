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
# Frontend static export and S3 Website upload never require the JWT secret.
# Do not forward it to npm/build, AWS CLI or any other child process.
unset JWT_SECRET

require_supported_build_node
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
require_file "${SCRIPT_DIR}/lib/frontend-release-manifest.cjs"

# The canonical --delete upload stays as documented for Learner Lab,
# but first capture the current S3 Website state for a manual rollback.
# Never auto-rollback or delete the previous snapshot on an upload error.
umask 077
RELEASE_ROOT="${SCRIPT_DIR}/.releases"
mkdir -p "${RELEASE_ROOT}"
RELEASE_DIR="$(mktemp -d "${RELEASE_ROOT}/frontend.XXXXXX")"
mkdir -p "${RELEASE_DIR}/previous"
printf '%s\n' "${FrontendBucketName}" > "${RELEASE_DIR}/frontend-bucket.txt"
printf '%s\n' "${STACK_NAME}" > "${RELEASE_DIR}/stack-name.txt"

log_info "Backing up the current Frontend Website before sync"
aws s3 sync "s3://${FrontendBucketName}" "${RELEASE_DIR}/previous"   --region "${AWS_REGION}"   || die "Frontend pre-sync backup failed. Upload stopped. Inspect: ${RELEASE_DIR}"

node "${SCRIPT_DIR}/lib/frontend-release-manifest.cjs" create   "${RELEASE_DIR}/previous" "${RELEASE_DIR}/previous-manifest.json"   || die "Unable to record Frontend pre-sync snapshot."
node "${SCRIPT_DIR}/lib/frontend-release-manifest.cjs" create   "${FRONTEND_OUT_DIR}" "${RELEASE_DIR}/candidate-manifest.json"   || die "Unable to record candidate Frontend manifest."

log_info "Private Frontend recovery snapshot: ${RELEASE_DIR}"
log_warn "Snapshot is local only. Restore requires explicit approval and live AWS validation."

log_info "Syncing frontend/out to FrontendBucketName: ${FrontendBucketName}"
aws s3 sync   "${FRONTEND_OUT_DIR}"   "s3://${FrontendBucketName}"   --delete   --region "${AWS_REGION}"   || die "Frontend S3 sync failed for bucket ${FrontendBucketName}. Restore manually from ${RELEASE_DIR} after approval."

log_info "Frontend deployment completed: s3://${FrontendBucketName}"
