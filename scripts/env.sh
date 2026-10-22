#!/usr/bin/env bash
# Source from the repository: source scripts/env.sh
# Android CLI treats an exported empty proxy as an invalid URL.
# Preserve configured proxies; remove only variables with empty values.
for newpm_proxy in HTTP_PROXY HTTPS_PROXY http_proxy https_proxy; do
  if [[ -v "$newpm_proxy" && -z "${!newpm_proxy}" ]]; then
    unset "$newpm_proxy"
  fi
done
unset newpm_proxy
newpm_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
newpm_node_version="$(cat "$newpm_root/.nvmrc")"
if [[ -x "$HOME/.nvm/versions/node/v$newpm_node_version/bin/node" ]]; then
  export PATH="$HOME/.nvm/versions/node/v$newpm_node_version/bin:$PATH"
fi
newpm_java_version="$(sed -n 's/^java=//p' "$newpm_root/.sdkmanrc")"
newpm_java_home="${SDKMAN_CANDIDATES_DIR:-${SDKMAN_DIR:-$HOME/.sdkman}/candidates}/java/$newpm_java_version"
if [[ -x "$newpm_java_home/bin/java" ]]; then
  export JAVA_HOME="$newpm_java_home"
fi
if [[ -n "${JAVA_HOME:-}" ]]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi
if [[ -z "${ANDROID_HOME:-}" && -d "$HOME/Android/Sdk" ]]; then
  export ANDROID_HOME="$HOME/Android/Sdk"
fi
if [[ -n "${ANDROID_HOME:-}" ]]; then
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
fi
export GRADLE_USER_HOME="$newpm_root/.cache/gradle"
export ELECTRON_CACHE="$newpm_root/.cache/electron"
export ELECTRON_BUILDER_CACHE="$newpm_root/.cache/electron-builder"
export EXPO_NO_TELEMETRY=1
unset newpm_root newpm_node_version newpm_java_version newpm_java_home
