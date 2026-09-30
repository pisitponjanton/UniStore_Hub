#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/dev-common.sh
source "${SCRIPT_DIR}/lib/dev-common.sh"

dev_validate_local_contract
dev_wait_for_localstack 10 1

NOTIFICATION_QUEUE_URL="$(
  dev_awslocal sqs get-queue-url     --queue-name "${DEV_NOTIFICATION_QUEUE_NAME}"     --query QueueUrl     --output text
)"
[[ -n "${NOTIFICATION_QUEUE_URL}" && "${NOTIFICATION_QUEUE_URL}" != "None" ]]   || die "Unable to resolve local Notification queue URL."

export NOTIFICATION_QUEUE_URL

# Output is intentionally KEY=value only so it can be consumed by humans,
# shell tooling, and Tests without exposing JWT/password/AWS secret values.
dev_print_non_secret_outputs
