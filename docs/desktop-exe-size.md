# EXE本体を小さくする方法の調査

2026-10-27調査。対象はWindows x64、Electron 45.0.0 / electron-builder 26.15.3。ここではZIP・DLL・言語ファイルを含む全体ではなく、`New Password Manager.exe`自体を扱う。

## 実測と結論

| 対象                                         |  バイト数 |      MiB |
| -------------------------------------------- | --------: | -------: |
| 配布キャッシュ内のElectron公式`electron.exe` | 249797632 | 238.2256 |
| 現在の`New Password Manager.exe`             | 249799168 | 238.2271 |
| 差                                           |      1536 | 約0.0015 |

現在のEXEは、公式Electronの実行ファイルへアイコン・メタデータなどを加えたもの。アプリ固有のJS/CSSは別の`resources/app.asar`にある。したがってJS/CSSの圧縮や、同梱する言語ファイルの削減は、今回のEXEのサイズにはほぼ影響しない。

ElectronはChromium・V8・Node.jsを同梱する構成であり、この実行基盤が大きさの主因。[Electron公式の説明](https://github.com/electron/electron/blob/main/docs/why-electron.md)

WSLの`objdump -h`では主な領域は`.text`・`.rdata`で、`.debug`セクションはなかった。PEのCOFFシンボル数も0。少なくとも通常のデバッグシンボルを削除して大幅に縮小できる状態ではない。バイナリのstrip・圧縮・削除は試していない。

## 方法の比較

| 方法                                       | 小さくなる対象                  | 効果・必要な変更                                                                                                                             |
| ------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ElectronのZIP配布を維持                    | 現行EXEはほぼそのまま           | 少ない設定変更で実行基盤自体を大幅に減らす方法は、今回確認できなかった                                                                       |
| electron-builderの自己解凍型`portable`配布 | ユーザーへ渡す外側のEXE         | ランタイム全体を圧縮した単一EXEにできる。実行時に一時領域へ展開するので、内部EXEや必要ディスク容量が小さくなるわけではない。展開時間が加わる |
| WebView2利用方式（Tauriなど）へ変更        | アプリ自身のEXEと同梱ランタイム | OS側のWebViewを利用してブラウザー同梱を避けられる。Electron採用方針の変更、Rust等のビルド環境、OS連携・生成の実行場所・IPC境界の再設計が必要 |
| 機能を削った専用Electronをビルド           | 実行基盤そのもの                | Electronソースのビルド環境と、削った機能の影響確認・更新追従が必要。既存のシンプルな構成に対して負担が大きく、第一候補にはしない             |

## Electronを維持する場合

配布する単一EXEを小さくしたいなら、自己解凍型`portable`が検討候補。現在のZIPはランタイム全体を圧縮して約135MiBだが、portableは圧縮方式・ラッパーが異なるため、サイズを同じ値と決めつけず実測する必要がある。未作成・未検証。

導入済みelectron-builderの`templates/nsis/portable.nsi`では、起動時に一時ディレクトリへ展開して内部アプリを起動し、`PORTABLE_EXECUTABLE_DIR`を配布用EXEのディレクトリへ設定している。[v26の公式配布設定](https://www.electron.build/v26/docs/nsis/#portable)、[一時展開先の説明](https://www.electron.build/docs/api/electron-builder.interface.portableoptions/)

現在の保存先は`app.getPath('exe')`の親なので、そのままportableに変更すると一時領域へ保存してしまう。**配布用EXEの隣へ保存する要件を保つには、保存先決定の修正が必要**。同一起動制御、通常終了・強制終了、更新、履歴、再起動時のデータ保持も確認する。NSIS等のビルド用ツールが追加で必要になる場合は、事前確認してから導入する。

## EXEの実行基盤自体を減らしたい場合

Electron継続を必須とする現在の方針のまま、大幅な縮小を約束することはできない。方針を見直せる場合の候補として、TauriはWindowsのWebView2を利用する。[TauriのWebView説明](https://v2.tauri.app/reference/webview-versions/)

これはブラウザー部分を消すのではなく、OS側のランタイムへ依存先を移す方式。対象PCにWebView2が必要で、未導入時の取得方法やオフライン配布方式を決める必要がある。固定ランタイムを同梱すれば配布サイズが再び増える。[TauriのWindows配布設定](https://v2.tauri.app/distribute/windows-installer/)、[MicrosoftのWebView2配布説明](https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution)

このアプリでは、React画面・データ形式・固定期待値を再利用する余地がある一方、現main/preloadの権限分離、保存・クリップボード・ハッシュの実行場所を置き換える設計と再検証が必要。既存のパスワードを維持する生成版・fixtureはそのまま基準とする。今回、Tauri等の導入や技術方針の変更は行っていない。

## 今回行ったことと今後の判断

実行ファイルと公式Electronのサイズ比較、PEセクション・シンボル数、導入済みportableテンプレート、公式資料を確認した。EXE自体のサイズ変更や、新しいビルドツールの導入は行っていない。

次は「配布用EXEだけを圧縮したい」ならportableの試作、「展開後も実行基盤を小さくしたい」ならElectron採用方針の再検討が必要になる。どちらも今回のUI修正とは分けて判断する。
