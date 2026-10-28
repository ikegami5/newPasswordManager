# 技術方針と詳細選定案

2026-10-22作成、2026-10-27更新。ユーザーの指定は「単一リポジトリ」「モダンな技術」「AIエージェントによる保守」「デスクトップはElectron」「スマホはAndroidのみ」。追加の指定により、シンプルな構成、GitHub Actionsを使わないローカル検証、当面Windows上でのデスクトップ検証を基本方針とする。[基本方針の決定](decisions/0001-simple-structure-and-local-validation.md)、[開発環境の決定](decisions/0002-development-environment.md)を参照。バージョンはpackage.jsonとlockfileに固定した。PC互換コアとデスクトップの初回機能は[ADR 0005](decisions/0005-desktop-implementation.md)に沿って実装した。以下の提案のうち、同ADRで採用した範囲と未決定の範囲を区別する。

## 基本構成：TypeScriptの共通コア＋Electron／React Native

2026-10-27追記：ユーザー指定により、デスクトップから旧PC版の仕様・UIを基準に移行する。[ADR 0003](decisions/0003-desktop-migration-scope.md)と[デスクトップ移行設計](desktop-design.md)に、2タブの配置・操作、保存・移行・IPCの設計案と未決定事項を記録した。新PC版から旧Android版への書き出しは不要。新Android版との受け渡し方法、保存形式・暗号化は引き続き設計対象とする。

同日、Androidの初回範囲を旧版と同じ選択・生成・コピーにすることをユーザーへ確認した。[ADR 0004](decisions/0004-android-migration-scope.md)と[Android移行設計](android-design.md)を参照。登録・salt追加はPC側で行う。明示的なファイル受け渡しと全件置換による再取り込みを提案し、暗号化・転送経路・追加依存・OS設定は実装前に確定する。

その後、ユーザー承認によりデスクトップは平文のバージョン付きJSON、新規登録8〜64文字、記号の初出順保持を採用した。ハッシュは共通コアへ注入し、main側ではNode標準のUTF-8 SHA-512を使う。新規依存は導入していない。旧AndroidとPCの剰余精度・乱数境界の差異は[調査メモ](legacy-mobile-differences.md)へ記録した。調査後のユーザー承認により、Androidも剰余・乱数ともPC互換の共通コアへ統一する（[ADR 0006](decisions/0006-shared-pc-generator.md)）。後続の[ADR 0010](decisions/0010-android-implementation.md)でAndroidの取り込み・保存・生成／コピーを実装した。空マスターを許可し、平文JSON・直前1版・10MiB上限・OSバックアップ除外を採用した。実機確認は未実施。後続の[ADR 0007](decisions/0007-portable-desktop.md)でデスクトップをEXE隣への保存に変更し、復元・エクスポート・保存場所表示は削除した。新Androidへの受け渡しは停止中の`data.json`のコピーを基本とする。

| 領域               | 提案                                                                 | 理由                                                                                                         |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| リポジトリ         | npm workspacesのモノレポ                                             | 既存npmを使い、アプリと共通パッケージを一緒に管理。初期はNx/Turborepo等を加えない                            |
| 共通言語           | TypeScript、strictモード                                             | データ構造と境界を明示し、両アプリで生成・解析・検証を共有                                                   |
| PC                 | Electron＋React＋TypeScript                                          | ユーザー指定のElectronと、Android側でも使うReactの知識を合わせる                                             |
| PC開発・配布       | electron-vite＋electron-builder                                      | main/preload/rendererの開発とパッケージ化。当面はWindows上で動作検証。署名・配布方法は別途決定               |
| Android            | React Native＋TypeScript                                             | PCと生成・データモデルを共通化し、旧JS処理から移行しやすい。iOSの実装・検証は対象外                          |
| AndroidのOS連携    | 必要な箇所だけKotlin／ネイティブモジュール                           | ファイル選択、鍵保護、将来の自動入力等をOS APIに接続                                                         |
| 共通テスト         | Vitest                                                               | UIを起動せず固定ベクトル、解析、移行を検証                                                                   |
| アプリ側テスト     | React Nativeはテスト追加時にJest、PC UIは必要に応じTesting Library等 | ネイティブ依存の検証と共通コアの検証を分離。両ランタイムでも同じ固定ベクトルを実行                           |
| 品質管理           | TypeScript、ESLint、Prettier、ローカル実行                           | 型・規約・互換性をローカルで検証。GitHub Actionsは使用しない。依存バージョンとlockfileは導入時に固定         |
| 初期保存・受け渡し | バージョン付きJSON形式を候補とし、旧data.txtはインポートで対応       | 小規模な設定＋salt履歴に対し、まずはDBを必須にしない。暗号化・鍵・バックアップ要件を確定して保存実装を決める |

