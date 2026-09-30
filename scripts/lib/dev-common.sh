#!/usr/bin/env bash

# Shared helpers for UniStore Hub local Development Mode.
# Keep LocalStack-only configuration isolated from production deployment logic.

if ! declare -F die >/dev/null 2>&1; then
  _DEV_COMMON_LIB_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=common.sh
  source "${_DEV_COMMON_LIB_DIR}/common.sh"
fi

readonly DEV_DEFAULT_AWS_REGION="us-east-1"
readonly DEV_DEFAULT_LOCALSTACK_ENDPOINT="http://localhost:4566"
readonly DEV_DEFAULT_FRONTEND_URL="http://localhost:3000"
readonly DEV_DEFAULT_BACKEND_URL="http://localhost:4000"
readonly DEV_DEFAULT_APP_TABLE_NAME="unistore-hub-dev-local"
readonly DEV_DEFAULT_FILES_BUCKET_NAME="unistore-hub-files-local"
readonly DEV_DEFAULT_NOTIFICATION_QUEUE_NAME="unistore-hub-notifications-local"
readonly DEV_DEFAULT_JWT_EXPIRES_IN="1d"
readonly DEV_DEFAULT_JWT_SECRET="dev-only-secret-change-me"

readonly DEV_COMPOSE_FILE="${SCRIPTS_DIR}/dev/compose.yaml"
readonly DEV_STATE_DIR="${SCRIPTS_DIR}/dev/.state"
readonly DEV_OUTPUTS_FILE="${DEV_STATE_DIR}/outputs.env"
readonly DEV_RUN_PID_FILE="${DEV_STATE_DIR}/dev.pid"

DEV_AWS_REGION="${DEV_AWS_REGION:-${DEV_DEFAULT_AWS_REGION}}"
DEV_LOCALSTACK_ENDPOINT="${AWS_ENDPOINT_URL:-${DEV_DEFAULT_LOCALSTACK_ENDPOINT}}"
DEV_FRONTEND_URL="${DEV_FRONTEND_URL:-${DEV_DEFAULT_FRONTEND_URL}}"
DEV_BACKEND_URL="${DEV_BACKEND_URL:-${DEV_DEFAULT_BACKEND_URL}}"
DEV_API_BASE_URL="${DEV_API_BASE_URL:-${DEV_BACKEND_URL%/}/api/v1}"
DEV_HEALTH_URL="${DEV_HEALTH_URL:-${DEV_BACKEND_URL%/}/health}"
DEV_APP_TABLE_NAME="${APP_TABLE_NAME:-${DEV_DEFAULT_APP_TABLE_NAME}}"
DEV_FILES_BUCKET_NAME="${FILES_BUCKET_NAME:-${DEV_DEFAULT_FILES_BUCKET_NAME}}"
DEV_NOTIFICATION_QUEUE_NAME="${DEV_NOTIFICATION_QUEUE_NAME:-${DEV_DEFAULT_NOTIFICATION_QUEUE_NAME}}"

dev_is_localstack_endpoint() {
  local endpoint="${1:-}"

  case "${endpoint}" in
    "http://localhost:4566"|"http://127.0.0.1:4566"|"http://[::1]:4566")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

dev_validate_region() {
  [[ "${DEV_AWS_REGION}" == "${DEV_DEFAULT_AWS_REGION}" ]] \
    || die "Local Dev AWS region must be ${DEV_DEFAULT_AWS_REGION}; got: ${DEV_AWS_REGION}"
}

dev_require_localstack_endpoint() {
  local endpoint="${1:-${DEV_LOCALSTACK_ENDPOINT}}"

  dev_is_localstack_endpoint "${endpoint}" \
    || die "Refusing local Dev operation: AWS_ENDPOINT_URL must be exact loopback LocalStack on port 4566; got: ${endpoint:-<empty>}"
}

dev_validate_resource_names() {
  [[ "${DEV_APP_TABLE_NAME}" == "${DEV_DEFAULT_APP_TABLE_NAME}" ]]     || die "Local App table must be ${DEV_DEFAULT_APP_TABLE_NAME}; got: ${DEV_APP_TABLE_NAME}"

  [[ "${DEV_FILES_BUCKET_NAME}" == "${DEV_DEFAULT_FILES_BUCKET_NAME}" ]]     || die "Local Files bucket must be ${DEV_DEFAULT_FILES_BUCKET_NAME}; got: ${DEV_FILES_BUCKET_NAME}"

  [[ "${DEV_NOTIFICATION_QUEUE_NAME}" == "${DEV_DEFAULT_NOTIFICATION_QUEUE_NAME}" ]]     || die "Local Notification queue must be ${DEV_DEFAULT_NOTIFICATION_QUEUE_NAME}; got: ${DEV_NOTIFICATION_QUEUE_NAME}"
}

dev_validate_local_contract() {
  dev_validate_region
  dev_require_localstack_endpoint
  dev_validate_resource_names
}

dev_require_docker_compose() {
  require_command docker

  docker compose version >/dev/null 2>&1     || die "Docker Compose v2 is required. Expected: docker compose ..."
}

dev_compose() {
  require_file "${DEV_COMPOSE_FILE}"
  dev_require_docker_compose
  docker compose --file "${DEV_COMPOSE_FILE}" "$@"
}

dev_awslocal() {
  dev_validate_local_contract
  dev_compose exec -T localstack awslocal "$@" --region "${DEV_AWS_REGION}"
}

