import { useEffect, useRef, useState } from 'react';
import type {
  DesktopApi,
  ImportPreview,
  PublicState,
  Result,
} from '../../shared/api';

declare global {
  interface Window {
    newpm: DesktopApi;
  }
}

const messages: Record<string, string> = {
  'invalid-master': 'マスターパスワードは半角英数字8〜1024文字で入力してね。',
  'invalid-registration':
    '名前・記号・文字数を確認してね。文字数は8〜64文字です。',
  'duplicate-name': '同じ名前のサービスはすでに登録されています。',
  'invalid-selection': 'サービスと履歴を選び直してね。',
  exhausted: 'パスワードが生成できなかったよ。条件は変更していません。',
  'copy-failed':
    'クリップボードへのコピーに失敗しました。マスターを再入力してね。',
  'invalid-legacy':
    '旧ファイルを解析できませんでした。元ファイルは変更していません。',
  'invalid-document': '保存ファイルが破損しているか、形式が正しくありません。',
  'unsupported-format': 'このファイルの保存形式には対応していません。',
  'unsupported-generator': 'このファイルの生成方式には対応していません。',
  'read-failed':
    '保存ファイルを読み込めません。アクセス権と保存場所を確認してね。',
  'save-failed': '保存に失敗しました。変更は確定していません。',
  'not-loaded':
    'データを読み込めていません。アプリを終了してdata.jsonを確認し、再読込してください。',
  'external-change': '保存ファイルが外部で変更されました。再読込してください。',
  'import-not-empty':
    '旧ファイルの取り込みは登録データが0件の場合のみ可能です。',
  'empty-import': '取り込むサービスがありません。',
  'expired-preview': '確認後にデータが変わりました。ファイルを選び直してね。',
  'file-too-large': '10MiB以下の設定ファイルを選んでね。',
};
const errorMessage = (code: string): string =>
  messages[code] ?? '操作に失敗しました。入力とファイルを確認してね。';
const diagnosticMessages: Record<string, string> = {
  'empty-line': '途中に空行があります。',
  'field-count': '必要な項目が足りません。',
  'empty-name': 'サービス名がありません。',
  'duplicate-name': 'サービス名が重複しています。',
  'invalid-boolean': '大文字・数字の条件がtrue/falseではありません。',
  'invalid-length': '生成文字数が対応範囲外か、整数ではありません。',
  'missing-salt': 'パスワード履歴の値が欠けています。',
  'ambiguous-escape':
    '区切り文字の復元方法を判定できません。元の内容を確認してください。',
};

type Tab = 'generate' | 'register' | 'migration';

