import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { DataStore, type StorageIo } from './storage';
import { type DataDocument, serializeDocument } from '@newpm/core';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => fs.rm(path, { recursive: true, force: true })),
  );
});
async function setup(io: StorageIo = fs) {
  const directory = await fs.mkdtemp(join(tmpdir(), 'newpm-storage-'));
  directories.push(directory);
  const store = new DataStore(directory, io);
  return { directory, store };
}
const row = (name = 'Fictional'): Buffer =>
  Buffer.from(`${name},test,true,true,!!@#,16,old,new\r\n`);

it('does not create an empty file on first load and survives import/restart exactly', async () => {
  const { store, directory } = await setup();
  expect(await store.load()).toEqual({ formatVersion: 1, records: [] });
  expect(await fs.readdir(directory)).toEqual([]);
  const source = row();
  const result = await store.importLegacy(source);
  expect(result.records[0].salts.map((salt) => salt.value)).toEqual([
    'new',
    'old',
  ]);
  const originals = (await fs.readdir(directory)).filter((path) =>
    path.startsWith('legacy-import-'),
  );
  expect(originals).toHaveLength(1);
  expect(await fs.readFile(join(directory, originals[0]))).toEqual(source);
  expect(await new DataStore(directory).load()).toEqual(result);
  await expect(store.importLegacy(row('Second'))).rejects.toMatchObject({
    code: 'import-not-empty',
  });
});

it('backs up the exact previous bytes and serializes mutations against the latest state', async () => {
  const { store, directory } = await setup();
  await store.load();
  await store.importLegacy(row());
  await Promise.all([
    store.update((doc) => {
      doc.records[0].serviceInfo += '-first';
      return doc;
    }),
    store.update((doc) => {
      doc.records[0].serviceInfo += '-second';
      return doc;
    }),
  ]);
  expect(store.snapshot().records[0].serviceInfo).toBe('test-first-second');
  const backup = JSON.parse(
    await fs.readFile(store.backupPath, 'utf8'),
  ) as DataDocument;
  expect(backup.records[0].serviceInfo).toBe('test-first');
  expect((await new DataStore(directory).load()).records[0].serviceInfo).toBe(
    'test-first-second',
  );
});

it.each(['rename', 'write', 'sync', 'backup'] as const)(
  'preserves committed file and memory when %s fails',
  async (failure) => {
    let enabled = false;
    const io: StorageIo = {
      ...fs,
      rename: async (from, to) => {
        if (
          enabled &&
          ((failure === 'rename' && to.toString().endsWith('data.json')) ||
            (failure === 'backup' && to.toString().endsWith('.bak')))
        )
          throw Object.assign(new Error('fictional failure'), {
            code: 'EACCES',
          });
        return fs.rename(from, to);
      },
      open: async (...args) => {
        const handle = await fs.open(...args);
        const primary = !args[0].toString().includes('.bak.');
        if (enabled && primary && failure === 'write')
          vi.spyOn(handle, 'writeFile').mockRejectedValueOnce(
            new Error('fictional disk full'),
          );
        if (enabled && primary && failure === 'sync')
          vi.spyOn(handle, 'sync').mockRejectedValueOnce(
            new Error('fictional flush failure'),
          );
        return handle;
      },
    };
    const { store, directory } = await setup(io);
    await store.load();
    await store.importLegacy(row());
    const before = store.snapshot();
    const bytes = await fs.readFile(store.path);
    enabled = true;
    await expect(
      store.update((doc) => {
        doc.records[0].salts.unshift({ id: 'unsaved', value: 'fictional' });
        return doc;
      }),
    ).rejects.toMatchObject({ code: 'save-failed' });
    expect(store.snapshot()).toEqual(before);
    expect(await fs.readFile(store.path)).toEqual(bytes);
    expect(
      (await fs.readdir(directory)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  },
);

it('blocks writes on corrupt data and preserves the original and good backup', async () => {
  const { store, directory } = await setup();
  await store.load();
  const valid = await store.importLegacy(row());
  const backup = Buffer.from(serializeDocument(valid));
  await fs.writeFile(store.backupPath, backup);
  await fs.writeFile(store.path, 'broken-json');
  await expect(store.load()).rejects.toMatchObject({
    code: 'invalid-document',
  });
  await expect(store.update(() => valid)).rejects.toMatchObject({
    code: 'not-loaded',
  });
  expect(await fs.readFile(store.backupPath)).toEqual(backup);
  expect(await fs.readFile(store.path, 'utf8')).toBe('broken-json');
  // Simulate user-managed replacement while the application is stopped.
  await fs.writeFile(store.path, backup);
  expect(await new DataStore(directory).load()).toEqual(valid);
});

it('does not treat permissions errors as first launch or permit writes', async () => {
  const { store } = await setup({
    ...fs,
    readFile: vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('denied'), { code: 'EACCES' }),
      ),
  });
  await expect(store.load()).rejects.toMatchObject({ code: 'read-failed' });
  await expect(store.update((document) => document)).rejects.toMatchObject({
    code: 'not-loaded',
  });
});

it('blocks external changes until reload and never promotes leftover temporary files', async () => {
  const { store, directory } = await setup();
  await fs.writeFile(join(directory, 'data.json.fictional.tmp'), 'invalid');
  await store.load();
  expect(store.snapshot().records).toEqual([]);
  await fs.writeFile(store.path, 'changed-outside');
  await expect(store.update((doc) => doc)).rejects.toMatchObject({
    code: 'external-change',
  });
  expect(await fs.readFile(store.path, 'utf8')).toBe('changed-outside');
  await expect(store.update((doc) => doc)).rejects.toMatchObject({
    code: 'not-loaded',
  });
});

it('does not save partial, invalid UTF-8 or empty imports', async () => {
  const { store, directory } = await setup();
  await store.load();
  for (const bytes of [
    Buffer.from('bad'),
    Buffer.from([0xff]),
    Buffer.from(''),
  ])
    await expect(store.importLegacy(bytes)).rejects.toThrow();
  expect(await fs.readdir(directory)).toEqual([]);
});

it('never overwrites unknown future file or generator versions', async () => {
  const { store } = await setup();
  const bytes = '{"formatVersion":2,"records":[]}';
  await fs.writeFile(store.path, bytes);
  await expect(store.load()).rejects.toMatchObject({
    code: 'unsupported-format',
  });
  await expect(store.update((document) => document)).rejects.toMatchObject({
    code: 'not-loaded',
  });
  expect(await fs.readFile(store.path, 'utf8')).toBe(bytes);
});
