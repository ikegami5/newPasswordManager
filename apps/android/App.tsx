import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  cleanupImportCache,
  createAndroidService,
  pickImport,
} from './src/adapters';
import {
  MobileError,
  type MobilePreview,
  type MobileState,
} from './src/domain/types';

const service = createAndroidService();
const messages: Record<string, string> = {
  'not-loaded':
    '保存データを読み込めていません。PCのファイルを取り込んでください。',
  'storage-invalid':
    '保存データを読み込めませんでした。PCのファイルを再取り込みしてください。',
  'unsupported-storage':
    'この保存形式・生成版には対応していません。対応するアプリで確認してください。',
  'unsupported-format': '取り込むファイルの保存形式には対応していません。',
  'unsupported-generator': '取り込むファイルの生成版には対応していません。',
  'invalid-document': '設定ファイルの形式が正しくありません。',
  'invalid-encoding': 'UTF-8の設定ファイルを選んでください。',
  'invalid-legacy':
    '旧形式を解析できませんでした。元ファイルは変更していません。',
  'empty-import': 'サービスが0件のファイルは取り込めません。',
  'file-too-large': '10MiB以下の設定ファイルを選んでください。',
  'import-read-failed':
    '選択ファイルを読み込めませんでした。端末上のファイルを選び直してください。',
  'cache-cleanup-failed':
    '取り込み用の一時ファイルを削除できませんでした。ファイルの取り込みをやり直してください。',
  'save-failed': '保存に失敗しました。現在の正常データは保持しています。',
  'save-uncertain':
    '保存の確定状態を確認できません。PCのファイルを再取り込みしてください。',
  'expired-preview':
    '確認後に状態が変わりました。ファイルを選び直してください。',
  'invalid-master': 'マスターは1024文字以内で入力してください。',
  'invalid-selection': 'サービスと履歴を選び直してください。',
  'copy-failed': 'コピーに失敗しました。マスターを再入力してください。',
  exhausted:
    '条件を満たすパスワードを生成できませんでした。条件・saltは変更していません。',
  cancelled:
    '画面の状態が変わったため処理を中断しました。必要なら再度実行してください。',
};
const diagnostics: Record<string, string> = {
  'empty-line': '途中に空行があります。',
  'field-count': '項目が不足しています。',
  'empty-name': 'サービス名がありません。',
  'duplicate-name': 'サービス名が重複しています。',
  'invalid-boolean': '生成条件がtrue/falseではありません。',
  'invalid-length': '生成文字数が正しくありません。',
  'missing-salt': '履歴の値が欠けています。',
  'ambiguous-escape': '区切り文字の復元方法を確認してください。',
};

