# newPasswordManager

デスクトップとAndroidのパスワード生成アプリを、一つのリポジトリで作り直す移行プロジェクトです。

## 目的

- [旧デスクトップ版](https://github.com/ikegami5/passwordManager)と[旧スマホ版](https://github.com/ikegami5/password_manager_sp)を一つのリポジトリで管理する。
- モダンな技術・ライブラリで再構築する。デスクトップはElectron、スマホはAndroidのみを対象とする。
- AIエージェントが保守できるよう、仕様・判断理由・検証方法・環境構築手順を文書化する。

## 最初に読む文書

| 文書                                                                                 | 内容                                                      |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                                                               | AIエージェントの作業規約                                  |
| [旧プロジェクト調査](docs/legacy-projects.md)                                        | 旧構成、機能、生成・保存仕様、既知の問題、互換性の基準    |
| [技術方針](docs/technology-proposal.md)                                              | 基本構成、代替案、未決定事項、導入順序                    |
| [構成・検証方針の決定](docs/decisions/0001-simple-structure-and-local-validation.md) | シンプルな構成、ローカル検証、Windowsでのデスクトップ検証 |

## 基本方針

- npm workspacesで管理し、PCはElectron＋React＋TypeScript、AndroidはReact Native＋TypeScriptを基本構成とする。生成・解析・データモデルは共通化する。
- GitHub Actionsは使用しない。型チェック・lint・互換性テスト・ビルドはローカルで実行し、コマンドと結果を記録する。
- 開発と共通ロジックの検証はWSL（Ubuntu）で行う。デスクトップアプリの動作検証は当面Windows上を対象とし、macOS・Linux上でのアプリ動作検証は要求しない。
- Windows上での起動・画面・クリップボード・ファイル操作等の検証には、必要な範囲でWindowsホストを使用する。Windows側の追加インストール・設定変更は事前に確認する。
- 初期構成を小さく保ち、追加の管理ツールやサービスは必要になった時点で検討する。

## 現在の状態と環境

2026-10-22にnpm workspaces、Electronの確認用画面、Expoを使ったReact NativeのAndroid確認用画面、共通パッケージ、ローカル検証コマンドを整備しました。パスワード生成・旧データ移行・保存機能は未実装です。GitHub Actionsのワークフローは作成しません。

| 項目                                        | 固定したバージョン                             |
| ------------------------------------------- | ---------------------------------------------- |
| Node.js / npm                               | 24.21.0 / 11.19.0（既存nvm環境を使用）         |
| TypeScript                                  | 6.0.3（typescript-eslintの対応範囲に合わせる） |
| Electron / electron-vite / electron-builder | 45.0.0 / 6.0.0 / 26.15.3                       |
| React / React Native                        | 19.3.0 / 0.88.0                                |
| Expo / expo-dev-client                      | 58.0.17 / 58.0.14                              |
| AndroidのJDK                                | Temurin 17.0.20（SDKMAN、認識確認済み）        |
| Android SDK / Build Tools / NDK             | 37.0 / 37.0.0と36.0.0 / 27.1.12297006          |

SDK・Build Tools・NDKは導入したReact Nativeの`gradle/libs.versions.toml`とExpo Gradleプラグインの既定値に基づきます。GradleはExpoの生成するwrapper（9.4.1）を使用し、別途システムへインストールしません。Androidの最低OSはテンプレートのAPI 24で、実機要件との適合は今後確認します。

## WSLでのプロジェクト依存導入

リポジトリ直下で実行します。globalのNode設定や既存Java 11はプロジェクトから変更しません。

```bash
source scripts/env.sh
node --version
npm --version
npm ci
```

`scripts/env.sh`は既存の`~/.nvm/versions/node/v24.21.0`があればそのNodeを選びます。別環境ではnvm等で`.nvmrc`のバージョンを用意してください。npm依存はルートの`package-lock.json`で固定します。キャッシュは基本的にプロジェクト内の`.cache/`へ保存します。

新しいツール・ライブラリの追加導入や設定変更は事前確認が必要です。JDK 17とAndroid SDKはユーザー自身がWSLへ導入する方針です。Windowsホストはデスクトップ検証に必要な範囲で使用します。

## Git操作用rules

プロジェクト固有の許可を[`.codex/rules/git.rules`](.codex/rules/git.rules)で管理します。参照・fetch・add・commit等と`git push origin main`を許可し、代表的な強制push・履歴変更・破壊操作の形式は確認扱いにしています。コマンドの許可は作業依頼の代わりにはならず、commit・pushはユーザーの依頼に従って行います。rulesは引数のプレフィックスで照合するため、すべての危険な引数配置を検出する保証はありません。

公式の[Rules仕様](https://learn.chatgpt.com/docs/agent-configuration/rules)に従い、プロジェクトの`.codex/`が信頼された状態でCodexを再起動すると読み込まれます。globalのrulesは変更しません。

## JDK 17とAndroid SDKの導入（ユーザー作業）

### JDK 17

既存のSDKMANを使い、プロジェクト直下で実行します。JDKは`.sdkmanrc`でTemurin 17.0.20に固定しています（SDKMANの配布一覧を2026-10-22に確認）。既存のJava 11は残します。

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk install java 17.0.20-tem
sdk env
sdk current java
java -version
javac -version
```

導入時に既定バージョンへ設定するか聞かれたら`n`を選択します。`sdk current java`が`17.0.20-tem`、`java`と`javac`が`17.x`なら確認完了です。`sdk env`はこのターミナルでプロジェクト指定のJDKを選択します。既定のJDKへ戻すには`sdk env clear`を使います。global設定の自動切替は有効化しません。[SDKMAN公式の使い方](https://sdkman.io/usage/)

### Android SDK

[Android公式ダウンロードページ](https://developer.android.com/studio#command-tools)の「Command line tools only」でライセンスを確認し、Linux版を利用します。GUIのAndroid Studioやエミュレーターはこの手順では導入しません。

以下の操作には`curl`と`unzip`が必要です。不足している場合のみ、ユーザー側で`sudo apt install curl unzip`を実行してください。JDKの導入にはaptを使いません。

下記は2026-10-22時点のLinux版と公式SHA-256です。既存のSDKがある場合は再配置せず、その場所を`ANDROID_HOME`に指定してください。

```bash
curl -fL https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip -o /tmp/newpm-android-commandlinetools.zip
echo '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583  /tmp/newpm-android-commandlinetools.zip' | sha256sum -c -
mkdir -p "$HOME/Android/Sdk/cmdline-tools"
unzip /tmp/newpm-android-commandlinetools.zip -d "$HOME/Android/Sdk/cmdline-tools"
mv "$HOME/Android/Sdk/cmdline-tools/cmdline-tools" "$HOME/Android/Sdk/cmdline-tools/latest"
source scripts/env.sh
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-37.0" "build-tools;37.0.0" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
```

SHA-256の確認に失敗した場合は、展開以降へ進まず公式のファイル名・チェックサムを再確認してください。`sdkmanager --licenses`では表示されるライセンスを読み、同意するものを選択します。SDK導入には数GBの空き容量とネットワーク接続が必要です。

確認コマンド：

```bash
java -version
javac -version
sdkmanager --version
sdkmanager --list_installed
adb version
```

新しいターミナルでは、プロジェクト直下で`source scripts/env.sh`を実行します。SDKMANに`.sdkmanrc`指定のJDKが導入済みなら、そのJDKを選びます。SDKMANの独自の配置先は`SDKMAN_DIR`／`SDKMAN_CANDIDATES_DIR`を参照します。SDKMANのコマンドで切り替える場合は`sdk env`も使えます。`ANDROID_HOME`未設定かつ`~/Android/Sdk`が存在すればそのSDKを選びます。SDKの独自の導入先は`ANDROID_HOME`で指定してください。

公式資料：[sdkmanager](https://developer.android.com/tools/sdkmanager)、[環境変数](https://developer.android.com/tools/variables)、[React Native環境構築](https://reactnative.dev/docs/set-up-your-environment)。

## ローカル検証コマンド

```bash
source scripts/env.sh
npm run check
npm run build:desktop
npm run bundle:android
```

`check`は全workspaceの型チェック、ESLint、Prettierの確認、Vitestを順に実行します。**まだテストケースはありません**。`npm test`は準備段階に限り`--passWithNoTests`で終了できる設定であり、旧仕様の互換性検証済みという意味ではありません。生成処理の移行時に独立したfixtureと実テストを追加します。React Native固有のテスト用Jestは、そのテストを追加する段階で導入します。

`bundle:android`はMetroとHermesによるバンドル生成の確認であり、APKビルド・実機の動作確認ではありません。

## Windows向けの検証用ZIP

```bash
source scripts/env.sh
npm run package:windows
```

`apps/desktop/dist/`にWindows x64向けZIPを作ります。署名・実行ファイルのリソース編集は行わない設定で、WSLから検証用ZIPを作成します。正式配布時の署名・インストーラー・更新方式は別途決定します。

ZIPをWindows側へコピーし、すべて展開して`New Password Manager.exe`を起動します。今回の画面で確認できるのは起動と共通パッケージ由来のタイトル表示です。Windows上での起動確認は別途必要です。Linux向けElectronをWSLで起動する`dev:desktop`は、Windows検証の代わりにはしません。

## Androidのローカルビルド・起動

JDKとSDKの導入後に実行します。

```bash
source scripts/env.sh
npm run build:android:debug
```

Expoの`prebuild --platform android --no-install`でネイティブプロジェクトを生成し、Gradle wrapperでdebug APKを作ります。初回はGradle・Maven等の依存ダウンロードも発生します。生成先は`apps/android/android/app/build/outputs/apk/debug/app-debug.apk`です。`apps/android/android/`は生成物としてGit対象外とし、設定の正本は`app.json`等で管理します。ネイティブコードを直接編集する必要が生じたら、この方針を先に見直します。

開発用APKを入れた端末ではMetroも必要です。

```bash
# 別ターミナルで起動
source scripts/env.sh
npm run start:android
```

WSLから端末への接続はまだ設定していません。`adb devices`で接続できることを確認してから`npm run run:android`でビルド・インストール・起動します。同一ネットワークの実機検証時は、既存のmitmproxy設定と端末接続・Metroへの接続方法を確認します。EASアカウント・クラウドビルドは使用しません。

## 環境構築の検証記録（2026-10-22）

WSL上のNode.js 24.21.0／npm 11.19.0で実施。対象はこの環境構築の未コミット作業ツリーです。

| コマンド・項目                       | 結果                                                          |
| ------------------------------------ | ------------------------------------------------------------- |
| `npm install --no-fund --no-audit`   | 成功、806パッケージ導入、ルートlockfile作成                   |
| `npm ls --depth=0`                   | 成功、workspaceと依存解決を確認                               |
| `npm run check`                      | 型チェック・lint・書式確認成功。Vitestはテスト未作成のため0件 |
| `npm run build:desktop`              | main/preload/rendererのビルド成功                             |
| `npm run package:windows`            | Windows x64向けの未署名ZIP作成成功。Windows上の実行は未確認   |
| `npm run prebuild:android`           | Androidネイティブプロジェクトの生成成功                       |
| `npm run bundle:android`             | 共通パッケージを含むMetro／Hermesバンドル生成成功             |
| JDK 17・Android SDK、APKビルド、実機 | 初回は未導入。再起動後の確認結果は下記参照                    |
| 旧仕様の互換性テスト                 | 生成ロジック・fixture未移行のため未実施                       |

Windows ZIP作成の初回は、既定のElectronキャッシュへの書込が読み取り専用で失敗しました。権限付き再実行で成功した後、`electron-builder.json`の正式な`electronDownload.cache`設定でプロジェクト内のキャッシュを明示し、通常権限での再実行にも成功しました。

npm導入時に間接依存の非推奨警告と、Windows ZIP作成では利用しない`electron-winstaller`のinstall script未許可警告がありました。無条件でscriptを許可したり依存を強制更新したりしていません。Metroは実行環境由来の`NO_COLOR`／`FORCE_COLOR`警告を出しましたが、バンドル生成は成功しています。

### JDK・SDK導入後の再確認（2026-10-22）

- `source scripts/env.sh`でSDKMANのTemurin 17.0.20を選択でき、`java`／`javac`とも17.0.20を確認した。
- `ANDROID_HOME`で指定したSDKディレクトリを確認した。Command-line Tools 22.0とlicensesは存在するが、このSDK配下にはPlatform 37・Build Tools 37.0.0・NDK・CMake・platform-toolsはまだない。`sdkmanager --list_installed`もインストール済みパッケージを表示しない。
- PATH上にはシステム側のadb 34.0.5があるが、このSDKのplatform-tools導入済みとは扱わない。
- 空文字でexportされた`HTTP_PROXY`／`HTTPS_PROXY`によりSDKコマンドが不正なURLのエラーになった。`scripts/env.sh`で空のプロキシ変数だけをunsetする通常の対処を追加し、`sdkmanager --version`と`--list_installed`が成功することを確認した。値のあるプロキシ設定やglobal設定は変更しない。
- 不足SDKパッケージは、ユーザーが追加導入する方針を再確認した。APKビルド・実機確認は未実施。ビルドスクリプトは不足パッケージを事前に検出して停止する。

ユーザー側で次を実行する（リポジトリ直下、ライセンスは内容を確認して同意）：

```bash
source scripts/env.sh
sdkmanager --sdk_root="$ANDROID_HOME" --licenses
sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-37.0" "build-tools;37.0.0" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
sdkmanager --sdk_root="$ANDROID_HOME" --list_installed
adb version
```

`sdkmanager`は非推奨の警告を出すが、今回の確認コマンドは成功している。現時点ではツールの置き換えは行っていない。

### SDK Platformのパッケージ名訂正（2026-10-22）

初期手順で案内した`platforms;android-37`は存在せず、`Failed to find package`となった。`sdkmanager --list`で配布一覧を確認し、正しい識別子は`platforms;android-37.0`であることを確認した。Build Toolsは`build-tools;37.0.0`、NDKは`ndk;27.1.12297006`、CMakeは`cmake;3.22.1`で配布されている。上記の導入コマンドとビルド前チェックを訂正した。SDKのインストール先は`platforms/android-37.0/`。React Nativeの`compileSdk = 37`とはパッケージ識別子の表記が異なるため、整数値から識別子を推測しない。

### SDKパッケージ追加導入の確認（2026-10-22）

ユーザーによる追加導入後、`source scripts/env.sh`を実行し、以下を確認した。

| 項目                     | 認識したバージョン                  |
| ------------------------ | ----------------------------------- |
| Java / javac             | SDKMANのTemurin 17.0.20             |
| SDK Platform             | `platforms;android-37.0` revision 2 |
| Build Tools              | 37.0.0                              |
| NDK                      | 27.1.12297006                       |
| CMake                    | 3.22.1                              |
| SDK platform-tools / adb | 37.0.1 / 1.0.41                     |

SDKの保存先は`ANDROID_HOME`で指定する。`sdkmanager --list_installed`で必要な全パッケージが表示され、adbも同SDK配下のものが選択されている。ビルドスクリプトの事前チェックを通過し、Androidネイティブプロジェクトの再生成とGradle 9.4.1のダウンロードが成功した。`npm run check`も成功（Vitestの実テストは未作成のため0件）。APKビルドの結果と実機確認は別途記録する。

### APKビルドで判明した追加要件（2026-10-22）

`npm run build:android:debug`を実行。Gradle 9.4.1の取得とExpo／React NativeのGradleプラグインのコンパイルは成功し、アプリ設定もcompileSdk 37、Build Tools 37.0.0、NDK 27.1.12297006を認識した。

その後、`:expo:compileDebugJavaWithJavac`の依存解決で**Build Tools 36.0.0も要求**された。GradleがSDKへの自動導入を試みたが、エージェントの環境では`$ANDROID_HOME`への書込が制限され、インストール用ファイルを作れず停止した（`BUILD FAILED`）。SDKをユーザーが導入する方針に従い、権限付きビルドによる自動導入は行っていない。APKは未生成、実機確認も未実施。

Build Toolsは37.0.0と36.0.0を共存させる。上記の初期導入コマンドとビルド事前チェックにも36.0.0を追加した。ユーザー側で次を実行後、ビルドを再確認する。

```bash
source scripts/env.sh
sdkmanager --sdk_root="$ANDROID_HOME" "build-tools;36.0.0"
sdkmanager --sdk_root="$ANDROID_HOME" --list_installed
```

今回のビルドでは、Expoテンプレート由来のAGP非推奨設定の警告と、`~/.android/analytics.settings`を書けない計測設定の警告も出た。依存更新やglobal設定変更による回避は行っていない。

### Android APKビルド成功（2026-10-22 22:14 JST）

ユーザーがBuild Tools 36.0.0を追加導入した後、`sdkmanager --list_installed`で37.0.0との共存を確認し、`npm run build:android:debug`を再実行した。通常権限で`BUILD SUCCESSFUL in 2m 15s`、458タスク（426実行、32更新不要）で完了した。SDKの追加自動導入・依存変更・global設定変更は行っていない。

- 生成物：`apps/android/android/app/build/outputs/apk/debug/app-debug.apk`（約170 MiB）。
- アプリID：`io.github.ikegami5.newpasswordmanager`、バージョン：`0.1.0`。
- min SDK：24、target SDK：36、compile SDK：37。
- 対応ABI：arm64-v8a、armeabi-v7a、x86、x86_64。
- `aapt dump badging`でメタデータを確認し、`apksigner verify`も成功。
- SHA-256：`dc4687d8c165c5e461111de6c9694e366ac99ee370415a707133d5cd95fe506a`（今回生成したAPKに対する値）。

これでAndroidのローカルAPKビルドまで確認できた。生成物はdebug署名のExpo development clientであり、起動にはMetroとの接続が必要。端末へのインストール・実機起動、Windows上での実行、旧生成仕様の互換性はまだ未確認。AGPやExpo依存の非推奨警告と計測設定の書込警告は残るが、ビルドは成功している。
