#!/usr/bin/env bash

set -euo pipefail

install_dir="${CORTEX_WORKER_INSTALL_DIR:-$HOME/.cortex-terminal/worker}"
force="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir)
      install_dir="$2"
      shift 2
      ;;
    --force)
      force="true"
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/install-worker.sh [--install-dir <path>] [--force]

Installs the published Cortex Terminal worker package into a stable directory,
creates a worker.env template, and generates a run-worker.sh launcher.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package_root="$(cd "$script_dir/.." && pwd)"
install_dir="$(mkdir -p "$install_dir" && cd "$install_dir" && pwd)"
bin_dir="$install_dir/bin"
config_dir="$install_dir/config"
env_template="$package_root/scripts/worker.env.example"
env_file="$config_dir/worker.env"
launcher_path="$install_dir/run-worker.sh"

if [[ -d "$bin_dir" ]] && [[ "$(find "$bin_dir" -mindepth 1 -maxdepth 1 | head -n 1)" != "" ]] && [[ "$force" != "true" ]]; then
  echo "Install target already contains files: $bin_dir" >&2
  echo "Re-run with --force to replace the existing worker payload." >&2
  exit 1
fi

rm -rf "$bin_dir"
mkdir -p "$bin_dir" "$config_dir"
cp -R "$package_root"/. "$bin_dir"/

if [[ ! -f "$env_file" ]]; then
  cp "$env_template" "$env_file"
fi

cat > "$launcher_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

install_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="${CORTEX_WORKER_ENV_FILE:-$install_dir/config/worker.env}"

if [[ -f "$env_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

bin_dir="$install_dir/bin"

if [[ -x "$bin_dir/CortexTerminal.Worker" ]]; then
  exec "$bin_dir/CortexTerminal.Worker" "$@"
fi

exec dotnet "$bin_dir/CortexTerminal.Worker.dll" "$@"
EOF

chmod +x "$launcher_path"
chmod +x "$bin_dir/scripts/install-worker.sh" || true
chmod +x "$bin_dir/scripts/entrypoint.sh" || true

cat <<EOF
Worker installed successfully.

Install directory: $install_dir
Environment file : $env_file
Launcher         : $launcher_path

Next steps:
  1. Edit $env_file
  2. Run: $launcher_path
EOF
