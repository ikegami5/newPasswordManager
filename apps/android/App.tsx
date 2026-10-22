import { StyleSheet, Text, View } from 'react-native';
import { applicationName } from '@newpm/core';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{applicationName}</Text>
      <Text>Androidの環境構築確認用画面です。</Text>
      <Text>パスワード生成・データ移行はまだ実装していません。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
});
