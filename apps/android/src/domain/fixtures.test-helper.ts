import { createHash } from 'node:crypto';
import type { DataDocument } from '@newpm/core';
import { MobileStore, type SnapshotFiles } from './storage';
import { MobileClipboard } from './clipboard';
import { MobileService } from './service';

export const sha256 = async (text: string): Promise<string> =>
  createHash('sha256').update(text, 'utf8').digest('hex');
export const sha512 = async (text: string): Promise<string> =>
  createHash('sha512').update(text, 'utf8').digest('hex');
export const document = (
  name = 'Fictional',
  value = 'fictional-salt',
): DataDocument => ({
  formatVersion: 1,
  records: [
    {
      id: 'service-1',
      serviceName: name,
      serviceInfo: 'Fictional info',
      generatorVersion: 'legacy-pc-v1',
      hasCapital: true,
      hasNumeral: true,
      symbols: '!!@#',
      passwordLength: 16,
      salts: [{ id: 'salt-1', value }],
    },
  ],
});
export function memory() {
  const values = new Map<number, string>();
  const io: SnapshotFiles = {
    read: async (slot) => values.get(slot) ?? null,
    write: async (slot, text) => {
      values.set(slot, text);
    },
    remove: async (slot) => {
      values.delete(slot);
    },
  };
  return { values, io };
}
export async function setup() {
  const { values, io } = memory();
  const store = new MobileStore(io, sha256);
  let copied = '';
  let id = 0;
  const clipboard = new MobileClipboard({
    read: async () => copied,
    writeSensitive: async (text) => {
      copied = text;
    },
  });
  const service = new MobileService(
    store,
    clipboard,
    sha512,
    () => `fictional-${++id}`,
  );
  await service.initialize();
  service.setVisibility(true, true);
  return { service, store, clipboard, copied: () => copied, values, io };
}
