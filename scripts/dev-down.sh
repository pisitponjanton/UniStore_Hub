#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/dev-common.sh
source "${SCRIPT_DIR}/lib/dev-common.sh"

stop_dev_runner() {
  local dev_pid command_line attempt

  if [[ ! -f "${DEV_RUN_PID_FILE}" ]]; then
    return 0
  fi

  dev_pid="$(cat "${DEV_RUN_PID_FILE}" 2>/dev/null || true)"

  if [[ ! "${dev_pid}" =~ ^[0-9]+$ ]]; then
    log_warn "Removing invalid Dev Mode PID file."
    rm -f "${DEV_RUN_PID_FILE}"
    return 0
  fi

  if ! kill -0 "${dev_pid}" >/dev/null 2>&1; then
    log_info "Removing stale Dev Mode PID file."
    rm -f "${DEV_RUN_PID_FILE}"
    return 0
  fi

  require_command ps
  command_line="$(ps -p "${dev_pid}" -o command= 2>/dev/null || true)"

  case "${command_line}" in
    *"scripts/dev.sh"*|*"${SCRIPTS_DIR}/dev.sh"*)
      ;;
    *)
      die "Refusing to signal PID ${dev_pid}: it does not look like the UniStore Hub scripts/dev.sh process."
      ;;
  esac

  log_info "Stopping Dev Mode application runner (PID ${dev_pid})"
  kill "${dev_pid}"

  for ((attempt = 1; attempt <= 10; attempt += 1)); do
    if ! kill -0 "${dev_pid}" >/dev/null 2>&1; then
      rm -f "${DEV_RUN_PID_FILE}"
      return 0
    fi
    sleep 1
  done

  log_warn "Dev Mode runner is still alive after 10 seconds; leaving it untouched for manual inspection."
}

dev_validate_local_contract
dev_require_docker_compose

stop_dev_runner

LOCALSTACK_CONTAINER_ID="$(dev_compose ps -q localstack 2>/dev/null || true)"

if [[ -n "${LOCALSTACK_CONTAINER_ID}" ]]; then
  LOCALSTACK_PAUSED="$(docker inspect --format '{{.State.Paused}}' "${LOCALSTACK_CONTAINER_ID}" 2>/dev/null || true)"
  if [[ "${LOCALSTACK_PAUSED}" == "true" ]]; then
    log_info "LocalStack is already paused; local data remains preserved."
  else
    log_info "Pausing LocalStack without deleting local data"
    dev_compose pause localstack
  fi
else
  log_info "LocalStack is not running; no dependency container needed to be stopped."
fi

log_info "Dev Mode dependencies are down. LocalStack state under scripts/dev/.state was preserved."
