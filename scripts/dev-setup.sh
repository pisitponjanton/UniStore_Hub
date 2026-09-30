#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/dev-common.sh
source "${SCRIPT_DIR}/lib/dev-common.sh"

validate_app_table_contract() {
  local table_json

  table_json="$(dev_awslocal dynamodb describe-table --table-name "${DEV_APP_TABLE_NAME}" --output json)"

  printf '%s' "${table_json}" | node -e '
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync(0, "utf8"));
const table = payload.Table || {};
const primary = Object.fromEntries(
  (table.KeySchema || []).map((entry) => [entry.AttributeName, entry.KeyType]),
);
const gsi = (table.GlobalSecondaryIndexes || []).find((index) => index.IndexName === "GSI1");
const gsiKeys = Object.fromEntries(
  (gsi?.KeySchema || []).map((entry) => [entry.AttributeName, entry.KeyType]),
);
const failures = [];

if (primary.PK !== "HASH") failures.push("PK must be HASH");
if (primary.SK !== "RANGE") failures.push("SK must be RANGE");
if (!gsi) failures.push("GSI1 is missing");
if (gsiKeys.GSI1PK !== "HASH") failures.push("GSI1PK must be HASH");
if (gsiKeys.GSI1SK !== "RANGE") failures.push("GSI1SK must be RANGE");
if (gsi?.Projection?.ProjectionType !== "ALL") failures.push("GSI1 projection must be ALL");
if (table.BillingModeSummary?.BillingMode !== "PAY_PER_REQUEST") failures.push("billing mode must be PAY_PER_REQUEST");

if (failures.length > 0) {
  console.error(`[ERROR] Local DynamoDB table contract mismatch: ${failures.join("; ")}`);
  process.exit(1);
}
' || die "Existing local DynamoDB table does not match the canonical Dev/Data contract."
}

ensure_app_table() {
  if dev_awslocal dynamodb describe-table --table-name "${DEV_APP_TABLE_NAME}" >/dev/null 2>&1; then
    log_info "Local DynamoDB table already exists: ${DEV_APP_TABLE_NAME}"
  else
    log_info "Creating local DynamoDB table: ${DEV_APP_TABLE_NAME}"
    dev_awslocal dynamodb create-table \
      --table-name "${DEV_APP_TABLE_NAME}" \
      --billing-mode PAY_PER_REQUEST \
      --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=GSI1PK,AttributeType=S \
        AttributeName=GSI1SK,AttributeType=S \
      --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
      --global-secondary-indexes \
        'IndexName=GSI1,KeySchema=[{AttributeName=GSI1PK,KeyType=HASH},{AttributeName=GSI1SK,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
      >/dev/null
  fi

  dev_awslocal dynamodb wait table-exists --table-name "${DEV_APP_TABLE_NAME}"
  validate_app_table_contract
}

ensure_files_bucket() {
  if dev_awslocal s3api head-bucket     --bucket "${DEV_FILES_BUCKET_NAME}" >/dev/null 2>&1; then
    log_info "Local Files bucket already exists: ${DEV_FILES_BUCKET_NAME}"
  else
    log_info "Creating local Files bucket: ${DEV_FILES_BUCKET_NAME}"
    dev_awslocal s3api create-bucket       --bucket "${DEV_FILES_BUCKET_NAME}" >/dev/null
  fi

  log_info "Applying local Files bucket CORS"
  dev_awslocal s3api put-bucket-cors     --bucket "${DEV_FILES_BUCKET_NAME}"     --cors-configuration       '{"CORSRules":[{"AllowedOrigins":["http://localhost:3000"],"AllowedMethods":["GET","PUT","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]}'     >/dev/null
}

ensure_notification_queue() {
  local queue_url

  queue_url="$(
    dev_awslocal sqs get-queue-url       --queue-name "${DEV_NOTIFICATION_QUEUE_NAME}"       --query QueueUrl       --output text 2>/dev/null || true
  )"

  if [[ -z "${queue_url}" || "${queue_url}" == "None" ]]; then
    log_info "Creating local Notification queue: ${DEV_NOTIFICATION_QUEUE_NAME}"
    queue_url="$(
      dev_awslocal sqs create-queue         --queue-name "${DEV_NOTIFICATION_QUEUE_NAME}"         --attributes VisibilityTimeout=120         --query QueueUrl         --output text
    )"
  else
    log_info "Local Notification queue already exists: ${DEV_NOTIFICATION_QUEUE_NAME}"
  fi

  [[ -n "${queue_url}" && "${queue_url}" != "None" ]]     || die "Local Notification queue URL could not be resolved."

  dev_awslocal sqs set-queue-attributes     --queue-url "${queue_url}"     --attributes VisibilityTimeout=120 >/dev/null

  NOTIFICATION_QUEUE_URL="${queue_url}"
  export NOTIFICATION_QUEUE_URL
}

dev_validate_local_contract
dev_require_docker_compose
require_command curl
require_command node
mkdir -p "${DEV_STATE_DIR}"

log_info "Starting or resuming LocalStack"
dev_compose unpause localstack >/dev/null 2>&1 || true
dev_compose up -d localstack

dev_wait_for_localstack

ensure_app_table
ensure_files_bucket
ensure_notification_queue

dev_export_environment
dev_write_non_secret_outputs

log_info "Local Dev dependencies are ready."
dev_print_non_secret_outputs
