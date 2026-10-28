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
| [デスクトップ移行設計](docs/desktop-design.md)                                       | 旧2タブの画面・操作、保存・移行・IPCの設計案、受入条件    |
| [Android移行設計](docs/android-design.md)                                            | 旧1画面の操作、PCからの取り込み、コピー・復帰時の設計案   |
| [技術方針](docs/technology-proposal.md)                                              | 基本構成、代替案、未決定事項、導入順序                    |
| [構成・検証方針の決定](docs/decisions/0001-simple-structure-and-local-validation.md) | シンプルな構成、ローカル検証、Windowsでのデスクトップ検証 |

## 基本方針

- npm workspacesで管理し、PCはElectron＋React＋TypeScript、AndroidはReact Native＋TypeScriptを基本構成とする。生成・解析・データモデルは共通化する。
- GitHub Actionsは使用しない。型チェック・lint・互換性テスト・ビルドはローカルで実行し、コマンドと結果を記録する。
- 開発と共通ロジックの検証はWSL（Ubuntu）で行う。デスクトップアプリの動作検証は当面Windows上を対象とし、macOS・Linux上でのアプリ動作検証は要求しない。
- Windows上での起動・画面・クリップボード・ファイル操作等の検証には、必要な範囲でWindowsホストを使用する。Windows側の追加インストール・設定変更は事前に確認する。
- 初期構成を小さく保ち、追加の管理ツールやサービスは必要になった時点で検討する。

## 現在の状態と環境

ユーザーからPC・Androidの動作確認と本番用JSONへの移行完了の報告がありました。旧PCテキストの取り込みは「旧データ移行」タブへ移し、通常の生成・登録から分離しています。生成アルゴリズムと保存形式は変更していません。本番データをエージェントが読み込んだり、配布物へ同梱したりしません。

本番用の配布形式はWindows x64のZIPと、正式鍵で署名してバンドルを内蔵するAndroid APKです。**正式版AndroidはMetro不要**で、開発用development clientだけがMetroを使います。[Windowsのインストール・更新](docs/windows-installation.md)、[Android正式版のインストール・更新・署名鍵のバックアップ](docs/android-installation.md)を参照してください。[ADR 0012](docs/decisions/0012-production-packages.md)に署名・開発版からの切替・ビルド設定を記録しています。[正式配布用ビルドの検証結果](docs/release-validation-2026-10-28.md)を記録しました。今回の配布物そのものの実機起動は未確認です。

以下は設計・実装の経緯です。

2026-10-22にnpm workspaces、Electronの確認用画面、Expoを使ったReact NativeのAndroid確認用画面、共通パッケージ、ローカル検証コマンドを整備しました。この時点では生成・移行・保存は未実装でした。GitHub Actionsのワークフローは作成しません。

2026-10-27に、旧PC版の仕様・UIを基準とする[デスクトップ移行設計](docs/desktop-design.md)と[ADR 0003](docs/decisions/0003-desktop-migration-scope.md)を追加しました。デスクトップから進め、旧Android形式への書き出しは不要と確認済みです。

続いて[Android移行設計](docs/android-design.md)と[ADR 0004](docs/decisions/0004-android-migration-scope.md)を追加しました。ユーザー確認により、初回Android版はPCから取り込んで選択・生成・コピーする範囲とし、登録・salt追加はPC側で行います。取り込み・再取り込み・復元、前景と復帰時のコピー消去を設計しています。この設計時点では詳細方式は提案段階で、依存・機能は未導入でした。後続のADR 0010で承認済み方式を実装しています。

同日、PC互換コア・旧形式パーサー・平文JSON保存と、デスクトップの2タブ、登録・履歴追加・生成/コピー・旧PC形式取り込みを実装しました。ユーザー承認の保存方式と新規登録条件は[ADR 0005](docs/decisions/0005-desktop-implementation.md)、操作とWindowsでの確認手順は[デスクトップ操作・検証](docs/desktop-validation.md)を参照してください。追加依存はありません。Windows上のGUI・クリップボード操作はまだ未検証です。

