#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/stack-outputs.sh
source "${SCRIPT_DIR}/lib/stack-outputs.sh"

INFRA_TEMPLATE="$(repo_path infrastructure/template.yaml)"
BACKEND_ARTIFACT_DIR="$(repo_path backend/.build/lambda)"

export AWS_PAGER=""

cleanup_dir=""
cleanup() {
  if [[ -n "${cleanup_dir}" && -d "${cleanup_dir}" ]]; then
    rm -rf "${cleanup_dir}"
  fi
}
trap cleanup EXIT

ensure_packaging_bucket() {
  local bucket_name="${1:?bucket name is required}"

  if aws s3api head-bucket     --bucket "${bucket_name}"     --region "${AWS_REGION}" >/dev/null 2>&1; then
    log_info "CloudFormation artifact bucket is accessible: ${bucket_name}"
  else
    log_info "Creating CloudFormation artifact bucket: ${bucket_name}"

    # us-east-1 must omit LocationConstraint.
    aws s3api create-bucket       --bucket "${bucket_name}"       --region "${AWS_REGION}" >/dev/null       || die "Unable to create CloudFormation artifact bucket: ${bucket_name}. Check Learner Lab S3 permissions and bucket accessibility."
  fi

  aws s3api put-public-access-block     --bucket "${bucket_name}"     --region "${AWS_REGION}"     --public-access-block-configuration       BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true     >/dev/null     || die "Unable to enforce Public Access Block on CloudFormation artifact bucket: ${bucket_name}"
}

require_command aws
require_file "${INFRA_TEMPLATE}"
require_directory "${BACKEND_ARTIFACT_DIR}"
require_file "${BACKEND_ARTIFACT_DIR}/package.json"
require_file "${BACKEND_ARTIFACT_DIR}/package-lock.json"
require_file "${BACKEND_ARTIFACT_DIR}/src/lambda.js"
require_file "${BACKEND_ARTIFACT_DIR}/src/worker.js"
require_directory "${BACKEND_ARTIFACT_DIR}/node_modules"
require_deployment_secret
validate_deployment_baseline
validate_aws_identity

ARTIFACT_BUCKET="unistore-hub-cfn-artifacts-${AWS_ACCOUNT_ID}-${AWS_REGION}"
ensure_packaging_bucket "${ARTIFACT_BUCKET}"

log_info "Validating CloudFormation template"
aws cloudformation validate-template   --template-body "file://${INFRA_TEMPLATE}"   --region "${AWS_REGION}" >/dev/null   || die "CloudFormation template validation failed: ${INFRA_TEMPLATE}"

cleanup_dir="$(mktemp -d "${SCRIPTS_DIR}/.deploy-infra.XXXXXX")"
PACKAGED_TEMPLATE="${cleanup_dir}/packaged-template.yaml"

log_info "Packaging CloudFormation template"
aws cloudformation package   --template-file "${INFRA_TEMPLATE}"   --s3-bucket "${ARTIFACT_BUCKET}"   --output-template-file "${PACKAGED_TEMPLATE}"   --region "${AWS_REGION}"   || die "CloudFormation package failed for stack ${STACK_NAME} in ${AWS_REGION}."

require_file "${PACKAGED_TEMPLATE}"

log_info "Deploying CloudFormation stack ${STACK_NAME} in ${AWS_REGION}"
aws cloudformation deploy   --template-file "${PACKAGED_TEMPLATE}"   --stack-name "${STACK_NAME}"   --region "${AWS_REGION}"   --parameter-overrides     "StageName=${STAGE_NAME}"     "JWTSecret=${JWT_SECRET}"     "JWTExpiresIn=${JWT_EXPIRES_IN}"   --no-fail-on-empty-changeset   || die "CloudFormation deploy failed for stack ${STACK_NAME} in ${AWS_REGION}. The stack was not automatically deleted."

load_stack_outputs

log_info "Infrastructure deployment completed for stack ${STACK_NAME} in ${AWS_REGION}"