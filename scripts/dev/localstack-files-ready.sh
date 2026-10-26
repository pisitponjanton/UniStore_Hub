#!/usr/bin/env bash
# LocalStack ready hook: restore the private Files bucket and browser CORS after
# every LocalStack restart. Safe to run repeatedly; does not reset objects/data.
set -euo pipefail

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

bucket="${FILES_BUCKET_NAME:-unistore-hub-files-local}"
endpoint="${AWS_ENDPOINT_URL:-http://localhost:4566}"
aws_local() {
  awslocal --endpoint-url "${endpoint}" --region "${AWS_DEFAULT_REGION}" "$@"
}

if ! aws_local s3api head-bucket --bucket "${bucket}" >/dev/null 2>&1; then
  aws_local s3api create-bucket --bucket "${bucket}" >/dev/null
  echo "[localstack-files] Created bucket: ${bucket}"
fi

aws_local s3api put-bucket-cors --bucket "${bucket}" --cors-configuration   '{"CORSRules":[{"AllowedOrigins":["http://localhost:3000","http://127.0.0.1:3000"],"AllowedMethods":["GET","PUT","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]}' >/dev/null

echo "[localstack-files] Ready: ${bucket} with browser GET/PUT/HEAD CORS"
