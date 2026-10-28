# 互換性の固定資料

実アカウントの情報は含めない。67件は、ユーザーがテスト専用・機密情報なしと明記した旧リポジトリの提供資料。マスターと期待出力もテスト専用。

- `pc/records.txt`、`master.txt`、`expected.txt`：旧PCリポジトリのGUI採取資料をそのままコピー。最新saltの67出力を新実装から再生成しない。
- `pc/gui-sample.json`：上記3テキストの内容をJSONへ包んだ固定資料。現在はローカルテスト専用で、Androidアプリにはバンドルしない。出力を再生成せず、Nodeテストで元資料との一致を検証する。
- `pc/*.scala.txt`：互換性の参照にした旧PCソースの未変更コピー。
- `pc/Oracle.scala`：旧PCソースのみを呼び出す、今回追加したヘッドレス採取用ハーネス。Base64化したmaster、salt、真偽値2つ、Base64化した記号、長さをタブ区切りで標準入力へ渡し、出力をBase64または`EXHAUSTED`で返す。
- `pc/synthetic.json`：旧Scala 2.12.13ソース＋Oracleから2026-10-27に採取した92件。文字種の組合せ、長さ1/4/8/16/64、記号順/重複、Unicode、空入力、過去salt、生成不能に加え、旧PC UIが受け付ける英数字マスターの4/8/9/10/16文字を含む。15件が生成不能。GUI期待値とは区別する。
- `mobile/password-sample.txt`：旧Androidに保存されていた同じ67件の資料。フィールド末尾の空白を除きレコードと期待値の一致を確認する。
- `mobile/*.js.txt`：旧Androidの未変更ソース。テスト内VMでimport/exportを除き、ハッシュをNodeのSHA-512へ注入する。RNFSは呼び出さない。
- `mobile/differences.json`：旧Androidソースから採取した合成入力の差異。indexは`pc/synthetic.json`の0始まり。修正後の結果で更新しない。
- `sources.json`：コピーした原本10ファイルのリポジトリ・コミット・パス・SHA-256。コピー時に固定Gitオブジェクトとバイト一致を確認し、テストでもハッシュを検証する。

出典：PC `ikegami5/passwordManager@9840d111cab0f0634cfaa1a50dd6c81da28cafc1`、Android `ikegami5/password_manager_sp@015b9c10f62183965aa7bb10881c42c22c33e612`。原文ソースの権利・ライセンスは各出典に従う。

通常の`npm test`に旧リポジトリやJava/Scalaは不要。追加のPC期待値が必要な場合だけ、固定ソース3つを`.scala`へコピーし、Scala 2.12.13のcompiler/library/reflectとOracleを隔離一時ディレクトリへコンパイルする。JVMの既定文字コードをUTF-8とし、生成本体・依存・fixtureを変更しない。今回の採取には既存のWSLキャッシュとTemurin 17.0.20を使用し、追加インストールは行っていない。

全入力の互換性やAndroid実機の証拠ではない。具体的な不一致条件・採取方法の限界は[調査メモ](../../docs/legacy-mobile-differences.md)を参照。