function Action({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

function GeneratorScreen() {
  const [state, setState] = useState<MobileState>();
  const [selectedId, setSelectedId] = useState('');
  const [saltId, setSaltId] = useState('');
  const [master, setMaster] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<MobilePreview>();
  const [menuOpen, setMenuOpen] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const initialized = useRef(false);
  const records = state?.records ?? [];
  const record =
    records.find((record) => record.id === selectedId) ?? records[0];
  const selectedSalt =
    record?.salts.find((salt) => salt.id === saltId) ?? record?.salts[0];
  const disabled = busy || !!preview;
  const canGenerate =
    state?.status === 'ready' && !!record && !!selectedSalt && !disabled;

  function clearMaster() {
    setMaster('');
    input.current?.clear();
  }
  function resetSelection(value: MobileState) {
    setState(value);
    setSelectedId(value.records[0]?.id ?? '');
    setSaltId('');
    clearMaster();
  }
  async function perform<T>(
    operation: () => Promise<T>,
    success: (result: T) => void = () => {},
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const value = await operation();
      if (alive.current) success(value);
    } catch (error) {
      if (alive.current) {
        if (error instanceof MobileError)
          setError(
            (messages[error.code] ??
              '操作に失敗しました。再度お試しください。') +
              (error.diagnostics
                ?.slice(0, 8)
                .map(
                  (d) =>
                    `\n${d.line}行目：${diagnostics[d.code] ?? '形式を確認してください。'}`,
                )
                .join('') ?? ''),
          );
        else setError('操作に失敗しました。再度お試しください。');
      }
    } finally {
      busyRef.current = false;
      if (alive.current) {
        setBusy(false);
        if (initialized.current) setState(service.state());
      }
    }
  }

  useEffect(() => {
    alive.current = true;
    let active = AppState.currentState === 'active';
    let focused = active;
    const sync = () => {
      const eligible = active && focused;
      service.setVisibility(active, focused);
      if (!eligible) {
        clearMaster();
        input.current?.blur();
      } else if (initialized.current)
        void service.clearClipboard().then((value) => {
          if (alive.current) setState(value);
        });
    };
    sync();
    const change = AppState.addEventListener('change', (value) => {
      active = value === 'active';
      sync();
    });
    const focus = AppState.addEventListener('focus', () => {
      focused = true;
      sync();
    });
    const blur = AppState.addEventListener('blur', () => {
      focused = false;
      sync();
    });
    void perform(
      async () => {
        const value = await service.initialize();
        initialized.current = true;
        cleanupImportCache();
        return value;
      },
      (value) => {
        initialized.current = true;
        resetSelection(value);
      },
    );
    const timer = setInterval(() => {
      if (!initialized.current) return;
      void service.clearClipboard().then((value) => {
        if (alive.current) setState(value);
      });
    }, 1000);
    return () => {
      alive.current = false;
      service.setVisibility(false, false);
      change.remove();
      focus.remove();
      blur.remove();
      clearInterval(timer);
    };
  }, []);

  function importFile() {
    clearMaster();
    Keyboard.dismiss();
    void perform(
      async () => {
        if (!initialized.current) {
          await service.initialize();
          initialized.current = true;
        }
        cleanupImportCache();
        const bytes = await pickImport();
        return bytes ? service.prepareImport(bytes) : null;
      },
      (value) => setPreview(value ?? undefined),
    );
  }
  function dataMenu() {
    clearMaster();
    Keyboard.dismiss();
    setMenuOpen((value) => !value);
  }
  const clipboard = state?.clipboard;
  const clipboardMessage =
    clipboard?.state === 'copied'
      ? `クリップボードへコピーしました。前景では約${clipboard.remainingSeconds}秒後に消去します。他アプリへ貼り付けた後は戻って消去できます。`
      : clipboard?.state === 'cleared'
        ? 'クリップボードのパスワードを消去しました。'
        : clipboard?.state === 'changed'
          ? 'クリップボードの内容が変更されています。別の内容は消去していません。'
          : clipboard?.state === 'failed'
            ? '消去に失敗しました。前景で再試行します。手動消去もお試しください。'
            : '';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'android' ? 'height' : 'padding'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              パスワード生成
            </Text>
            <Action title="データ" disabled={disabled} onPress={dataMenu} />
          </View>
          {menuOpen && (
            <View style={styles.card}>
              <Text>
                PCアプリを終了してコピーしたdata.jsonを取り込んでください。取り込みは全件置換です。
              </Text>
              <Action
                title={
                  records.length ? 'ファイルを再取り込み' : 'ファイルを取り込み'
                }
                disabled={disabled}
                onPress={() => {
                  setMenuOpen(false);
                  importFile();
                }}
              />
            </View>
          )}
          {!state && !error && (
            <Text accessibilityLiveRegion="polite">
              保存データを読み込んでいます…
            </Text>
          )}
          {state?.status === 'error' && (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={styles.error}>
                {messages[state.error ?? 'not-loaded'] ??
                  '保存データを読み込めませんでした。'}
              </Text>
              <Action
                title="ファイルを再取り込み"
                disabled={disabled}
                onPress={importFile}
              />
            </View>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {state?.status === 'ready' && !records.length && (
            <View style={styles.card}>
              <Text>
                PCからコピーした設定ファイルを取り込んでください。Androidではサービスの登録や履歴の追加は行いません。
              </Text>
              <Action
                title="ファイルを選ぶ"
                disabled={disabled}
                onPress={importFile}
              />
            </View>
          )}
          {preview && (
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.heading}>
                取り込み確認
              </Text>
              <Text>
                サービス {preview.records}件、履歴 {preview.salts}件
              </Text>
              {!preview.recovering && (
                <Text>
                  追加 {preview.added}件・削除 {preview.removed}件・変更{' '}
                  {preview.changed}件
                </Text>
              )}
              {preview.recovering && (
                <Text style={styles.error}>
                  保存データを読み込めないため、選択した正常データへ置き換えます。
                </Text>
              )}
              {(preview.removed > 0 || preview.lostSalts > 0) && (
                <Text style={styles.error}>
                  サービス{preview.removed}件、既存履歴{preview.lostSalts}
                  件が新しいデータに含まれていません。
                </Text>
              )}
              <Text>
                {preview.replacing
                  ? '現在のデータを全件置き換えます。元ファイルは変更しません。'
                  : '選択したデータをアプリ内部へ保存します。元ファイルは変更しません。'}
              </Text>
              <View style={styles.actions}>
                <Action
                  title="キャンセル"
                  disabled={busy}
                  onPress={() => {
                    service.cancelPreview();
                    setPreview(undefined);
                  }}
                />
                <Action
                  title={
                    preview.replacing ? '確認して全件置換' : '確認して取り込み'
                  }
                  disabled={busy}
                  onPress={() => {
                    const token = preview.token;
                    setPreview(undefined);
                    void perform(
                      () => service.commitPreview(token),
                      resetSelection,
                    );
                  }}
                />
              </View>
            </View>
          )}
          <View style={styles.group}>
            <Text style={styles.label}>サービス</Text>
            <View style={styles.picker}>
              <Picker
                accessibilityLabel="サービス"
                style={styles.pickerControl}
                dropdownIconColor="#222222"
                enabled={state?.status === 'ready' && !!record && !disabled}
                selectedValue={record?.id ?? ''}
                onValueChange={(value) => {
                  setSelectedId(String(value));
                  setSaltId('');
                  clearMaster();
                }}
              >
                {!record && (
                  <Picker.Item
                    label="サービスなし"
                    value=""
                    color="#222222"
                    style={styles.pickerOption}
                  />
                )}
                {records.map((record) => (
                  <Picker.Item
                    key={record.id}
                    label={record.serviceName}
                    value={record.id}
                    color="#222222"
                    style={styles.pickerOption}
                  />
                ))}
              </Picker>
            </View>
            <ScrollView
              key={record?.id ?? 'empty'}
              style={styles.description}
              contentContainerStyle={styles.descriptionContent}
              nestedScrollEnabled
              accessibilityLabel="サービスの詳細"
            >
              <Text selectable>{record?.serviceInfo ?? ''}</Text>
            </ScrollView>
          </View>
          <View style={styles.group}>
            <Text style={styles.label}>パスワードの履歴</Text>
            <View style={styles.picker}>
              <Picker
                accessibilityLabel="パスワードの履歴"
                style={styles.pickerControl}
                dropdownIconColor="#222222"
                enabled={!!record && !disabled}
                selectedValue={selectedSalt?.id ?? ''}
                onValueChange={(value) => {
                  setSaltId(String(value));
                  clearMaster();
                }}
              >
                {!record && (
                  <Picker.Item
                    label="履歴なし"
                    value=""
                    color="#222222"
                    style={styles.pickerOption}
                  />
                )}
                {record?.salts.map((salt) => (
                  <Picker.Item
                    key={salt.id}
                    label={salt.label}
                    value={salt.id}
                    color="#222222"
                    style={styles.pickerOption}
                  />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.group}>
            <Text style={styles.label}>マスターパスワード</Text>
            <TextInput
              ref={input}
              accessibilityLabel="マスターパスワード"
              style={styles.input}
              value={master}
              onChangeText={setMaster}
              editable={!!record && !disabled}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              spellCheck={false}
              maxLength={1024}
            />
            <Text style={styles.hint}>
              PCと同じマスターを入力してください。空入力も旧版と同様に生成します。
            </Text>
            <Action
              title="生成"
              disabled={!canGenerate}
              onPress={() => {
                if (!record || !selectedSalt) return;
                const value = master;
                clearMaster();
                void perform(
                  () => service.generate(record.id, selectedSalt.id, value),
                  (value) => {
                    setState(value);
                    input.current?.blur();
                    Keyboard.dismiss();
                  },
                );
              }}
            />
          </View>
          {!!clipboardMessage && (
            <Text
              accessibilityLiveRegion="polite"
              style={
                clipboard?.state === 'failed' ? styles.error : styles.status
              }
            >
              {clipboardMessage}
            </Text>
          )}
          <Action
            title="パスワード消去"
            disabled={
              disabled ||
              !clipboard ||
              !['copied', 'failed'].includes(clipboard.state)
            }
            onPress={() => {
              void perform(() => service.clearClipboard(true), setState);
            }}
          />
          {busy && (
            <Text accessibilityLiveRegion="polite">処理しています…</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GeneratorScreen />
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 18, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flexShrink: 1, fontSize: 21, fontWeight: '600', color: '#222' },
  heading: { fontSize: 17, fontWeight: '600' },
  label: { fontSize: 15, fontWeight: '500', color: '#222' },
  group: { gap: 8 },
  card: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#8a9cb4',
    borderRadius: 4,
  },
  picker: { borderWidth: 1, borderColor: '#999', borderRadius: 4 },
  pickerControl: { color: '#222222', backgroundColor: '#ffffff' },
  pickerOption: { color: '#222222', backgroundColor: '#ffffff' },
  description: {
    minHeight: 64,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#aaa',
  },
  descriptionContent: { padding: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
    color: '#222',
  },
  hint: { fontSize: 12, color: '#555' },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 4,
    backgroundColor: '#e7edf4',
    borderWidth: 1,
    borderColor: '#b0bdcc',
  },
  buttonText: { color: '#183c63', fontSize: 15 },
  disabled: { opacity: 0.45 },
  pressed: { backgroundColor: '#d3e1f1' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  error: { color: '#a5241c' },
  status: { color: '#a5550b' },
});