export function App() {
  const [state, setState] = useState<PublicState>();
  const [tab, setTab] = useState<Tab>('generate');
  const [selectedId, setSelectedId] = useState('');
  const [saltId, setSaltId] = useState('');
  const [history, setHistory] = useState(false);
  const [master, setMaster] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<ImportPreview>();
  const [name, setName] = useState('');
  const [info, setInfo] = useState('');
  const [capital, setCapital] = useState(true);
  const [numeral, setNumeral] = useState(true);
  const [hasSymbols, setHasSymbols] = useState(false);
  const [symbols, setSymbols] = useState('');
  const [length, setLength] = useState('');
  const [now, setNow] = useState(Date.now());
  const records = state?.status === 'ready' ? state.records : [];
  const record =
    records.find((record) => record.id === selectedId) ?? records[0];
  const selectedSalt =
    record?.salts.find((salt) => salt.id === saltId) ?? record?.salts[0];
  const ready = state?.status === 'ready';

  useEffect(() => {
    let live = true;
    async function poll() {
      if (busyRef.current) return;
      const current = epoch.current;
      try {
        const result = await window.newpm.loadState();
        if (live && current === epoch.current && result.ok)
          setState(result.value);
      } catch {
        if (live) setError('アプリとの通信に失敗しました。');
      }
    }
    void poll();
    const timer = setInterval(() => {
      setNow(Date.now());
      void poll();
    }, 500);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (state?.status === 'error') setMaster('');
  }, [state?.status]);

  async function perform<T>(
    operation: () => Promise<Result<T>>,
    success: (value: T) => void = () => {},
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    epoch.current++;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await operation();
      if (result.ok) success(result.value);
      else
        setError(
          errorMessage(result.error) +
            (result.diagnostics
              ?.map(
                (d) =>
                  `\n${d.line}行目：${diagnosticMessages[d.code] ?? '形式を確認してください。'}`,
              )
              .join('') ?? ''),
        );
    } catch {
      setError('アプリとの通信に失敗しました。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function resetSelection(value: PublicState) {
    setState(value);
    setSelectedId(value.status === 'ready' ? (value.records[0]?.id ?? '') : '');
    setSaltId('');
    setHistory(false);
    setMaster('');
  }
  function switchTab(value: Tab) {
    setTab(value);
    setPreview(undefined);
    setMaster('');
    setError('');
    setNotice('');
  }
  const clipboard = state?.clipboard;
  const remaining = Math.max(
    0,
    Math.ceil(((clipboard?.expiresAt ?? 0) - now) / 1000),
  );

  return (
    <main>
      <div className="tabs" role="tablist" aria-label="操作">
        <button
          id="generate-tab"
          role="tab"
          aria-selected={tab === 'generate'}
          aria-controls="generate-panel"
          disabled={busy}
          onClick={() => switchTab('generate')}
        >
          パスワード生成
        </button>
        <button
          id="register-tab"
          role="tab"
          aria-selected={tab === 'register'}
          aria-controls="register-panel"
          disabled={busy}
          onClick={() => switchTab('register')}
        >
          サービス登録
        </button>
        <button
          id="migration-tab"
          role="tab"
          aria-selected={tab === 'migration'}
          aria-controls="migration-panel"
          disabled={busy}
          onClick={() => switchTab('migration')}
        >
          旧データ移行
        </button>
      </div>
      {!state && <p role="status">保存データを読み込んでいます…</p>}
      {state?.status === 'error' && (
        <div role="alert" className="error">
          <p>{errorMessage(state.error)} 登録・変更は停止しています。</p>
          <button
            disabled={busy}
            onClick={() => {
              void perform(() => window.newpm.reload(), resetSelection);
            }}
          >
            再読込
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      {tab === 'generate' && (
        <section
          id="generate-panel"
          role="tabpanel"
          aria-labelledby="generate-tab"
        >
          {ready && !records.length && (
            <p>
              サービスがありません。
              <button disabled={busy} onClick={() => switchTab('migration')}>
                旧データを移行
              </button>
              するか、
              <button disabled={busy} onClick={() => switchTab('register')}>
                サービスを登録
              </button>
              してね。
            </p>
          )}
          <fieldset
            className="generation-groups"
            disabled={busy || !ready || !record}
          >
            <div
              className="generation-group"
              role="group"
              aria-label="サービス選択"
            >
              <label htmlFor="service">
                パスワードを生成するサービスを選んでね
              </label>
              <select
                id="service"
                value={record?.id ?? ''}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setSaltId('');
                  setHistory(false);
                  setMaster('');
                }}
              >
                {!record && <option value="">サービスなし</option>}
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.serviceName}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="description">
                サービスの説明
              </label>
              <textarea
                id="description"
                readOnly
                value={record?.serviceInfo ?? ''}
                rows={3}
              />
            </div>
            <div
              className="generation-group"
              role="group"
              aria-label="パスワード変更と履歴"
            >
              <div className="row">
                <button
                  onClick={() => {
                    if (record) {
                      setMaster('');
                      void perform(
                        () => window.newpm.appendSalt(record.id),
                        (value) => {
                          setState(value);
                          setSaltId('');
                          setHistory(false);
                        },
                      );
                    }
                  }}
                >
                  パスワード変更
                </button>
                <label>
                  <input
                    type="checkbox"
                    checked={history}
                    onChange={(event) => {
                      setHistory(event.target.checked);
                      if (!event.target.checked) setSaltId('');
                    }}
                  />
                  以前までのパスワードを使用する
                </label>
              </div>
              {history && (
                <>
                  <label htmlFor="history">パスワード履歴</label>
                  <select
                    id="history"
                    value={selectedSalt?.id ?? ''}
                    onChange={(event) => setSaltId(event.target.value)}
                  >
                    {record?.salts.map((salt) => (
                      <option key={salt.id} value={salt.id}>
                        {salt.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div
              className="generation-group"
              role="group"
              aria-label="マスターパスワード"
            >
              <label htmlFor="master">
                マスターパスワード(8文字以上)を入力してね
              </label>
              <p>
                注意：マスターパスワードは復元不可能だよ
                <br />
                変更も基本的にできないから気をつけてね
              </p>
              <input
                id="master"
                type="password"
                autoComplete="off"
                spellCheck={false}
                maxLength={1024}
                value={master}
                onChange={(event) => setMaster(event.target.value)}
              />
              <div className="generate-action">
                <button
                  onClick={() => {
                    if (!record || !selectedSalt) return;
                    const input = master;
                    setMaster('');
                    void perform(
                      () =>
                        window.newpm.generate(
                          record.id,
                          selectedSalt.id,
                          input,
                        ),
                      setState,
                    );
                  }}
                >
                  生成
                </button>
              </div>
            </div>
          </fieldset>
        </section>
      )}
      {tab === 'register' && (
        <section
          id="register-panel"
          role="tabpanel"
          aria-labelledby="register-tab"
        >
          <fieldset disabled={busy || !ready}>
            <label htmlFor="name">
              サービス名（区別しやすい名前を入れてね）
            </label>
            <input
              id="name"
              maxLength={1024}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <label className="section-start" htmlFor="info">
              ログイン時に必要な情報など（アカウント名とか）
            </label>
            <textarea
              id="info"
              maxLength={100000}
              rows={3}
              value={info}
              onChange={(event) => setInfo(event.target.value)}
            />
            <p className="section-start">
              パスワードに含める条件（小文字は必須）
            </p>
            <div className="row">
              <label>
                <input
                  type="checkbox"
                  checked={capital}
                  onChange={(event) => setCapital(event.target.checked)}
                />
                大文字を1文字以上含める
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={numeral}
                  onChange={(event) => setNumeral(event.target.checked)}
                />
                数字を1文字以上含める
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={hasSymbols}
                  onChange={(event) => {
                    setHasSymbols(event.target.checked);
                    setSymbols('');
                  }}
                />
                記号を1文字以上含める
              </label>
            </div>
            {hasSymbols && (
              <>
                <label htmlFor="symbols">
                  使える記号を入力してね（スペースやコンマ等も記号です）
                </label>
                <input
                  id="symbols"
                  maxLength={1024}
                  value={symbols}
                  onChange={(event) => setSymbols(event.target.value)}
                />
              </>
            )}
            <label className="section-start" htmlFor="length">
              パスワードの最大文字数（8〜64文字）
            </label>
            <input
              className="length"
              id="length"
              type="number"
              min={8}
              max={64}
              step={1}
              value={length}
              onChange={(event) => setLength(event.target.value)}
            />
            <div className="generate-action">
              <button
                onClick={() => {
                  if (hasSymbols && !symbols) {
                    setError('使う記号を入力してね。');
                    return;
                  }
                  void perform(
                    () =>
                      window.newpm.register({
                        serviceName: name,
                        serviceInfo: info,
                        hasCapital: capital,
                        hasNumeral: numeral,
                        symbols: hasSymbols ? symbols : '',
                        passwordLength: Number(length),
                      }),
                    (value) => {
                      resetSelection(value);
                      setName('');
                      setInfo('');
                      setCapital(true);
                      setNumeral(true);
                      setHasSymbols(false);
                      setSymbols('');
                      setLength('');
                      setNotice('サービスを登録しました。');
                    },
                  );
                }}
              >
                登録
              </button>
            </div>
          </fieldset>
        </section>
      )}
      {tab === 'migration' && (
        <section
          id="migration-panel"
          role="tabpanel"
          aria-labelledby="migration-tab"
        >
          <h2>旧PC版からの初回移行</h2>
          <p>
            旧PC版のdata.txtを新形式へ取り込むための機能です。登録データが0件の場合だけ使用できます。
          </p>
          <p>
            JSONへの移行済みの場合、この操作は不要です。EXEと同じフォルダのdata.jsonをそのまま使用してください。
          </p>
          <button
            disabled={busy || !ready || records.length > 0}
            onClick={() => {
              setMaster('');
              void perform(
                () => window.newpm.previewLegacyImport(),
                (p) => setPreview(p ?? undefined),
              );
            }}
          >
            旧PCデータを取り込む
          </button>
          {preview && (
            <section className="preview" aria-label="取り込み確認">
              <h2>旧PCデータの取り込み</h2>
              <p>
                サービス {preview.records} 件、履歴 {preview.salts} 件。
              </p>
              <p>元ファイルをバックアップし、取り込みます。</p>
              <button disabled={busy} onClick={() => setPreview(undefined)}>
                キャンセル
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  const token = preview.token;
                  setPreview(undefined);
                  void perform(
                    () => window.newpm.commitImport(token),
                    resetSelection,
                  );
                }}
              >
                確認して取り込み
              </button>
            </section>
          )}
        </section>
      )}
      <p
        role="status"
        className={clipboard?.state === 'failed' ? 'error' : 'copy-status'}
      >
        {clipboard?.state === 'copied' &&
          `パスワードをコピーしたよ。Ctrl+Vで貼り付けてね。消去まで約${remaining}秒。`}
        {clipboard?.state === 'cleared' &&
          'クリップボードのパスワードを消去しました。'}
        {clipboard?.state === 'changed' &&
          'クリップボードの内容が変更されました。'}
        {clipboard?.state === 'failed' &&
          'クリップボードの消去に失敗しました。再試行しています。'}
      </p>
      {busy && <p role="status">処理しています…</p>}
    </main>
  );
}