dev_write_non_secret_outputs() {
  dev_validate_local_contract
  mkdir -p "${DEV_STATE_DIR}"

  (
    umask 077
    dev_print_non_secret_outputs > "${DEV_OUTPUTS_FILE}"
  )

  log_info "Wrote local non-secret outputs: ${DEV_OUTPUTS_FILE}"
}

dev_wait_for_localstack() {
  local attempts="${1:-60}"
  local delay_seconds="${2:-1}"
  local attempt

  require_command curl
  dev_validate_local_contract

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl -fsS "${DEV_LOCALSTACK_ENDPOINT}/_localstack/health" >/dev/null 2>&1; then
      log_info "LocalStack is healthy: ${DEV_LOCALSTACK_ENDPOINT}"
      return 0
    fi

    sleep "${delay_seconds}"
  done

  die "Timed out waiting for LocalStack health at ${DEV_LOCALSTACK_ENDPOINT}"
}

dev_export_environment() {
  dev_validate_local_contract

  AWS_REGION="${DEV_AWS_REGION}"
  AWS_DEFAULT_REGION="${DEV_AWS_REGION}"
  AWS_ENDPOINT_URL="${DEV_LOCALSTACK_ENDPOINT}"
  # Never inherit real host AWS credentials into LocalStack application processes.
  AWS_ACCESS_KEY_ID="test"
  AWS_SECRET_ACCESS_KEY="test"

  NODE_ENV="development"
  PORT="4000"
  APP_TABLE_NAME="${DEV_APP_TABLE_NAME}"
  FILES_BUCKET_NAME="${DEV_FILES_BUCKET_NAME}"
  # Do not inherit a generic JWT_SECRET that may belong to another environment.
  JWT_SECRET="${DEV_JWT_SECRET:-${DEV_DEFAULT_JWT_SECRET}}"
  JWT_EXPIRES_IN="${DEV_JWT_EXPIRES_IN:-${DEV_DEFAULT_JWT_EXPIRES_IN}}"
  CORS_ALLOWED_ORIGINS="${DEV_FRONTEND_URL}"
  NEXT_PUBLIC_API_BASE_URL="${DEV_API_BASE_URL}"

  export     AWS_REGION     AWS_DEFAULT_REGION     AWS_ENDPOINT_URL     AWS_ACCESS_KEY_ID     AWS_SECRET_ACCESS_KEY     NODE_ENV     PORT     APP_TABLE_NAME     FILES_BUCKET_NAME     JWT_SECRET     JWT_EXPIRES_IN     CORS_ALLOWED_ORIGINS     NEXT_PUBLIC_API_BASE_URL

  if [[ -n "${NOTIFICATION_QUEUE_URL:-}" ]]; then
    export NOTIFICATION_QUEUE_URL
  fi
}

dev_print_non_secret_outputs() {
  dev_validate_local_contract

  printf 'DEV_FRONTEND_URL=%s\n' "${DEV_FRONTEND_URL}"
  printf 'DEV_BACKEND_URL=%s\n' "${DEV_BACKEND_URL}"
  printf 'DEV_API_BASE_URL=%s\n' "${DEV_API_BASE_URL}"
  printf 'DEV_HEALTH_URL=%s\n' "${DEV_HEALTH_URL}"
  printf 'AWS_ENDPOINT_URL=%s\n' "${DEV_LOCALSTACK_ENDPOINT}"
  printf 'AWS_REGION=%s\n' "${DEV_AWS_REGION}"
  printf 'APP_TABLE_NAME=%s\n' "${DEV_APP_TABLE_NAME}"
  printf 'FILES_BUCKET_NAME=%s\n' "${DEV_FILES_BUCKET_NAME}"
  printf 'NOTIFICATION_QUEUE_NAME=%s\n' "${DEV_NOTIFICATION_QUEUE_NAME}"

  printf 'TEST_BACKEND_BASE_URL=%s\n' "${DEV_BACKEND_URL}"
  printf 'TEST_API_BASE_URL=%s\n' "${DEV_API_BASE_URL}"
  printf 'TEST_FRONTEND_BASE_URL=%s\n' "${DEV_FRONTEND_URL}"
  printf 'TEST_HEALTH_URL=%s\n' "${DEV_HEALTH_URL}"
  printf 'TEST_AWS_ENDPOINT_URL=%s\n' "${DEV_LOCALSTACK_ENDPOINT}"
  printf 'TEST_AWS_REGION=%s\n' "${DEV_AWS_REGION}"
  printf 'TEST_APP_TABLE_NAME=%s\n' "${DEV_APP_TABLE_NAME}"
  printf 'TEST_FILES_BUCKET_NAME=%s\n' "${DEV_FILES_BUCKET_NAME}"

  printf 'E2E_API_BASE_URL=%s\n' "${DEV_API_BASE_URL}"
  printf 'E2E_AWS_ENDPOINT_URL=%s\n' "${DEV_LOCALSTACK_ENDPOINT}"
  printf 'E2E_AWS_REGION=%s\n' "${DEV_AWS_REGION}"

  if [[ -n "${NOTIFICATION_QUEUE_URL:-}" ]]; then
    printf 'NOTIFICATION_QUEUE_URL=%s\n' "${NOTIFICATION_QUEUE_URL}"
    printf 'TEST_NOTIFICATION_QUEUE_URL=%s\n' "${NOTIFICATION_QUEUE_URL}"
    printf 'E2E_NOTIFICATION_QUEUE_URL=%s\n' "${NOTIFICATION_QUEUE_URL}"
  fi
}