この構成を推す理由は、**生成結果を変えてはいけない処理を、両アプリで一つにできること**。画面の共通化は必須にせず、生成関数・型・インポーター・固定テストデータを共有する。React Nativeの公式文書でもTypeScriptとNode/Webとのコード共有が案内されている。ただし、共有だけではNodeとAndroidのJSランタイムの一致を保証しないため、双方で互換性を検証する。

React Nativeの導入方式はExpoの最小構成とdevelopment clientを採用した。公式のモノレポ検出とネイティブ生成を使い、ビルドはローカルで行う。Expo Goだけを実機検証の前提にしない。将来ネイティブ設定・コードを直接保守する必要が生じた場合は、生成物の管理方針を見直す。

electron-viteはElectron ForgeのViteプラグインとは別製品。Forgeも代替候補だが、調査時点のForge公式はViteプラグインをexperimentalと記載している。採用時に安定性とテンプレートの対応を確認し、混在させない。

## 比較したAndroidの代替案

基本方針はReact Nativeとする。以下は比較のために残すもので、変更が必要になった場合は理由を確認して決定記録を更新する。

| 案                                   | 利点                                                                | このプロジェクトでの負担                                                                            |
| ------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| React Native＋TypeScript（第一候補） | Electronと生成・モデルを共有しやすい。Reactの開発知識も共通         | Android APIへの橋渡しとRN依存更新の保守が必要                                                       |
| Kotlin＋Jetpack Compose              | Android公式の推奨UI。Keystore、ファイル操作、自動入力等を直接扱える | Electron側のTypeScriptとは実装言語が分かれる。互換生成・解析の二重実装と共通fixtureによる照合が必要 |
| KotlinのコアをJS/JVMへ共有           | コア共有とネイティブAndroid UIを両立する余地                        | Kotlin/JSとElectronの接続、複数ビルド環境が増える。現規模では初期案にしない                         |

Androidだけを作るならKotlin＋Composeも有力。**Androidの自動入力やOSとの密接な統合を初期から重視するならKotlin案を優先**し、生成処理の二重実装コストを受け入れる。現状の主機能が「選択・再生成・コピー」であり、移行と共通保守を優先するため、第一候補をReact Nativeとしている。旧RN 0.64の依存やネイティブ設定をそのまま更新するのではなく、新規構成へ必要な処理を移す。

## 設計上の境界

- **互換処理**：旧生成と旧ファイルの解釈を独立させる。旧crypto-jsや独自乱数を新ライブラリ・BigIntへ置換する場合も、観測した挙動との一致を先に確認する。SHA-512の提供元は両ランタイムでの互換性・保守状況を確認して決定する。
- **Electron**：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`を前提に、CSPと送信元・引数検証を備えた限定IPCを設計する。ファイルや鍵の操作はmain側へ寄せ、rendererへ汎用的なNode権限を公開しない。
- **Android**：内部保存と、ユーザーが選ぶインポート／エクスポートを分ける。旧アプリの`Android/data`領域を新アプリから直接読める前提にしない。Storage Access Frameworkにも選択できない場所があるため、ユーザーが扱える場所への旧データの取り出し手順を用意する。
- **保存と暗号**：JSONやSQLiteの採用だけでは暗号化されない。暗号化を採用するなら認証付き暗号、鍵管理、破損検出、復元方法まで設計する。Android KeystoreやElectronのOS鍵保護は端末ごとの保護に使い、端末間で同じ鍵を復元できるとは扱わない。マスターをOS鍵ストアに保存することも初期前提にしない。
- **既存パスワードの維持**：保存データの暗号化と、サービス用パスワードの生成方式変更は別の判断。新生成方式を導入するならレコードごとに識別し、旧パスワードの再生成を残す。
- **初期の範囲**：クラウド同期・バックエンドは必須にしない。ファイル受け渡しで足りるか確認し、同期が必要なら競合、salt履歴、暗号化、認証を含め別途設計する。

## ディレクトリ構成

```text
apps/
  desktop/                 Electron main/preload/renderer
  android/                 Expo development clientを使うAndroidアプリ
