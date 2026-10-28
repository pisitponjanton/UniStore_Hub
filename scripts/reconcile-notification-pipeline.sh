#!/usr/bin/env bash
# Repair only the expected UniStore Hub SQS -> Lambda mapping after deployment.
# Strictly scoped to the authorized Learner Lab account and stack outputs.
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/stack-outputs.sh
source "${SCRIPT_DIR}/lib/stack-outputs.sh"

export AWS_PAGER=""
require_command aws
validate_deployment_baseline
validate_aws_identity
load_stack_outputs

queue_arn="$(aws sqs get-queue-attributes \
  --queue-url "${NotificationQueueURL}" --attribute-names QueueArn \
  --region "${AWS_REGION}" --query 'Attributes.QueueArn' --output text)" \
  || die "Unable to read the notification queue ARN."

[[ -n "${queue_arn}" && "${queue_arn}" != "None" ]] \
  || die "Notification queue ARN is missing."

mapping_count="$(aws lambda list-event-source-mappings \
  --function-name "${WorkerFunctionName}" --event-source-arn "${queue_arn}" \
  --region "${AWS_REGION}" --query 'length(EventSourceMappings)' --output text)" \
  || die "Unable to inspect the expected Notification Worker event source mapping."

[[ "${mapping_count}" == "1" ]] \
  || die "Expected exactly one mapping for the deployed Worker and SQS queue; found ${mapping_count}."

mapping_uuid="$(aws lambda list-event-source-mappings \
  --function-name "${WorkerFunctionName}" --event-source-arn "${queue_arn}" \
  --region "${AWS_REGION}" --query 'EventSourceMappings[0].UUID' --output text)" \
  || die "Unable to resolve the verified event source mapping UUID."
[[ "${mapping_uuid}" =~ ^[a-f0-9-]{36}$ ]] || die "Invalid mapping UUID."

read_state() {
  aws lambda get-event-source-mapping --uuid "${mapping_uuid}" \
    --region "${AWS_REGION}" --query State --output text
}

mapping_state="$(read_state)" || die "Unable to read event source mapping state."
case "${mapping_state}" in
  Enabled)
    log_info "Notification Worker mapping is already Enabled."
    ;;
  Disabled)
    log_warn "Detected disabled SQS -> Worker mapping; re-enabling the verified resource."
    aws lambda update-event-source-mapping \
      --uuid "${mapping_uuid}" --enabled --region "${AWS_REGION}" \
      --query '{State:State}' --output json \
      || die "Unable to re-enable Notification Worker mapping."
    ;;
  *)
    die "Event source mapping in unexpected state ${mapping_state}; refusing to modify."
    ;;
esac

# AWS can report Enabling briefly after the successful update. Poll with a bound
# rather than assuming that a successful API response means the worker is ready.
for attempt in {1..15}; do
  mapping_state="$(read_state)" || die "Unable to verify event source mapping."
  if [[ "${mapping_state}" == "Enabled" ]]; then
    log_info "Notification Worker mapping is Enabled."
    bash "${SCRIPT_DIR}/verify-notification-pipeline.sh" \
      || die "Notification pipeline post-repair verification failed."
    exit 0
  fi
  [[ "${mapping_state}" == "Enabling" ]] \
    || die "Mapping entered unexpected state ${mapping_state}."
  sleep 3
done

die "Timed out awaiting the mapping to become Enabled."
