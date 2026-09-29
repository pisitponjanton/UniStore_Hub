#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

BACKEND_DIR="$(repo_path backend)"
BUILD_ROOT="${BACKEND_DIR}/.build"
LAMBDA_BUILD_DIR="${BUILD_ROOT}/lambda"

require_command node
require_command npm

require_file "${BACKEND_DIR}/package.json"
require_file "${BACKEND_DIR}/package-lock.json"
require_file "${BACKEND_DIR}/src/lambda.js"
require_file "${BACKEND_DIR}/src/worker.js"

log_info "Verifying Backend before packaging"
(
  cd "${BACKEND_DIR}"
  npm ci
  npm test
  npm run check
)

log_info "Preparing Lambda artifact at backend/.build/lambda"
rm -rf "${LAMBDA_BUILD_DIR}"
mkdir -p "${LAMBDA_BUILD_DIR}"

cp "${BACKEND_DIR}/package.json" "${LAMBDA_BUILD_DIR}/package.json"
cp "${BACKEND_DIR}/package-lock.json" "${LAMBDA_BUILD_DIR}/package-lock.json"
cp -R "${BACKEND_DIR}/src" "${LAMBDA_BUILD_DIR}/src"

# Install only runtime dependencies into the artifact. Running npm ci in the
# artifact directory keeps backend/node_modules (which may contain dev
# dependencies used by tests) separate from the deployed Lambda bundle.
(
  cd "${LAMBDA_BUILD_DIR}"
  npm ci --omit=dev
)

require_file "${LAMBDA_BUILD_DIR}/src/lambda.js"
require_file "${LAMBDA_BUILD_DIR}/src/worker.js"
require_directory "${LAMBDA_BUILD_DIR}/node_modules"

# Deployment artifacts must never contain local environment files.
if find "${LAMBDA_BUILD_DIR}" -type f \( -name '.env' -o -name '.env.*' \) -print -quit | grep -q .; then
  die "Backend artifact unexpectedly contains an environment file."
fi

log_info "Backend Lambda artifact is ready: ${LAMBDA_BUILD_DIR}"
