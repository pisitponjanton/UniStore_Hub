#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/dev-common.sh
source "${SCRIPT_DIR}/lib/dev-common.sh"

FRONTEND_DIR="$(repo_path frontend)"
BACKEND_DIR="$(repo_path backend)"

FRONTEND_PID=""
BACKEND_PID=""
WORKER_PID=""
STOPPING=false

package_has_script() {
  local package_file="${1:?package file is required}"
  local script_name="${2:?script name is required}"

  node - "${package_file}" "${script_name}" <<'NODE'
const fs = require('node:fs');

const packageFile = process.argv[2];
const scriptName = process.argv[3];
const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));

process.exit(
  typeof pkg.scripts?.[scriptName] === 'string' &&
  pkg.scripts[scriptName].trim().length > 0
    ? 0
    : 1,
);
NODE
}

require_package_script() {
  local package_file="${1:?package file is required}"
  local script_name="${2:?script name is required}"
  local label="${3:?label is required}"

  package_has_script "${package_file}" "${script_name}"     || die "${label} npm script is required: ${script_name}"
}

resolve_worker_script() {
  local requested_script="${DEV_BACKEND_WORKER_SCRIPT:-}"
  local candidate

  if [[ -n "${requested_script}" ]]; then
    require_package_script       "${BACKEND_DIR}/package.json"       "${requested_script}"       "Backend local Worker"
    printf '%s\n' "${requested_script}"
    return 0
  fi

  for candidate in worker:dev dev:worker; do
    if package_has_script "${BACKEND_DIR}/package.json" "${candidate}"; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  die "Backend local Worker npm script is missing. Backend must expose worker:dev or dev:worker and reuse the shared src/worker.js processing logic."
}

require_port_available() {
  local port="${1:?port is required}"
  local label="${2:?label is required}"

  node - "${port}" "${label}" <<'NODE'
const net = require('node:net');

const port = Number(process.argv[2]);
const label = process.argv[3];
const server = net.createServer();

server.once('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`[ERROR] ${label} port ${port} is already in use. Stop the conflicting local service before starting UniStore Hub Dev Mode.`);
  } else {
    console.error(`[ERROR] Unable to verify ${label} port ${port}: ${error?.message || error}`);
  }
  process.exit(1);
});

server.listen({ port, host: '0.0.0.0', exclusive: true }, () => {
  server.close(() => process.exit(0));
});
NODE
}

stop_children() {
  local pid current_pid

  if [[ "${STOPPING}" == "true" ]]; then
    return
  fi
  STOPPING=true

  for pid in "${FRONTEND_PID}" "${BACKEND_PID}" "${WORKER_PID}"; do
    if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
      kill "${pid}" >/dev/null 2>&1 || true
    fi
  done

  for pid in "${FRONTEND_PID}" "${BACKEND_PID}" "${WORKER_PID}"; do
    if [[ -n "${pid}" ]]; then
      wait "${pid}" >/dev/null 2>&1 || true
    fi
  done

  if [[ -f "${DEV_RUN_PID_FILE}" ]]; then
    current_pid="$(cat "${DEV_RUN_PID_FILE}" 2>/dev/null || true)"
    if [[ "${current_pid}" == "$$" ]]; then
      rm -f "${DEV_RUN_PID_FILE}"
    fi
  fi
}

trap stop_children EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

require_command node
require_command npm
require_file "${FRONTEND_DIR}/package.json"
require_file "${BACKEND_DIR}/package.json"

require_package_script "${FRONTEND_DIR}/package.json" dev "Frontend"
require_package_script "${BACKEND_DIR}/package.json" dev "Backend"
WORKER_SCRIPT="$(resolve_worker_script)"
require_port_available 3000 "Frontend"
require_port_available 4000 "Backend"

# dev-setup is idempotent, so using it here keeps one-command development safe
# while preserving any existing local data.
bash "${SCRIPT_DIR}/dev-setup.sh"

NOTIFICATION_QUEUE_URL="$(
  dev_awslocal sqs get-queue-url     --queue-name "${DEV_NOTIFICATION_QUEUE_NAME}"     --query QueueUrl     --output text
)"
[[ -n "${NOTIFICATION_QUEUE_URL}" && "${NOTIFICATION_QUEUE_URL}" != "None" ]]   || die "Unable to resolve local Notification queue URL."

export NOTIFICATION_QUEUE_URL
dev_export_environment

mkdir -p "${DEV_STATE_DIR}"
(
  umask 077
  printf '%s\n' "$$" > "${DEV_RUN_PID_FILE}"
)

log_info "Starting Frontend at ${DEV_FRONTEND_URL}"
(
  cd "${FRONTEND_DIR}"
  export PORT=3000
  export NEXT_PUBLIC_API_BASE_URL="${DEV_API_BASE_URL}"
  unset     AWS_ACCESS_KEY_ID     AWS_SECRET_ACCESS_KEY     AWS_ENDPOINT_URL     AWS_REGION     AWS_DEFAULT_REGION     APP_TABLE_NAME     FILES_BUCKET_NAME     NOTIFICATION_QUEUE_URL     JWT_SECRET     JWT_EXPIRES_IN
  exec npm run dev
) &
FRONTEND_PID=$!

log_info "Starting Backend at ${DEV_BACKEND_URL}"
(
  cd "${BACKEND_DIR}"
  export PORT=4000
  exec npm run dev
) &
BACKEND_PID=$!

log_info "Starting local Notification Worker via Backend npm script: ${WORKER_SCRIPT}"
(
  cd "${BACKEND_DIR}"
  unset PORT
  exec npm run "${WORKER_SCRIPT}"
) &
WORKER_PID=$!

log_info "Dev Mode is running. Press Ctrl+C to stop application processes without deleting LocalStack data."
dev_print_non_secret_outputs

while :; do
  if ! kill -0 "${FRONTEND_PID}" >/dev/null 2>&1; then
    set +e
    wait "${FRONTEND_PID}"
    exit_status=$?
    set -e
    log_warn "Frontend process exited with status ${exit_status}; stopping Dev Mode."
    exit "${exit_status}"
  fi

  if ! kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    set +e
    wait "${BACKEND_PID}"
    exit_status=$?
    set -e
    log_warn "Backend process exited with status ${exit_status}; stopping Dev Mode."
    exit "${exit_status}"
  fi

  if ! kill -0 "${WORKER_PID}" >/dev/null 2>&1; then
    set +e
    wait "${WORKER_PID}"
    exit_status=$?
    set -e
    log_warn "Local Worker process exited with status ${exit_status}; stopping Dev Mode."
    exit "${exit_status}"
  fi

  sleep 1
done
