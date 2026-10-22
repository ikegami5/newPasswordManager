# ADR 0002：Expoとプロジェクト内の開発依存

- 日付：2026-10-22
- 状態：採用。2026-10-22にAndroidのdebug APKビルドと署名検証まで成功。Android実機とWindows上での実行は未確認。

## 決定と理由

AndroidはExpo SDK 58の最小TypeScript構成とdevelopment clientを使用する。npm workspacesの検出とネイティブプロジェクト生成を利用し、設定を小さく保つ。Expo Router、Web版、iOSプロジェクト、EASのクラウドビルドは導入しない。

React Native 0.88.0とReact 19.3.0はExpoの公式テンプレートと`bundledNativeModules.json`に合わせる。TypeScriptはtypescript-eslintの対応範囲内である6.0.3を選ぶ。npmのlatestを無条件に組み合わせず、依存定義とlockfileで固定する。

Electronはelectron-viteでビルドし、electron-builderでWindows x64の検証用ZIPを作る。初期のZIPは未署名とし、署名・実行ファイルリソースの編集を行わない。正式配布向けの署名やインストーラーは別途決める。

Node.jsは既存nvmの24.21.0を利用する。npm依存はプロジェクトへ導入する。JDK 17とAndroid SDKはユーザーがWSLへ導入し、プロジェクトの`scripts/env.sh`から参照する。globalのシェル設定をプロジェクトから書き換えない。

JDKはユーザー指定により既存のSDKMANで管理する。`.sdkmanrc`で`17.0.20-tem`を指定し、`sdk env`または`scripts/env.sh`でこのプロジェクト用に選択する。既存Java 11やSDKMANの既定バージョンは変更しない。

## 検証と今後

環境構築の画面だけを追加し、パスワード生成や旧形式の取り込みは実装しない。両アプリから共通パッケージを読み込めることを各バンドルのビルドで確認する。共通テスト用のVitestは用意するが、この段階ではテストケースはまだない。JestはReact Native固有のテストを作る段階で追加する。

具体的な導入・確認コマンドと結果は[README](../../README.md)に記録する。SDKの導入済み・APK成功・Windowsでの実行成功を、JavaScriptのバンドル生成と混同しない。

参考：[Expoモノレポ](https://docs.expo.dev/guides/monorepos/)、[Expoのローカルビルド](https://docs.expo.dev/guides/local-app-development/)、[Expoテンプレート](https://docs.expo.dev/more/create-expo/)。
