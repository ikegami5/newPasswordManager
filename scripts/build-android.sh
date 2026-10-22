#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
source scripts/env.sh
if [[ -z "${ANDROID_HOME:-}" || ! -x "${JAVA_HOME:-}/bin/java" ]]; then
  echo 'Android SDK and a compatible JDK are required. See README.md.' >&2
  exit 1
fi
missing_sdk_packages=()
[[ -f "$ANDROID_HOME/platforms/android-37.0/android.jar" ]] || missing_sdk_packages+=("platforms;android-37.0")
[[ -x "$ANDROID_HOME/build-tools/37.0.0/aapt2" ]] || missing_sdk_packages+=("build-tools;37.0.0")
[[ -x "$ANDROID_HOME/build-tools/36.0.0/aapt2" ]] || missing_sdk_packages+=("build-tools;36.0.0")
[[ -f "$ANDROID_HOME/ndk/27.1.12297006/source.properties" ]] || missing_sdk_packages+=("ndk;27.1.12297006")
[[ -x "$ANDROID_HOME/cmake/3.22.1/bin/cmake" ]] || missing_sdk_packages+=("cmake;3.22.1")
[[ -x "$ANDROID_HOME/platform-tools/adb" ]] || missing_sdk_packages+=("platform-tools")
if (( ${#missing_sdk_packages[@]} > 0 )); then
  printf 'Missing Android SDK package: %s\n' "${missing_sdk_packages[@]}" >&2
  echo 'Install the missing packages using the README instructions, then retry.' >&2
  exit 1
fi
npm run prebuild:android
cd apps/android/android
./gradlew assembleDebug --console=plain
