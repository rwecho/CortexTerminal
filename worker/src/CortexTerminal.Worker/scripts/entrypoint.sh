#!/usr/bin/env bash
set -euo pipefail

runtime="${CT_RUNTIME_COMMAND:-}"
working_directory="${CT_WORKING_DIRECTORY:-}"
runtime_args=()

load_shell_runtime_environment() {
  local node_bin

  if [[ -d "/opt/homebrew/bin" ]]; then
    export PATH="/opt/homebrew/bin:${PATH}"
  fi

  if [[ -d "/opt/homebrew/opt/node/bin" ]]; then
    export PATH="/opt/homebrew/opt/node/bin:${PATH}"
  fi

  if [[ -d "${HOME:-}/.nvm/versions/node" ]]; then
    for node_bin in "${HOME:-}"/.nvm/versions/node/*/bin; do
      if [[ -d "$node_bin" ]]; then
        export PATH="${node_bin}:${PATH}"
      fi
    done
  fi
}

resolve_node_module_runtime() {
  local runtime_name="$1"
  local module_script=""
  local node_root=""

  case "$runtime_name" in
    codex)
      module_script="lib/node_modules/@openai/codex/bin/codex.js"
      ;;
    copilot)
      module_script="lib/node_modules/@github/copilot/npm-loader.js"
      ;;
    claude)
      module_script="lib/node_modules/@anthropic-ai/claude-code/cli.js"
      ;;
    *)
      return 1
      ;;
  esac

  if [[ -d "${HOME:-}/.nvm/versions/node" ]]; then
    for node_root in "${HOME:-}"/.nvm/versions/node/*; do
      if [[ -x "${node_root}/bin/node" && -f "${node_root}/${module_script}" ]]; then
        runtime="${node_root}/bin/node"
        if [[ ${#runtime_args[@]} -gt 0 ]]; then
          runtime_args=("${node_root}/${module_script}" "${runtime_args[@]}")
        else
          runtime_args=("${node_root}/${module_script}")
        fi
        return 0
      fi
    done
  fi

  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runtime)
      runtime="${2:-}"
      shift 2
      ;;
    --working-directory)
      working_directory="${2:-}"
      shift 2
      ;;
    --runtime-arg)
      runtime_args+=("${2:-}")
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "$runtime" ]]; then
  echo "__ct_error__:worker runtime entrypoint 缺少 runtime 参数。"
  exit 64
fi

if [[ -n "$working_directory" ]]; then
  if [[ ! -d "$working_directory" ]]; then
    echo "__ct_error__:working directory '$working_directory' 不存在。"
    exit 72
  fi

  cd "$working_directory"
fi

load_shell_runtime_environment

if [[ "$runtime" == */* ]]; then
  if [[ ! -x "$runtime" ]]; then
    echo "__ct_error__:runtime '$runtime' 尚未安装在当前 worker。请先安装并完成登录后重试。"
    exit 127
  fi
elif ! command -v "$runtime" >/dev/null 2>&1; then
  if resolve_node_module_runtime "$runtime"; then
    :
  else
    echo "__ct_error__:runtime '$runtime' 尚未安装在当前 worker。请先安装并完成登录后重试。"
    exit 127
  fi
fi

if [[ "$runtime" == */* ]]; then
  if [[ ! -x "$runtime" ]]; then
  echo "__ct_error__:runtime '$runtime' 尚未安装在当前 worker。请先安装并完成登录后重试。"
  exit 127
fi
fi

if [[ ${#runtime_args[@]} -eq 0 ]]; then
  exec "$runtime"
fi

exec "$runtime" "${runtime_args[@]}"
