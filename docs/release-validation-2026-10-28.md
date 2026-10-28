# 2026-10-28 正式配布用ビルドの検証

ユーザーから既存PC・Android版の動作確認、本番用JSON移行の完了報告があった。その後、PCの旧移行操作を専用タブへ移し、以下をWSLで作成・検証した。本番用JSON・マスター・実サービス情報は読み込んでいない。新しい配布物そのものの実機起動は未確認。

## 配布物

| 対象        | ファイル                                                      | サイズ            | SHA-256                                                            |
| ----------- | ------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| Windows x64 | `apps/desktop/dist/New Password Manager-0.1.0-win.zip`        | 141,735,712バイト | `59729a26128517109ee8d0f5bb9a05f79347a489f6a3a1c612d15a2973d43569` |
| Android     | `apps/android/artifacts/NewPasswordManager-0.1.0-android.apk` | 70,541,051バイト  | `0acd554a4e3a5600e71bb18add3f17ef6c4c9a33056e8f879837fe9e1a0167e4` |

## ローカル検証

- `npm run check`成功：全workspaceの型チェック、ESLint、Prettier、Vitest 252件、Nodeのアイコン検証4件。
- `npm run package:windows`成功。Windows x64 ZIP内のEXE・ASAR・アイコンを確認。言語は`ja.pak`・`en-US.pak`のみ。
- ASAR内のrendererに旧データ移行タブと対応パネルが含まれることを確認。ZIP／ASARに`data.json`・バックアップ・旧データ・署名用ファイルを含まない。
- `npm run build:android:release`成功：2分39秒、617タスク（585実行・32更新不要）。最初はMetaspace 512MiBで不足したが、承認後に上限2GiB・heap 2GiB・並列数2で成功した。global設定・追加インストールは行っていない。
- APKのアプリIDは`io.github.ikegami5.newpasswordmanager`、versionNameは`0.1.0`、versionCodeは1。minSdk 24・targetSdk 36。debuggable／testOnlyが有効でないことを確認。
- `assets/index.android.bundle`の同梱と、開発用launcher画面がmanifestにないことを確認。正式版はMetroへ接続する構成ではない。
- `apksigner verify --verbose --print-certs`成功。専用のRSA 3072ビット証明書が、作成済みkeystoreから書き出した公開証明書のSHA-256と一致。開発用debug証明書ではない。
- 公開証明書のSHA-256：`8f2bacc35500362f36c77ff32d6911a695a9c3f326fd398f9014caef0a9a892c`。これは公開証明書の識別値で、秘密鍵・パスワードの本文ではない。
- 署名情報を指定しないreleaseのdry-runが意図したメッセージで拒否されることを確認。debug署名へのフォールバックはしない。
- `allowBackup=false`と、コンパイル済みXMLのcloud-backup／device-transfer双方の`file/newpm/`除外を確認。releaseではリソースファイル名が短縮されるため、`aapt2 dump resources`から実ファイルとmanifestの参照先を対応付けて検証した。
- READ／WRITE_EXTERNAL_STORAGE・MANAGE_EXTERNAL_STORAGEがmanifestにないこと、APKに本番JSONや署名ファイルを含まないことを確認。
- 署名鍵と認証情報は`.local-tools/android-signing/`に保持し、ディレクトリ700・ファイル600を確認。Git対象外で、内容をログへ出していない。配布物もGit対象外。

AGP・Kotlin等の非推奨警告、Androidの計測設定を書き込めない警告は残るが、成功したビルドを阻害しなかった。依存更新・global設定変更での回避は行っていない。

## 利用者側での切替

- [Windowsの導入・更新](windows-installation.md)：PC版を終了し、ZIPを別フォルダへ展開して既存JSONをEXE隣へコピーする。移行済みなので旧テキスト移行は不要。
- [Android正式版の導入・更新](android-installation.md)：元JSONを確保後、同じIDで署名の異なる開発版を利用者がアンインストールし、正式APKを入れてJSONを取り込む。アンインストールによる内部データ消去を手順で明記した。
- 署名鍵フォルダは利用者が私的にバックアップする。エージェントは端末のアンインストール、本番データの操作、外部へのアップロードを実行していない。