packages/
  core/                    UI・OS非依存の生成、モデル、旧形式インポート
  compatibility-fixtures/  出典付き固定入力・GUI期待値・旧ソース由来期待値
docs/
  legacy-projects.md
  technology-proposal.md
  decisions/               採用した判断をADRとして保存
```

共通コアからElectron・React Native・ファイルシステムへ直接依存させず、I/Oとハッシュ実装などの境界を明示する。Kotlin案を選ぶ場合はTypeScriptコアの直接共有を前提にせず、共有スキーマとfixture、およびKotlin実装の配置を再設計する。

## ローカル検証方針

- GitHub Actionsは使用せず、ワークフローは作成・実行しない。別のCIサービスの導入も初期構成に含めない。
- WSLで共通コアの型チェック・lint・互換性テストを実行する。実装時にローカルで再実行できるnpm scriptsを整備し、READMEへコマンドと必要環境を記録する。
- デスクトップは当面Windows上で、起動、生成、インポート・保存、クリップボードへのコピー・消去、終了時の動作を確認する。検証用ビルドの作成方法とWSLからWindowsへの受け渡しは、必要環境を確認して決める。
- macOS・Linux上でのアプリ動作検証や配布準備は当面の必須作業にしない。WSLでのロジック検証は継続する。
- AndroidはローカルビルドとAndroid端末で検証する。共通fixtureをAndroidのJSランタイムでも確認し、OS連携の結果と区別して記録する。
- 日時、環境、対象コミット、コマンド、成否、未実施項目を記録する。実データは使わない。

## 詳細選定時に確認すること

1. Windowsでの検証用ビルド作成・起動方法と、将来の署名・配布方法。macOS・Linuxへの展開は当面保留する。
2. Androidの対応端末／最低OS、配布方法、初期から自動入力・生体認証が必要か。
3. スマホ側は初回は旧来の読込・生成のみとする（2026-10-27ユーザー確認済み）。登録・salt追加の拡張は別途要望時に検討する。
4. PCとスマホ間は手動ファイル転送でよいか、自動同期が必要か。
5. 設定ファイルの暗号化とバックアップ・復元の要件。生成用マスターと保管用の解除方法を同じにするかも別途判断する。
6. 既存データの互換性範囲、両旧実装の差異があった場合の優先元、短い生成長の制限。

開発環境の固定バージョンと導入手順はREADMEに記録した。共通fixture・互換コア・デスクトップの初回機能は実装済みで、Windows手動確認と、生成版をPC互換に決定したAndroidの機能実装・実機確認が残る。今後の依存更新も公式の対応条件と固定テストで確認する。

## 参照した公式資料

2026-10-22確認。製品情報と、本プロジェクトへの推奨判断は区別する。

- [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)：複数パッケージの管理。
- [electron-vite](https://electron-vite.org/guide/)：main/preload/rendererのビルドと開発。
- [electron-builder](https://www.electron.build/)：配布用パッケージ作成。公式トップに未リリース版が表示される場合はstable版の資料を選ぶ。
- [Electron Forge Vite Plugin](https://www.electronforge.io/config/plugins/vite)：experimentalの注記。
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security/)：権限・IPC・コンテンツの分離。
- [React Native TypeScript](https://reactnative.dev/docs/typescript)：標準のTypeScript利用。
- [React Native Platform-Specific Code](https://reactnative.dev/docs/platform-specific-code)：Web/Nodeとの共有とプラットフォーム別実装。
- [React Native導入方式](https://reactnative.dev/docs/environment-setup)：Frameworkの推奨と選択肢。
- [Androidアーキテクチャ推奨](https://developer.android.com/topic/architecture/recommendations)：Compose等の推奨。
- [Androidファイル選択](https://developer.android.com/training/data-storage/shared/documents-files)：Storage Access Frameworkとアクセス制限。
- [Android Keystore](https://developer.android.com/privacy-and-security/keystore)：端末内の鍵保護。
- [Vitest](https://vitest.dev/guide/)：共通ロジックのテスト候補。
