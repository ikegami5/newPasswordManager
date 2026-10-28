# ADR 0009: Windows配布の言語ファイルを日本語・英語に限定する

- 日付：2026-10-27
- 状態：採用。ユーザー承認済み。

## 決定と理由

`apps/desktop/electron-builder.json`の`electronLanguages`を`["ja", "en-US"]`に設定する。全55言語から日本語・英語の2言語へ絞り、配布ZIPと展開後のサイズを減らす。Electronや依存バージョン、圧縮方式、アプリの生成・保存処理は変更しない。

対象はChromium/Electronの言語ファイルであり、アプリ自体の日本語表示を英語へ翻訳する変更ではない。各国語の言語資源をすべて保持する案より、ユーザーが使用する日本語と英語の配布サイズを優先する。

## 検証

`npm run check`とWindows ZIP再作成を行い、ZIPと展開先の`locales/`が`ja.pak`・`en-US.pak`だけであることを検証する。削減量は[サイズ調査](../desktop-size.md)へ実測を追記する。Windowsでの起動・ファイル選択・確認ダイアログなどの実動作確認は別途必要。

実施結果：型チェック・lint・書式、Vitest 229件とBMP変換4件、ZIP再作成が成功。ZIP内・展開先の両方で2言語のみであることを確認した。ZIP 135.17MiB、展開後309.84MiB。Windows実動作は未確認。
