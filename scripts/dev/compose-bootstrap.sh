#!/usr/bin/env bash
set -euo pipefail
set +x

AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localstack:4566}"
AWS_REGION="${AWS_REGION:-us-east-1}"
APP_TABLE_NAME="${APP_TABLE_NAME:-unistore-hub-dev-local}"
FILES_BUCKET_NAME="${FILES_BUCKET_NAME:-unistore-hub-files-local}"
NOTIFICATION_QUEUE_NAME="${NOTIFICATION_QUEUE_NAME:-unistore-hub-notifications-local}"

aws_local() {
  awslocal --endpoint-url "${AWS_ENDPOINT_URL}" --region "${AWS_REGION}" "$@"
}

echo "[INFO] Waiting for LocalStack at ${AWS_ENDPOINT_URL}"
for attempt in $(seq 1 60); do
  if curl -fsS "${AWS_ENDPOINT_URL}/_localstack/health" >/dev/null 2>&1; then
    break
  fi

  if [[ "${attempt}" == "60" ]]; then
    echo "[ERROR] Timed out waiting for LocalStack" >&2
    exit 1
  fi

  sleep 1
done

if aws_local dynamodb describe-table --table-name "${APP_TABLE_NAME}" >/dev/null 2>&1; then
  echo "[INFO] DynamoDB table already exists: ${APP_TABLE_NAME}"
else
  echo "[INFO] Creating DynamoDB table: ${APP_TABLE_NAME}"
  aws_local dynamodb create-table     --table-name "${APP_TABLE_NAME}"     --billing-mode PAY_PER_REQUEST     --attribute-definitions       AttributeName=PK,AttributeType=S       AttributeName=SK,AttributeType=S       AttributeName=GSI1PK,AttributeType=S       AttributeName=GSI1SK,AttributeType=S     --key-schema       AttributeName=PK,KeyType=HASH       AttributeName=SK,KeyType=RANGE     --global-secondary-indexes       'IndexName=GSI1,KeySchema=[{AttributeName=GSI1PK,KeyType=HASH},{AttributeName=GSI1SK,KeyType=RANGE}],Projection={ProjectionType=ALL}'     >/dev/null
fi

aws_local dynamodb wait table-exists --table-name "${APP_TABLE_NAME}"

if aws_local s3api head-bucket --bucket "${FILES_BUCKET_NAME}" >/dev/null 2>&1; then
  echo "[INFO] Files bucket already exists: ${FILES_BUCKET_NAME}"
else
  echo "[INFO] Creating Files bucket: ${FILES_BUCKET_NAME}"
  aws_local s3api create-bucket --bucket "${FILES_BUCKET_NAME}" >/dev/null
fi

echo "[INFO] Applying local Files bucket CORS"
aws_local s3api put-bucket-cors   --bucket "${FILES_BUCKET_NAME}"   --cors-configuration '{"CORSRules":[{"AllowedOrigins":["http://localhost:3000"],"AllowedMethods":["GET","PUT","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]}'   >/dev/null

queue_url="$(
  aws_local sqs get-queue-url     --queue-name "${NOTIFICATION_QUEUE_NAME}"     --query QueueUrl     --output text 2>/dev/null || true
)"

if [[ -z "${queue_url}" || "${queue_url}" == "None" ]]; then
  echo "[INFO] Creating Notification queue: ${NOTIFICATION_QUEUE_NAME}"
  queue_url="$(
    aws_local sqs create-queue       --queue-name "${NOTIFICATION_QUEUE_NAME}"       --attributes VisibilityTimeout=120       --query QueueUrl       --output text
  )"
else
  echo "[INFO] Notification queue already exists: ${NOTIFICATION_QUEUE_NAME}"
fi

aws_local sqs set-queue-attributes   --queue-url "${queue_url}"   --attributes VisibilityTimeout=120   >/dev/null

echo "[INFO] Compose bootstrap complete"
echo "[INFO] Table: ${APP_TABLE_NAME}"
echo "[INFO] Bucket: ${FILES_BUCKET_NAME}"
echo "[INFO] Queue: ${NOTIFICATION_QUEUE_NAME}"
