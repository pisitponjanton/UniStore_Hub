#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/dev-common.sh
source "${SCRIPT_DIR}/lib/dev-common.sh"

ASSUME_YES=false
RUN_SEED=false

usage() {
  cat <<'USAGE'
Usage: bash scripts/dev-reset.sh [--yes] [--seed]

Resets only the canonical LocalStack development resources.
Without --yes, interactive confirmation is required.

Options:
  --yes   Skip interactive confirmation after all local-only guards pass.
  --seed  Run scripts/dev-seed.sh after the clean local resources are restored.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      ASSUME_YES=true
      shift
      ;;
    --seed)
      RUN_SEED=true
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

# Safety guard resolves AWS_ENDPOINT_URL through dev-common and refuses any
# endpoint that is not exact loopback LocalStack before destructive actions.
dev_validate_local_contract
dev_require_docker_compose

printf '\nLocal Dev reset target\n'
printf 'Endpoint: %s\n' "${DEV_LOCALSTACK_ENDPOINT}"
printf 'Region: %s\n' "${DEV_AWS_REGION}"
printf 'DynamoDB Table: %s\n' "${DEV_APP_TABLE_NAME}"
printf 'Files Bucket: %s\n' "${DEV_FILES_BUCKET_NAME}"
printf 'Notification Queue: %s\n\n' "${DEV_NOTIFICATION_QUEUE_NAME}"

if [[ "${ASSUME_YES}" != "true" ]]; then
  if [[ ! -t 0 ]]; then
    die "Interactive confirmation is unavailable. Re-run with --yes only for an intentional LocalStack reset."
  fi

  printf 'Type "RESET LOCAL DEV" to continue: ' >&2
  IFS= read -r confirmation
  [[ "${confirmation}" == "RESET LOCAL DEV" ]]     || die "Local Dev reset cancelled."
else
  log_warn "Noninteractive --yes accepted after strict LocalStack/resource guards."
fi

if [[ -f "${DEV_RUN_PID_FILE}" ]]; then
  log_info "Stopping managed Dev Mode application processes before reset"
  bash "${SCRIPT_DIR}/dev-down.sh"
fi
log_info "Starting or resuming canonical LocalStack before reset"
dev_compose unpause localstack >/dev/null 2>&1 || true
dev_compose up -d localstack
dev_wait_for_localstack

if dev_awslocal dynamodb describe-table   --table-name "${DEV_APP_TABLE_NAME}" >/dev/null 2>&1; then
  log_info "Deleting local DynamoDB table: ${DEV_APP_TABLE_NAME}"
  dev_awslocal dynamodb delete-table     --table-name "${DEV_APP_TABLE_NAME}" >/dev/null
  dev_awslocal dynamodb wait table-not-exists     --table-name "${DEV_APP_TABLE_NAME}"
else
  log_info "Local DynamoDB table is already absent: ${DEV_APP_TABLE_NAME}"
fi

if dev_awslocal s3api head-bucket   --bucket "${DEV_FILES_BUCKET_NAME}" >/dev/null 2>&1; then
  log_info "Clearing local Files bucket: ${DEV_FILES_BUCKET_NAME}"
  dev_awslocal s3 rm     "s3://${DEV_FILES_BUCKET_NAME}"     --recursive     --only-show-errors
else
  log_info "Local Files bucket is already absent: ${DEV_FILES_BUCKET_NAME}"
fi

QUEUE_URL="$(
  dev_awslocal sqs get-queue-url \
    --queue-name "${DEV_NOTIFICATION_QUEUE_NAME}" \
    --query QueueUrl \
    --output text 2>/dev/null || true
)"

if [[ -n "${QUEUE_URL}" && "${QUEUE_URL}" != "None" ]]; then
  log_info "Clearing local Notification queue: ${DEV_NOTIFICATION_QUEUE_NAME}"

  for ((batch = 1; batch <= 100; batch += 1)); do
    receipt_handles="$(
      dev_awslocal sqs receive-message \
        --queue-url "${QUEUE_URL}" \
        --max-number-of-messages 10 \
        --wait-time-seconds 0 \
        --visibility-timeout 0 \
        --query 'Messages[].ReceiptHandle' \
        --output text 2>/dev/null || true
    )"

    if [[ -z "${receipt_handles}" || "${receipt_handles}" == "None" ]]; then
      break
    fi

    read -r -a handles <<< "${receipt_handles}"
    for receipt_handle in "${handles[@]}"; do
      [[ -n "${receipt_handle}" ]] || continue
      dev_awslocal sqs delete-message \
        --queue-url "${QUEUE_URL}" \
        --receipt-handle "${receipt_handle}"
    done

    if ((batch == 100)); then
      die "Unable to fully drain the local Notification queue after 100 batches."
    fi
  done
else
  log_info "Local Notification queue is already absent: ${DEV_NOTIFICATION_QUEUE_NAME}"
fi

log_info "Restoring canonical local resources"
bash "${SCRIPT_DIR}/dev-setup.sh" >/dev/null

if [[ "${RUN_SEED}" == "true" ]]; then
  log_info "Running deterministic Dev seed after reset"
  bash "${SCRIPT_DIR}/dev-seed.sh"
fi

log_info "Local Dev reset completed."
bash "${SCRIPT_DIR}/dev-outputs.sh"
