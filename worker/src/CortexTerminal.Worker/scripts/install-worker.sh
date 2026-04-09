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
uninstall_path="$install_dir/uninstall-worker.sh"
package_version_file="$package_root/package-version.txt"
installed_version_file="$install_dir/package-version.txt"

normalize_package_version() {
  local value="${1:-}"
  value="${value#v}"
  printf '%s' "$value"
}

read_version_file() {
  local file_path="$1"
  [[ -f "$file_path" ]] || return 0
  tr -d '\r\n' < "$file_path"
}

is_comparable_package_version() {
  local value
  value="$(normalize_package_version "$1")"
  [[ "$value" =~ ^[0-9]+(\.[0-9]+){1,3}$ ]]
}

compare_package_versions() {
  local incoming_version installed_version max_version
  incoming_version="$(normalize_package_version "$1")"
  installed_version="$(normalize_package_version "$2")"

  if [[ -z "$incoming_version" || -z "$installed_version" ]]; then
    printf 'unknown'
    return 0
  fi

  if [[ "$incoming_version" == "$installed_version" ]]; then
    printf 'same'
    return 0
  fi

  if is_comparable_package_version "$incoming_version" && is_comparable_package_version "$installed_version"; then
    max_version="$(printf '%s\n%s\n' "$incoming_version" "$installed_version" | sort -V | tail -n 1)"
    if [[ "$max_version" == "$incoming_version" ]]; then
      printf 'newer'
    else
      printf 'older'
    fi

    return 0
  fi

  printf 'unknown'
}

package_version="$(read_version_file "$package_version_file")"
installed_version="$(read_version_file "$installed_version_file")"

case "$(compare_package_versions "$package_version" "$installed_version")" in
  same)
    cat <<EOF
Worker version $package_version is already installed at $install_dir.
Skipping reinstall.
EOF
    exit 0
    ;;
  older)
    echo "Refusing to downgrade worker from $installed_version to $package_version." >&2
    exit 1
    ;;
esac

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

if [[ -f "$package_version_file" ]]; then
  cp "$package_version_file" "$installed_version_file"
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

cat > "$uninstall_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

install_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
uninstall_script="$install_dir/bin/scripts/uninstall-worker.sh"

if [[ ! -x "$uninstall_script" ]]; then
  chmod +x "$uninstall_script" 2>/dev/null || true
fi

exec "$uninstall_script" --install-dir "$install_dir" "$@"
EOF

chmod +x "$launcher_path"
chmod +x "$uninstall_path"
chmod +x "$bin_dir/scripts/install-worker.sh" || true
chmod +x "$bin_dir/scripts/uninstall-worker.sh" || true
chmod +x "$bin_dir/scripts/entrypoint.sh" || true

cat <<EOF
Worker installed successfully.

Install directory: $install_dir
Environment file : $env_file
Launcher         : $launcher_path
Uninstall        : $uninstall_path

$(if [[ -n "$package_version" ]]; then printf 'Package version  : %s\n' "$package_version"; fi)

Next steps:
  1. Edit $env_file
  2. Run: $launcher_path
  3. Remove: $uninstall_path
EOF
