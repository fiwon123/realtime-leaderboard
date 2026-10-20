#!/bin/bash
# CRLF guard (#436)
if [[ -f "${BASH_SOURCE[0]}" ]] && grep -q $'\r$' "${BASH_SOURCE[0]}"; then # crlf-guard
    printf '%s\n' "[dev] ${BASH_SOURCE[0]##*/} has CRLF line endings; re-checkout with LF." >&2; exit 1 # crlf-guard
fi # crlf-guard
set -euo pipefail

# Dev sandbox entrypoint — starts cargo run --manifest-path backend/Cargo.toml with fast reload when code exists,
# otherwise sleeps to keep the container alive for shell access.
#
# Usage: set the entrypoint to this script in docker-compose.yml

DEV_DIR="${DEV_DIR:-/workspace}"
SLEEP_ON_IDLE="${SLEEP_ON_IDLE:-true}"

# --- Passwd entry for the runtime user ---------------------------------------
if ! getent passwd "$(id -u)" >/dev/null; then
    if [[ "$(id -u)" -eq 0 ]]; then
        echo "[dev] UID 0 has no passwd entry — adding a fallback identity."
        printf 'sandbox:x:%s:%s:Sandbox User:/home/%s:/bin/bash\n' \
            "$(id -u)" "$(id -g)" "${DEV_USER:-devuser}" >> /etc/passwd
    else
        echo "[dev] WARNING: UID $(id -u) has no passwd entry." >&2
    fi
fi

# --- Start dev command if available, else sleep -------------------------------
if [ "${SLEEP_ON_IDLE}" = "true" ] && [ ! -f "${DEV_DIR}/backend/Cargo.toml" ] && [ ! -f "${DEV_DIR}/backend/Cargo.lock" ]; then
    echo "[dev] No code found; sleeping indefinitely for shell access..."
    exec sleep infinity
fi

echo "[dev] Starting the API (cargo run)..."
cd "${DEV_DIR}" && exec cargo run --manifest-path backend/Cargo.toml
