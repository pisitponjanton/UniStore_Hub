#!/usr/bin/env bash

# Shared helpers for UniStore Hub deployment/tooling scripts.
# This file is sourced by scripts under scripts/**. Keep it free of
# subsystem-specific build/deploy logic.

# Never allow caller xtrace to expose secrets handled by deployment scripts.
set +x

_DEPLOY_LIB_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd -- "${_DEPLOY_LIB_DIR}/.." && pwd)"
REPO_ROOT="$(cd -- "${SCRIPTS_DIR}/.." && pwd)"

readonly DEPLOY_DEFAULT_AWS_REGION="us-east-1"
readonly DEPLOY_DEFAULT_STACK_NAME="unistore-hub-dev"
readonly DEPLOY_DEFAULT_STAGE_NAME="dev"
readonly DEPLOY_DEFAULT_JWT_EXPIRES_IN="1d"

STACK_NAME="${STACK_NAME:-${DEPLOY_DEFAULT_STACK_NAME}}"
STAGE_NAME="${STAGE_NAME:-${DEPLOY_DEFAULT_STAGE_NAME}}"
JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-${DEPLOY_DEFAULT_JWT_EXPIRES_IN}}"

log_info() {
  printf '[INFO] %s\n' "$*" >&2
}

log_warn() {
  printf '[WARN] %s\n' "$*" >&2
}

die() {
  printf '[ERROR] %s\n' "$*" >&2
  exit 1
}

require_command() {
  local command_name="${1:?command name is required}"

  command -v "${command_name}" >/dev/null 2>&1     || die "Required command not found: ${command_name}"
}

require_file() {
  local file_path="${1:?file path is required}"

  [[ -f "${file_path}" ]]     || die "Required file not found: ${file_path}"
}

require_directory() {
  local directory_path="${1:?directory path is required}"

  [[ -d "${directory_path}" ]]     || die "Required directory not found: ${directory_path}"
}

require_env() {
  local variable_name="${1:?environment variable name is required}"

  [[ -n "${!variable_name:-}" ]]     || die "Required environment variable is not set: ${variable_name}"
}

require_secret_env() {
  local variable_name="${1:?secret environment variable name is required}"

  # Intentionally report only the variable name, never its value.
  require_env "${variable_name}"
}

validate_stack_name() {
  [[ "${STACK_NAME}" == "${DEPLOY_DEFAULT_STACK_NAME}" ]]     || die "STACK_NAME must be ${DEPLOY_DEFAULT_STACK_NAME}; got: ${STACK_NAME}"
}

validate_stage_name() {
  [[ "${STAGE_NAME}" == "${DEPLOY_DEFAULT_STAGE_NAME}" ]]     || die "STAGE_NAME must be ${DEPLOY_DEFAULT_STAGE_NAME}; got: ${STAGE_NAME}"
}

_resolve_configured_region() {
  local configured_region=""

  if [[ -n "${AWS_REGION:-}" ]]; then
    configured_region="${AWS_REGION}"
  elif [[ -n "${AWS_DEFAULT_REGION:-}" ]]; then
    configured_region="${AWS_DEFAULT_REGION}"
  elif command -v aws >/dev/null 2>&1; then
    configured_region="$(aws configure get region 2>/dev/null || true)"
  fi

  if [[ -z "${configured_region}" ]]; then
    configured_region="${DEPLOY_DEFAULT_AWS_REGION}"
  fi

  printf '%s\n' "${configured_region}"
}

validate_aws_region() {
  local configured_region

  configured_region="$(_resolve_configured_region)"

  [[ "${configured_region}" == "${DEPLOY_DEFAULT_AWS_REGION}" ]]     || die "AWS region must be ${DEPLOY_DEFAULT_AWS_REGION}; current region is ${configured_region}"

  AWS_REGION="${DEPLOY_DEFAULT_AWS_REGION}"
  export AWS_REGION

  log_info "AWS region: ${AWS_REGION}"
}

validate_aws_identity() {
  local account_id caller_arn

  require_command aws

  account_id="$(
    aws sts get-caller-identity       --query Account       --output text       --region "${AWS_REGION:-${DEPLOY_DEFAULT_AWS_REGION}}" 2>/dev/null
  )" || die "Unable to read AWS identity. Refresh/restart AWS Academy Learner Lab credentials and try again."

  [[ -n "${account_id}" && "${account_id}" != "None" ]]     || die "AWS identity returned an invalid account ID."

  caller_arn="$(
    aws sts get-caller-identity       --query Arn       --output text       --region "${AWS_REGION:-${DEPLOY_DEFAULT_AWS_REGION}}" 2>/dev/null
  )" || die "Unable to read AWS caller ARN."

  AWS_ACCOUNT_ID="${account_id}"
  AWS_CALLER_ARN="${caller_arn}"
  export AWS_ACCOUNT_ID AWS_CALLER_ARN

  log_info "AWS account: ${AWS_ACCOUNT_ID}"
  log_info "AWS caller: ${AWS_CALLER_ARN}"
}

validate_deployment_baseline() {
  validate_stack_name
  validate_stage_name
  validate_aws_region
}

require_deployment_secret() {
  require_secret_env JWT_SECRET
}

repo_path() {
  local relative_path="${1:?relative repository path is required}"
  printf '%s/%s\n' "${REPO_ROOT}" "${relative_path}"
}
