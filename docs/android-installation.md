# Android正式版のインストール・更新

2026-10-28。正式版APKはJavaScriptとHermesバンドルを内蔵し、Metro・Expo Go・PCとの常時接続なしで起動します。開発版の接続・検証手順は[別文書](android-validation.md)です。

## 初回：開発版から正式版へ切り替える

ユーザー指定により、正式版もアプリIDは`io.github.ikegami5.newpasswordmanager`を使います。署名は新規作成した専用鍵です。現在の開発版とは署名が違うため、そのまま上書きインストールはできません。

1. **PC側に移行済みの本番用`data.json`が保持されていることを確認し、別途コピーも保管してください。** アプリ停止中に扱います。旧テキストからの移行はやり直しません。
2. APK `apps/android/artifacts/NewPasswordManager-0.1.0-android.apk`と、取り込みに使うJSONのコピーを端末へ転送します。
3. **Androidの開発版をアンインストールします。この操作で、そのアプリ内部のデータは消えます。** 先にJSONの確保ができていることを確認してください。作業は利用者が行い、エージェントは端末のアンインストールや本番データの操作を行いません。
4. AndroidのファイルアプリでAPKを開き、インストールします。必要に応じて、そのファイルアプリからのインストール許可を設定します。
5. New Password Managerを開きます。MetroのURLを入力する画面は使いません。
6. 「ファイルを選ぶ」でPC版のJSONを取り込み、件数を確認して確定します。その後は端末単体で生成できます。

開発版の内部保存を正式版が自動で引き継ぐ方式ではありません。パスワードの生成条件・salt履歴はJSONから引き継ぎます。PCとAndroidで同じJSON・履歴・マスターを使います。JSONには設定とsalt履歴が含まれ、マスターと生成結果は保存されていません。

### ADBでインストールする場合

ADB接続済みの端末が1台の場合、上記のJSON確保・開発版のアンインストール後に、リポジトリのルートで実行します。

```bash
source scripts/env.sh
adb devices
adb install apps/android/artifacts/NewPasswordManager-0.1.0-android.apk
```

ワイヤレスADBを使う場合は[前景サーバー・ペア設定・接続の手順](android-validation.md#ワイヤレスデバッグでインストールする)を使えます。正式版のインストール後は`adb reverse`やMetroの起動は不要です。ADBで接続していなくても、インストール済みの正式版を利用できます。

## 今後：正式版から正式版へ更新する

- 同じアプリID・同じ署名鍵で新しいAPKを作ります。開発版の鍵へ戻したり、新しい署名鍵を作り直したりしません。
- `apps/android/app.json`の`expo.version`と`android.versionCode`を更新し、versionCodeは増やします。
- 元JSONを保管したうえで、新しいAPKを端末へ転送して更新インストールします。**正式版同士の更新ではアンインストールしません。** 通常、Android内部の取り込み済みデータを保持します。

ADBを使う場合の更新コマンドです。ファイル名は作成した版へ置き換えます。

```bash
adb install -r apps/android/artifacts/NewPasswordManager-0.1.0-android.apk
```

PC側のサービスや履歴を更新した場合は、APKの更新とは別に、PCのJSONを転送してアプリから再取り込みします。

## 署名鍵の保管

署名鍵と認証情報は、プロジェクト内の**`.local-tools/android-signing/`フォルダ全体**に保存します。

- `release.keystore`：正式版の署名鍵。
- `release.properties`：鍵の場所・alias・認証情報。本文をログ・チャット・Gitへ載せません。

Git対象外で、アクセス権を制限して作成しています。**フォルダ全体を私的な安全な保管先へバックアップしてください。** 今後の更新にも同じ鍵と認証情報が必要です。これは本番データのJSONとは別に保管するものです。鍵を紛失した場合、同じ署名での更新はできなくなります。[Androidの署名仕様](https://developer.android.com/studio/publish/app-signing)

鍵を作成する`npm run setup:android:signing`は初回だけです。既存の鍵がある場合は上書きせず停止します。今回の鍵は作成済みなので、通常の再ビルドでは実行しません。

## WSLで正式版を再ビルドする

環境導入はREADMEを参照してください。既存JDKの既定値やglobal設定は変更しません。生成される`apps/android/android/`を手編集せず、config pluginと`apps/android/gradle/release-signing.gradle`を正本にします。

```bash
source scripts/env.sh
npm run check
npm run build:android:release
```

署名情報を`release.properties`から読み、`assembleRelease`でバンドルを同梱したAPKを作ります。認証情報をコマンド引数へ展開しません。正式鍵がなければ停止し、開発鍵へフォールバックしません。承認済みのKotlin同一プロセス方式・heap／Metaspace各2GiB・並列数2を、この本番ビルドコマンドだけに指定しています。初回はMetaspace上限512MiBで不足したため、ユーザー承認を得て増やしました。global設定は変更しません。

生成先は`apps/android/artifacts/`です。デバッグAPKを正式版として配布しません。Play Storeへの公開・EASクラウドビルド・外部へのアップロードは今回行いません。
