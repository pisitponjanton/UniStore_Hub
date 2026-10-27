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
# Retain the shell variable but prevent accidental inheritance by validation,
# package or other AWS CLI subprocesses. Only the Node JSON writer gets it.
export -n JWT_SECRET
validate_deployment_baseline
validate_aws_identity

ARTIFACT_BUCKET="unistore-hub-cfn-artifacts-${AWS_ACCOUNT_ID}-${AWS_REGION}"
ensure_packaging_bucket "${ARTIFACT_BUCKET}"

# Validate the canonical source before any upload. CloudFormation's service
# validator needs the *packaged* Lambda Code S3 location, not a local path.
require_command python3
log_info "Validating local CloudFormation source contract"
python3 "$(repo_path infrastructure/validate_infrastructure.py)" >/dev/null \
  || die "Local CloudFormation source validation failed."

# Keep deployment parameters private and ephemeral. The JSON file
# is passed by path, never JWT_SECRET on the AWS CLI command line.
umask 077
cleanup_dir="$(mktemp -d "${SCRIPTS_DIR}/.deploy-infra.XXXXXX")"
PACKAGED_TEMPLATE="${cleanup_dir}/packaged-template.yaml"
DEPLOY_PARAMETERS="${cleanup_dir}/parameters.json"

# JSON.stringify preserves JWT input safely even with spaces and quotes.
# Pass the verified secret to Node even if the caller did not export it;
# only the JSON-writing child needs this environment variable.
require_command node
STAGE_NAME="${STAGE_NAME}" JWT_SECRET="${JWT_SECRET}" JWT_EXPIRES_IN="${JWT_EXPIRES_IN}" node - "${DEPLOY_PARAMETERS}" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
fs.writeFileSync(file, JSON.stringify([
  { ParameterKey: 'StageName', ParameterValue: process.env.STAGE_NAME },
  { ParameterKey: 'JWTSecret', ParameterValue: process.env.JWT_SECRET },
  { ParameterKey: 'JWTExpiresIn', ParameterValue: process.env.JWT_EXPIRES_IN },
]), { mode: 0o600, flag: 'wx' });
NODE

log_info "Packaging CloudFormation template"
aws cloudformation package   --template-file "${INFRA_TEMPLATE}"   --s3-bucket "${ARTIFACT_BUCKET}"   --output-template-file "${PACKAGED_TEMPLATE}"   --region "${AWS_REGION}"   || die "CloudFormation package failed for stack ${STACK_NAME} in ${AWS_REGION}."

require_file "${PACKAGED_TEMPLATE}"

log_info "Validating packaged CloudFormation template with AWS"
aws cloudformation validate-template \
  --template-body "file://${PACKAGED_TEMPLATE}" \
  --region "${AWS_REGION}" >/dev/null \
  || die "Packaged CloudFormation validation failed: ${PACKAGED_TEMPLATE}"

log_info "Deploying CloudFormation stack ${STACK_NAME} in ${AWS_REGION}"
# CLI v2 supports file:// JSON parameter overrides. Do not forward the
# secret in the AWS CLI child process environment.
env -u JWT_SECRET aws cloudformation deploy   --template-file "${PACKAGED_TEMPLATE}"   --stack-name "${STACK_NAME}"   --region "${AWS_REGION}"   --parameter-overrides "file://${DEPLOY_PARAMETERS}"   --no-fail-on-empty-changeset   || die "CloudFormation deploy failed for stack ${STACK_NAME} in ${AWS_REGION}. The stack was not automatically deleted."

load_stack_outputs

log_info "Infrastructure deployment completed for stack ${STACK_NAME} in ${AWS_REGION}"