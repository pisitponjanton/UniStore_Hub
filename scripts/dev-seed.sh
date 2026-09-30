#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/dev-common.sh
source "${SCRIPT_DIR}/lib/dev-common.sh"

BACKEND_DIR="$(repo_path backend)"
BACKEND_PACKAGE="${BACKEND_DIR}/package.json"

package_has_script() {
  local script_name="${1:?script name is required}"

  node - "${BACKEND_PACKAGE}" "${script_name}" <<'NODE'
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

resolve_seed_script() {
  local requested_script="${DEV_BACKEND_SEED_SCRIPT:-}"
  local candidate

  if [[ -n "${requested_script}" ]]; then
    package_has_script "${requested_script}"       || die "Requested Backend Dev seed npm script does not exist: ${requested_script}"
    printf '%s\n' "${requested_script}"
    return 0
  fi

  for candidate in dev:seed seed:dev seed:local; do
    if package_has_script "${candidate}"; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  die "Backend deterministic Dev seed npm script is missing. Backend must expose dev:seed, seed:dev, or seed:local for the full Dev seed contract; seed:platform-admin alone is insufficient."
}

require_command node
require_command npm
require_file "${BACKEND_PACKAGE}"

SEED_SCRIPT="$(resolve_seed_script)"

# Setup is idempotent and ensures the local resources exist before Backend seed
# code runs. Domain/entity creation remains entirely Backend-owned.
bash "${SCRIPT_DIR}/dev-setup.sh" >/dev/null

NOTIFICATION_QUEUE_URL="$(
  dev_awslocal sqs get-queue-url     --queue-name "${DEV_NOTIFICATION_QUEUE_NAME}"     --query QueueUrl     --output text
)"
[[ -n "${NOTIFICATION_QUEUE_URL}" && "${NOTIFICATION_QUEUE_URL}" != "None" ]]   || die "Unable to resolve local Notification queue URL before Dev seed."

export NOTIFICATION_QUEUE_URL
dev_export_environment

log_info "Running Backend-owned deterministic Dev seed via npm script: ${SEED_SCRIPT}"
(
  cd "${BACKEND_DIR}"
  npm run "${SEED_SCRIPT}"
)

log_info "Dev seed completed."