提供67件は期待値に一致しましたが、旧Androidの剰余計算・乱数境界に差異が見つかりました。[再現条件と具体例](docs/legacy-mobile-differences.md)を記録しています。その後のユーザー承認により、剰余計算・乱数ともPC互換の共通コアへ統一すると決定しました（[ADR 0006](docs/decisions/0006-shared-pc-generator.md)）。この決定後にAndroidの機能を接続しました。実機での一致確認は未実施です。

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

`check`は全workspaceの型チェック、ESLint、Prettierの確認、Vitestを順に実行します。テストは提供67件の独立したGUI期待値、旧PCソースから採取した92件の合成期待値、旧Androidとの差異、旧形式解析、JSON検証、保存失敗、自動バックアップの保護、クリップボードの直列処理、mainサービスとIPCの送信元検証を対象とします。`--passWithNoTests`は除去しました。資料の出典と限界は[fixtureの説明](packages/compatibility-fixtures/README.md)を参照してください。Androidの純粋な保存・取り込み・生成サービス・コピー期限と競合、固定159件のチェック機能もVitestで検証します。React Native画面・ネイティブI/O用のJestは未導入です。

`bundle:android`はMetroとHermesによるバンドル生成の確認であり、APKビルド・実機の動作確認ではありません。

## Windows向けの検証用ZIP

**利用者向けの導入・起動方法は[Windows版の導入・最初の動作確認](docs/windows-installation.md)に記載しています。** 作成済みZIPをWindowsへコピーしてすべて展開し、テスト用プロファイルで起動してください。通常データと分離して登録・生成・履歴・保存を確認できます。通常起動の`data.json`はEXEの隣へ保存します。復元・エクスポート・保存場所表示機能はありません（[ADR 0007](docs/decisions/0007-portable-desktop.md)）。Windows側にNode.jsやJavaを別途導入する必要はありません。

以下はWSLでZIPを作り直す場合の手順です。

```bash
source scripts/env.sh
npm run package:windows
```

`apps/desktop/dist/`にWindows x64向けZIPを作ります。署名は行わず、EXEのアイコン・メタデータのリソース編集を有効にして、WSLから検証用ZIPを作成します。正式配布時の署名・インストーラー・更新方式は別途決定します。

ZIPをWindows側へコピーし、すべて展開して`New Password Manager.exe`を起動します。2タブから登録・生成・履歴選択が可能です。初回の手動検証は[隔離テスト用の起動方法](docs/desktop-validation.md)を使い、架空データだけを取り込んでください。Windows上での起動・実操作確認は別途必要です。Linux向けElectronをWSLで起動する`dev:desktop`は、Windows検証の代わりにはしません。

## 本番用ビルド

WSLで既存のNode・JDK・SDKを選び、ローカルで検証・ビルドします。

```bash
source scripts/env.sh
npm run check
npm run package:windows
npm run build:android:release
```

Windows ZIPは`apps/desktop/dist/New Password Manager-0.1.0-win.zip`、Android APKは`apps/android/artifacts/NewPasswordManager-0.1.0-android.apk`へ生成します。実データ・署名情報は含めません。鍵自体は`.local-tools/android-signing/`に作成済みです。`npm run setup:android:signing`は新規鍵の初回作成用で、更新のたびに実行しません。署名鍵と認証情報はフォルダ全体を私的にバックアップしてください。

Androidの正式ビルドは、確認済みのSDKだけを使用してprebuildし、専用の署名設定で`assembleRelease`を実行します。Kotlin同一プロセス方式、heap／Metaspace各2GiB、並列数2を本番ビルドの引数だけで指定します。これはユーザー承認済みで、global設定は変更しません。生成したネイティブ側を直接編集しません。

署名情報がなければ停止し、debug鍵へフォールバックしません。Androidは開発版と同じID・異なる署名なので、初回は元JSONを確保してから開発版を手動でアンインストールし、正式版を入れて再取り込みします。今後の正式版同士の更新では同じ鍵を使い、アンインストールせず更新します。詳細は上記のインストール手順を参照してください。

## Androidの開発用ビルド・起動

JDKとSDKの導入後に実行します。

