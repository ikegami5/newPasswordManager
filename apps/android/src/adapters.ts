import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { MobileClipboard } from './domain/clipboard';
import { MobileStore, type SnapshotFiles } from './domain/storage';
import { MobileService } from './domain/service';
import { maximumFileBytes, MobileError } from './domain/types';

// Encode in JS to match the PC's UTF-8 byte policy before crossing the native bridge.
async function digest(
  algorithm: Crypto.CryptoDigestAlgorithm,
  text: string,
): Promise<string> {
  const result = await Crypto.digest(algorithm, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(result), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
export const sha512 = (text: string): Promise<string> =>
  digest(Crypto.CryptoDigestAlgorithm.SHA512, text);
const sha256 = (text: string): Promise<string> =>
  digest(Crypto.CryptoDigestAlgorithm.SHA256, text);

function snapshotFiles(): SnapshotFiles {
  const directory = new Directory(Paths.document, 'newpm');
  const get = (slot: number): File => {
    if (slot !== 0 && slot !== 1) throw new MobileError('storage-invalid');
    directory.create({ intermediates: true, idempotent: true });
    return new File(directory, `snapshot-${slot}.json`);
  };
  return {
    async read(slot) {
      const file = get(slot);
      const existing = directory
        .list()
        .find((entry) => entry.name === file.name);
      if (!existing) return null;
      if (
        !(existing instanceof File) ||
        existing.size > maximumFileBytes + 1024
      )
        throw new MobileError('storage-invalid');
      const bytes = await existing.bytes();
      if (bytes.length > maximumFileBytes + 1024)
        throw new MobileError('file-too-large');
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },
    async write(slot, text) {
      const file = get(slot);
      file.create({ overwrite: true });
      await file.write(text);
    },
    async remove(slot) {
      const file = get(slot);
      const existing = directory
        .list()
        .find((entry) => entry.name === file.name);
      if (existing && !(existing instanceof File))
        throw new MobileError('storage-invalid');
      if (existing) existing.delete();
    },
  };
}

export function createAndroidService(): MobileService {
  const clipboard = new MobileClipboard({
    read: () => Clipboard.getStringAsync(),
    async writeSensitive(text) {
      if (
        !(await Clipboard.setStringAsync(text, {
          android: { isSensitive: true },
        }))
      )
        throw new MobileError('copy-failed');
    },
  });
  return new MobileService(
    new MobileStore(snapshotFiles(), sha256),
    clipboard,
    sha512,
    () => Crypto.randomUUID(),
  );
}

/** Only picker copies inside this app's cache are ever deleted. */
export async function pickImport(): Promise<Uint8Array | null> {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch {
    throw new MobileError('import-read-failed');
  }
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  const cache = new Directory(Paths.cache, 'DocumentPicker');
  if (
    !file.uri.startsWith(cache.uri.endsWith('/') ? cache.uri : cache.uri + '/')
  )
    throw new MobileError('import-read-failed');
  let bytes: Uint8Array | undefined;
  let failure: MobileError | undefined;
  try {
    if (!file.exists) throw new MobileError('import-read-failed');
    if (
      file.size > maximumFileBytes ||
      (asset.size !== undefined && asset.size > maximumFileBytes)
    )
      throw new MobileError('file-too-large');
    bytes = await file.bytes();
    if (bytes.length > maximumFileBytes)
      throw new MobileError('file-too-large');
  } catch (error) {
    failure =
      error instanceof MobileError
        ? error
        : new MobileError('import-read-failed');
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      failure = new MobileError('cache-cleanup-failed');
    }
  }
  if (failure) throw failure;
  return bytes!;
}

export function cleanupImportCache(): void {
  try {
    const cache = new Directory(Paths.cache, 'DocumentPicker');
    if (cache.exists) cache.delete();
  } catch {
    throw new MobileError('cache-cleanup-failed');
  }
}
