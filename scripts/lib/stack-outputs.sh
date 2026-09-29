#!/usr/bin/env bash

# CloudFormation output discovery for UniStore Hub.
# Reads outputs by OutputKey, never by physical resource-name assumptions.

if ! declare -F die >/dev/null 2>&1; then
  _STACK_OUTPUTS_LIB_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=common.sh
  source "${_STACK_OUTPUTS_LIB_DIR}/common.sh"
fi

load_stack_outputs() {
  require_command aws
  validate_stack_name
  validate_aws_region

  local outputs
  outputs="$(
    aws cloudformation describe-stacks       --stack-name "${STACK_NAME}"       --region "${AWS_REGION}"       --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]'       --output text 2>/dev/null
  )" || die "Unable to read CloudFormation outputs for stack ${STACK_NAME} in ${AWS_REGION}."

  [[ -n "${outputs}" ]]     || die "CloudFormation stack ${STACK_NAME} has no outputs."

  # Clear values first so stale shell variables cannot satisfy validation.
  FrontendBucketName=""
  FrontendWebsiteURL=""
  FilesBucketName=""
  AppTableName=""
  NotificationQueueURL=""
  BackendFunctionName=""
  WorkerFunctionName=""
  ApiBaseURL=""

  local output_key output_value
  while IFS=$'\t' read -r output_key output_value; do
    case "${output_key}" in
      FrontendBucketName) FrontendBucketName="${output_value}" ;;
      FrontendWebsiteURL) FrontendWebsiteURL="${output_value}" ;;
      FilesBucketName) FilesBucketName="${output_value}" ;;
      AppTableName) AppTableName="${output_value}" ;;
      NotificationQueueURL) NotificationQueueURL="${output_value}" ;;
      BackendFunctionName) BackendFunctionName="${output_value}" ;;
      WorkerFunctionName) WorkerFunctionName="${output_value}" ;;
      ApiBaseURL) ApiBaseURL="${output_value}" ;;
    esac
  done <<< "${outputs}"

  local required_key
  for required_key in     FrontendBucketName     FrontendWebsiteURL     FilesBucketName     AppTableName     NotificationQueueURL     BackendFunctionName     WorkerFunctionName     ApiBaseURL
  do
    if [[ -z "${!required_key:-}" || "${!required_key}" == "None" ]]; then
      die "Required CloudFormation output is missing or empty: ${required_key}"
    fi
  done

  export     FrontendBucketName     FrontendWebsiteURL     FilesBucketName     AppTableName     NotificationQueueURL     BackendFunctionName     WorkerFunctionName     ApiBaseURL

  log_info "Loaded required CloudFormation outputs for stack ${STACK_NAME}"
}
