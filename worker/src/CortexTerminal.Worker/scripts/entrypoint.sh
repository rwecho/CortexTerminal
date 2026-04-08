#!/usr/bin/env bash
set -euo pipefail

runtime="${CT_RUNTIME_COMMAND:-}"
working_directory="${CT_WORKING_DIRECTORY:-}"
runtime_args=()

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

if ! command -v "$runtime" >/dev/null 2>&1; then
  echo "__ct_error__:runtime '$runtime' 尚未安装在当前 worker。请先安装并完成登录后重试。"
  exit 127
fi

exec "$runtime" "${runtime_args[@]}"