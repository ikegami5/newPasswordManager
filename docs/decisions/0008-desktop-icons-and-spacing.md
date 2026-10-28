# ADR 0008: 透過アイコンの再生成とEXEへの埋め込み

- 日付：2026-10-27
- 状態：採用。ユーザーの再添付画像と、アプリアイコン・項目間余白の修正依頼による。

## 決定

再添付された`key.bmp`をアイコンの原本へ置き換える。512×512、32bit、BITMAPV5HEADER、BI_BITFIELDS形式で、アルファチャンネルを持つ。既存JimpのBMP読込では色と透明度が変わることを確認したため、`scripts/bmp-rgba.mjs`で対応するヘッダー・チャンネルマスク・行方向を検証し、RGBAへ変換する。

新たな依存は導入しない。読み取ったRGBAを既存の`jimp-compact`へ渡してPNG・各サイズのICOを生成する。対応外の形式・破損・プロファイル付き入力は黙って色変換せず拒否する。対応形式は[MicrosoftのBITMAPV5HEADER仕様](https://learn.microsoft.com/windows/win32/api/wingdi/ns-wingdi-bitmapv5header)を確認した。

以前は`BrowserWindow.icon`だけを指定し、EXEリソース編集を無効にしていたため、エクスプローラーではElectronの元アイコンが残っていた。今回、`win.icon`に同じICOを指定し、`signAndEditExecutable: true`、`signExecutable: false`とする。リソース編集は有効、署名は引き続き無効。導入済みelectron-builderはNodeのreseditで編集でき、WineやWindows側の追加ツールは不要。[v26公式資料](https://www.electron.build/v26/docs/win/)

## 画面の余白

フォント14px・line-height 1.3・小さな入力間隔は維持し、タブ下と大きな項目の開始位置を14pxへ広げる。生成タブのマスター入力、登録タブの説明・生成条件・長さを大きな区切りとして扱う。狭い画面では引き続きスクロールできる。

## 検証と制限

- `npm run check`：型チェック・lint・書式、Vitest 229件、BMP変換4件成功。
- 原BMPとコピーのバイト一致、元画像全262144画素とPNGのRGBA一致（完全透明画素55230個）を確認。
- 出力EXEのアイコングループを読み、7サイズの埋め込みデータが生成ICOと完全一致することを確認。
- Windows ZIP作成と、ZIP内の`resources/icon.ico`の一致を確認。
- Windowsのタイトルバー・エクスプローラーでの実表示は未確認。OSのアイコンキャッシュを自動操作・変更していない。

## サイズの検討

修正後に配布物を測定し、[縮小案](../desktop-size.md)へ記録した。サイズ縮小の設定はこのADRでは採用しない。第一候補は日本語・英語の言語ファイルだけを残す案であり、採用後のビルド・Windows確認は別途行う。
