#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
source scripts/env.sh
newpm_build_mode="${1:-debug}"
if (( $# > 1 )) || [[ "$newpm_build_mode" != debug && "$newpm_build_mode" != release ]]; then
  echo 'Usage: bash scripts/build-android.sh [debug|release]' >&2
  exit 1
fi
if [[ "$newpm_build_mode" == release ]]; then
  newpm_signing_file="${NEWPM_ANDROID_SIGNING_PROPERTIES:-$PWD/.local-tools/android-signing/release.properties}"
  if [[ ! -r "$newpm_signing_file" ]]; then
    echo 'Release signing properties are missing. See docs/android-installation.md.' >&2
    exit 1
  fi
  newpm_signing_file="$(realpath -- "$newpm_signing_file")"
fi
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
if [[ "$newpm_build_mode" == release ]]; then
  apps/android/android/gradlew -p apps/android/android :app:assembleRelease --console=plain --no-daemon \
    -Pkotlin.compiler.execution.strategy=in-process --max-workers=2 \
    '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8' \
    "-Pnewpm.signingProperties=$newpm_signing_file"
  newpm_android_version="$(node -p "require('./apps/android/app.json').expo.version")"
  mkdir -p apps/android/artifacts
  cp apps/android/android/app/build/outputs/apk/release/app-release.apk \
    "apps/android/artifacts/NewPasswordManager-$newpm_android_version-android.apk"
else
  cd apps/android/android
  ./gradlew assembleDebug --console=plain
fi