```bash
source scripts/env.sh
npm run build:android:debug
```

Expoの`prebuild --platform android --no-install`でネイティブプロジェクトを生成し、Gradle wrapperでdebug APKを作ります。初回はGradle・Maven等の依存ダウンロードも発生します。生成先は`apps/android/android/app/build/outputs/apk/debug/app-debug.apk`です。`apps/android/android/`は生成物としてGit対象外とし、設定の正本は`app.json`とローカルconfig pluginで管理します。バックアップ除外XMLもprebuildで再生成します。ネイティブコードを直接編集する必要が生じたら、この方針を先に見直します。

開発用APKを入れた端末ではMetroも必要です。

```bash
# 別ターミナルで起動
source scripts/env.sh
npm run start:android
```

ワイヤレス接続・インストールは2026-10-28のユーザー報告で確認済みです。[ワイヤレスデバッグの手順](docs/android-validation.md#ワイヤレスデバッグでインストールする)に、前景ADBサーバー、ペア設定用／接続用ポートの違い、`adb connect`、インストール、Metroの起動手順をまとめています。USB接続とアプリの実機起動は未確認です。EASアカウント・クラウドビルドは使用しません。

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

## デスクトップ初回実装の検証（2026-10-27）

対象は本日の未コミット作業ツリー。WSL、Node 24.21.0 / npm 11.19.0で実行。旧PC合成期待値の採取だけは既存のTemurin 17.0.20とScala 2.12.13を使用しました。

| コマンド・項目            | 結果                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run check`           | 型チェック・lint・書式成功、Vitest 9ファイル227テスト成功                                        |
| 提供67件                  | 新PC互換コア・旧Androidソースが独立した最新saltのGUI期待値へ完全一致                             |
| 追加の旧PC由来92件        | 合成期待値に一致（15件の生成不能を含む）。Unicode・過去salt・記号順/重複・境界を確認             |
| 旧Android差異             | 短い長さの剰余丸めと、乱数単体の32bitオーバーフロー差異を再現。詳細は調査メモ                    |
| 保存・復元・コピー        | 隔離した架空データと失敗注入で、原文保護・直列保存・バックアップ・mainサービス・コピー期限を確認 |
| `npm run build:desktop`   | main/preload/rendererのビルド成功                                                                |
| `npm run package:windows` | Windows x64向け未署名ZIP作成成功                                                                 |
| `npm run bundle:android`  | 既存Android確認画面のMetro/Hermesバンドル生成成功。機能実装・APK再ビルド・実機確認ではない       |
| `git diff --check`        | 成功                                                                                             |

WindowsのGUI・OSクリップボード・スリープ・DPI・ファイルロックでの実動作は未確認です。利用可能なcomputer-useスキルがパスワード管理アプリの自動操作を禁止しているため、[隔離起動と手動チェックリスト](docs/desktop-validation.md)を残しました。新Androidの生成方式は、その後のユーザー承認によりPC互換に決定しました。この時点では機能接続・実機確認は未実施でした。その後のAndroid実装はADR 0010と末尾の記録を参照してください。この時点で実データ・旧リポジトリの変更・追加依存導入・global設定変更・GitHub Actionsの実行は行っていません。

## デスクトップ画面・保存先の変更（2026-10-27）

ユーザー依頼により、通常保存はEXEの隣の`data.json`、開発起動はアプリルートへ変更しました。テスト用プロファイルの分離は維持します。旧AppDataやテスト領域のデータは自動移動しません。旧版からの引き継ぎ・更新時のコピー手順は[導入手順](docs/windows-installation.md)を参照してください。

バックアップ復元・エクスポート・保存場所表示を画面とAPIから削除し、内部の保存保護用バックアップは維持しました。文字サイズ14px・行間1.3とし、余白や説明欄も小さくしました。決定は[ADR 0007](docs/decisions/0007-portable-desktop.md)に記録しています。型チェック・lint・229テスト成功。Windows実画面は未確認です。再添付された`key.bmp`から色・透明度を保持した標準ICOを生成し、ウィンドウとEXEのアイコンへ組み込みました。追加ライブラリは導入していません。

### ウィンドウアイコンの保守

元画像は`apps/desktop/resources/icon-source.bmp`、配布用は同ディレクトリの`icon.ico`です。プレビューは`icon-preview.png`。現在の原本は再添付された512×512・32bitのBMP V5で、透過情報を持ちます。形式情報に従ってRGBAを読み取り、色・透明度を保持して変換しています。ICOには16/24/32/48/64/128/256pxを含めています。

```bash
source scripts/env.sh
npm run generate:desktop-icon
npm run package:windows
```

再生成は`scripts/bmp-rgba.mjs`で対応するBMP V5を検証・読込し、既存のExpo依存に含まれる`jimp-compact` 0.16.1でサイズ変更・PNG出力を行います。追加インストールは不要で、通常のビルドは保存済みICOをそのまま使います。`extraResources`で配布先の`resources/icon.ico`へ同梱し、`BrowserWindow.icon`に指定しています。EXE自体にも`win.icon`で埋め込みます。`signAndEditExecutable: true`でリソース編集を有効にし、`signExecutable: false`で署名は行いません。Windowsのタイトルバー・エクスプローラーでの実表示は手動確認が必要です。

アイコン組み込み後も`npm run check`（229テストを含む）と`npm run package:windows`が成功しました。元画像のバイト一致、ICO全7サイズのPNG寸法、ZIP内の`resources/icon.ico`と生成物の一致を確認済みです。Windowsタイトルバーでの実表示は未確認です。

### アイコン・余白の再修正とサイズ調査（2026-10-27）

再添付BMPの色・透過を保持して、タイトルバー用とエクスプローラー用のアイコンを統一しました。大きな項目の区切りを14pxへ広げ、入力周りの小さな余白は維持しています。[ADR 0008](docs/decisions/0008-desktop-icons-and-spacing.md)を参照してください。`npm run check`は既存229テストとBMP変換4テストを含めて成功し、Windows ZIPも再作成しました。全画素のRGBA、EXEへ埋め込まれた7サイズのアイコン、ZIP内の同梱を確認済みです。Windows実表示は未確認です。

[配布サイズの調査と縮小案](docs/desktop-size.md)も記録しました。縮小前のZIPは146.21MiB、展開後357.29MiB。日本語・英語だけを残すと、ZIP約11.04MiB・展開後約47.44MiBを削減できる見込みです。その後のユーザー承認により、日本語・英語の言語ファイルだけを同梱する設定を適用しました。現在のZIPは135.17MiB、展開後309.84MiBです（[ADR 0009](docs/decisions/0009-desktop-languages.md)）。ZIP・展開先とも`ja.pak`・`en-US.pak`だけであることを確認し、型チェック・lint・書式・229＋4テスト・ZIP作成が成功しました。Windows実動作は未確認です。

### 生成タブのグループ間隔とEXE本体の調査（2026-10-27）

生成タブを「サービス選択・説明」「パスワード変更・履歴」「マスター入力」の3グループに分け、グループ間を24pxにしました。各グループ内の小さな入力間隔は維持しています。型チェック・lint・書式・229＋4テストとWindows ZIP再作成が成功。Windowsでの実表示は未確認です。

EXEは約238.23MiBで、元のElectron公式EXEとの差は1536バイトでした。JSや言語ファイルの削減ではEXE自体は小さくなりません。[EXE本体の調査と選択肢](docs/desktop-exe-size.md)に、自己解凍型portableとWebView2方式の違い・保存先要件への影響を記録しました。実行基盤や配布方式は変更していません。

### Androidの初回機能実装（2026-10-27）

[ADR 0010](docs/decisions/0010-android-implementation.md)に沿って、サービス・履歴選択、空マスターを含むPC互換生成、機密フラグ付きコピー、前景／復帰時の期限消去、設定取り込み・確認付き全件置換・直前版復元を実装しました。Androidからの登録・編集・salt追加は行いません。ユーザー承認済みのSDK 58対応6依存を固定版で導入し、10MiB上限の平文JSONを内部2スロットへ保存します。マスター・生成結果は保存しません。バックアップ除外設定はローカルconfig pluginで再生成し、不要な外部ストレージ権限も除外しています。

`npm run check`は型チェック・lint・書式と250件のVitest＋4件のNodeテストを含めて成功。`npm run bundle:android`も成功しました。アプリ内のテスト用互換性チェックは独立した67＋92件を使います。Nodeでは159件の一致を確認し、Hermes上の実行は未実施です。

最終APKは`apps/android/android/app/build/outputs/apk/debug/app-debug.apk`（187,727,144バイト、約179.03MiB）。通常再ビルドがKotlin処理で停滞したため一旦停止し、ユーザー承認の`-Pkotlin.compiler.execution.strategy=in-process`指定でビルド成功（1分20秒）。追加インストール・永続設定変更はしていません。APK署名、APK内のバックアップ除外、広域ストレージ権限なしを検証しました。原因の断定はしていません。

[インストール・操作・確認用JSON・実機チェック・再ビルド時のコマンド](docs/android-validation.md)を残しています。APKはMetroが必要なdevelopment clientです。端末接続・インストール・実機UI／保存／クリップボード・Hermes実行は未確認です。正式署名・単体起動APKの配布は別途決定します。

### ワイヤレス接続と実機へのインストール（2026-10-28）

ユーザーから接続・インストール完了の報告がありました。[手順書](docs/android-validation.md#ワイヤレスデバッグでインストールする)に今回の経路とつまずきへの対応を追記しました。通常のADB起動が応答しない環境では`adb nodaemon server`を前景起動し、ペア設定後にトップ画面の接続用ポートで`adb connect`を行います。アプリ起動・Metro接続・生成・コピー・Hermesでの互換性チェックは、この報告だけで確認済みとは扱いません。

### Androidの選択文字の表示とメニュー仕様（2026-10-28）

サービス・履歴のPickerで選択文字が見えないという実機報告に対し、白背景に対応する文字・候補・矢印の色を明示しました。JS側の変更のため、Metroから再読込して確認できます。修正後の実機表示は未確認です。[手順書のメニュー仕様](docs/android-validation.md#データメニューの各操作の仕様)に、固定159件の互換性チェック、JSONの確認付き全件置換、直前1世代の復元、Android内部保存の再読込の違いを追記しました。

### Androidのデータ操作の簡略化と詳細欄（2026-10-28）

ユーザー指定により、アプリ内の互換性チェック・直前版復元・再読込を削除しました。元JSONの再取り込みでデータを置き換える運用とし、固定67＋92件を含むローカルテストと内部の保存保護は維持します。詳細欄はスクロール内容側に余白を設け、最終行が見切れないようにしました。選択文字の表示修正はユーザー確認済みですが、この詳細欄修正は実機未確認です。Metroから再読込すれば反映され、APKの再インストールは不要です。[ADR 0011](docs/decisions/0011-simplify-android-data-menu.md)と[現行の操作手順](docs/android-validation.md)を参照してください。

### 正式配布用ビルド（2026-10-28）

PCの旧テキスト取り込みを「旧データ移行」タブへ移し、通常の生成・登録から分離しました。本番用JSON・生成処理・保存形式は変更していません。`npm run check`成功（型チェック・lint・書式・Vitest 252件＋Node 4件）、Windows ZIP作成成功、Android署名付きrelease APK作成成功（2分39秒）。

Android正式版はMetro不要で、専用鍵の署名一致・バンドル同梱・debuggable無効・バックアップ除外を確認しました。配布物に本番JSONや署名情報は含まれません。作成済みの署名鍵フォルダは利用者が私的にバックアップしてください。[配布物のサイズ・SHA-256・検証記録](docs/release-validation-2026-10-28.md)、[Windowsの導入](docs/windows-installation.md)、[Androidの導入](docs/android-installation.md)を参照してください。

既存版の動作確認完了はユーザー報告として記録しました。新しいタブ配置と正式APK自体の実機確認は別途行います。Androidは元JSONを確保してから開発版を手動でアンインストールし、正式版を入れて再取り込みします。エージェントは実データ・端末のアンインストールを操作していません。
