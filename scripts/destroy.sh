#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/stack-outputs.sh
source "${SCRIPT_DIR}/lib/stack-outputs.sh"

export AWS_PAGER=""

ASSUME_YES=false

usage() {
  cat <<'USAGE'
Usage: bash scripts/destroy.sh [--yes]

Destroys only the verified UniStore Hub Learner Lab development stack:
  stack:  unistore-hub-dev
  region: us-east-1

Without --yes, interactive confirmation is required.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      ASSUME_YES=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

require_command aws
validate_deployment_baseline
validate_aws_identity

# Reading the complete canonical output set both verifies that the target stack
# exists and provides the only application bucket names this script may empty.
load_stack_outputs

ARTIFACT_BUCKET="unistore-hub-cfn-artifacts-${AWS_ACCOUNT_ID}-${AWS_REGION}"

validate_bucket_name() {
  local label="${1:?label is required}"
  local bucket_name="${2:?bucket name is required}"

  [[ "${bucket_name}" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]]     || die "${label} is not a valid S3 bucket name: ${bucket_name}"
}

validate_bucket_name "FrontendBucketName" "${FrontendBucketName}"
validate_bucket_name "FilesBucketName" "${FilesBucketName}"
validate_bucket_name "Artifact bucket" "${ARTIFACT_BUCKET}"

[[ "${FrontendBucketName}" != "${FilesBucketName}" ]]   || die "FrontendBucketName and FilesBucketName unexpectedly resolve to the same bucket."

[[ "${FrontendBucketName}" != "${ARTIFACT_BUCKET}" ]]   || die "FrontendBucketName unexpectedly matches the tooling artifact bucket."
[[ "${FilesBucketName}" != "${ARTIFACT_BUCKET}" ]]   || die "FilesBucketName unexpectedly matches the tooling artifact bucket."

printf '\nDestructive target verification\n'
printf 'AWS Account: %s\n' "${AWS_ACCOUNT_ID}"
printf 'AWS Caller: %s\n' "${AWS_CALLER_ARN}"
printf 'Region: %s\n' "${AWS_REGION}"
printf 'Stack: %s\n' "${STACK_NAME}"
printf 'Frontend Bucket: %s\n' "${FrontendBucketName}"
printf 'Files Bucket: %s\n' "${FilesBucketName}"
printf 'Tooling Artifact Bucket: %s\n\n' "${ARTIFACT_BUCKET}"

if [[ "${ASSUME_YES}" != "true" ]]; then
  if [[ ! -t 0 ]]; then
    die "Interactive confirmation is unavailable. Re-run with --yes only if noninteractive destruction is intentional."
  fi

  printf 'Type the exact stack name "%s" to continue: ' "${STACK_NAME}" >&2
  IFS= read -r confirmation

  [[ "${confirmation}" == "${STACK_NAME}" ]]     || die "Destroy cancelled; confirmation did not match the stack name."
else
  log_warn "Noninteractive --yes confirmation accepted for verified stack ${STACK_NAME}."
fi

empty_stack_bucket() {
  local bucket_name="${1:?bucket name is required}"

  log_info "Emptying verified stack bucket: ${bucket_name}"
  aws s3 rm     "s3://${bucket_name}"     --recursive     --region "${AWS_REGION}"     || die "Failed to empty verified stack bucket: ${bucket_name}"
}

empty_stack_bucket "${FrontendBucketName}"
empty_stack_bucket "${FilesBucketName}"

log_info "Deleting CloudFormation stack: ${STACK_NAME}"
aws cloudformation delete-stack   --stack-name "${STACK_NAME}"   --region "${AWS_REGION}"   || die "Failed to start deletion for stack ${STACK_NAME}."

log_info "Waiting for stack deletion to complete"
aws cloudformation wait stack-delete-complete   --stack-name "${STACK_NAME}"   --region "${AWS_REGION}"   || die "CloudFormation stack deletion did not complete successfully for ${STACK_NAME}."

# The packaging bucket is the one documented exception to CloudFormation-only
# resource creation. Its exact name is derived from the already-verified
# account ID and fixed region, never from user input or a wildcard.
if aws s3api head-bucket   --bucket "${ARTIFACT_BUCKET}"   --region "${AWS_REGION}" >/dev/null 2>&1; then
  log_info "Emptying tooling artifact bucket: ${ARTIFACT_BUCKET}"
  aws s3 rm     "s3://${ARTIFACT_BUCKET}"     --recursive     --region "${AWS_REGION}"     || die "Failed to empty tooling artifact bucket: ${ARTIFACT_BUCKET}"

  log_info "Deleting tooling artifact bucket: ${ARTIFACT_BUCKET}"
  aws s3api delete-bucket     --bucket "${ARTIFACT_BUCKET}"     --region "${AWS_REGION}"     || die "Failed to delete tooling artifact bucket: ${ARTIFACT_BUCKET}"
else
  log_info "Tooling artifact bucket is not present or not accessible; no artifact bucket was deleted."
fi

log_info "UniStore Hub development stack destroy completed."
