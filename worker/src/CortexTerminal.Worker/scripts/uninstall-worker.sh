#!/usr/bin/env bash

set -euo pipefail

install_dir=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir)
      install_dir="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/uninstall-worker.sh --install-dir <path>

Stops and removes the managed Cortex Terminal worker service, then deletes the
installed worker directory.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$install_dir" ]]; then
  echo "--install-dir is required" >&2
  exit 1
fi

install_dir="$(mkdir -p "$install_dir" && cd "$install_dir" && pwd)"
env_file="${CORTEX_WORKER_ENV_FILE:-$install_dir/config/worker.env}"

log() {
  printf '[cortex-worker-uninstall] %s\n' "$1"
}

read_env_value() {
  local key="$1" file_path="$2"
  [[ -f "$file_path" ]] || return 0
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1) }' "$file_path" | tail -n 1
}

sanitize_service_identifier() {
  local value="${1:-worker}"
  printf '%s' "$value" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-' | sed 's/^-*//; s/-*$//'
}

worker_name="$(read_env_value WORKER_ID "$env_file")"

case "$(uname -s)" in
  Linux)
    if command -v systemctl >/dev/null 2>&1 && [[ -n "$worker_name" ]]; then
      service_name="cortex-terminal-worker-$(sanitize_service_identifier "$worker_name")"
      service_file="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/$service_name.service"
      log "stopping systemd user service $service_name"
      systemctl --user stop "$service_name.service" >/dev/null 2>&1 || true
      systemctl --user disable "$service_name.service" >/dev/null 2>&1 || true
      rm -f "$service_file"
      systemctl --user daemon-reload >/dev/null 2>&1 || true
    fi
    ;;
  Darwin)
    if command -v launchctl >/dev/null 2>&1 && [[ -n "$worker_name" ]]; then
      service_label="top.rwecho.cortex-terminal.worker.$(sanitize_service_identifier "$worker_name")"
      user_id="$(id -u)"
      label_target="gui/$user_id/$service_label"
      plist_path="$HOME/Library/LaunchAgents/$service_label.plist"
      log "removing launchd agent $service_label"
      launchctl bootout "$label_target" >/dev/null 2>&1 || true
      launchctl disable "$label_target" >/dev/null 2>&1 || true
      rm -f "$plist_path"
    fi
    ;;
esac

if [[ -d "$install_dir" ]]; then
  parent_dir="$(dirname "$install_dir")"
  log "removing install directory $install_dir"
  cd "$parent_dir"
  rm -rf "$install_dir"
fi

log "worker uninstalled"