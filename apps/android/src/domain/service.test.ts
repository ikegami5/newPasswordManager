import { expect, it, vi } from 'vitest';
import { serializeDocument } from '@newpm/core';
import { MobileService } from './service';
import { document, setup, sha512 } from './fixtures.test-helper';

const bytes = (value: ReturnType<typeof document>): Uint8Array =>
  new TextEncoder().encode(serializeDocument(value));

it('previews JSON, preserves its source and keeps copied output/salts out of public state', async () => {
  const { service, copied } = await setup();
  const input = bytes(document());
  const preparing = service.prepareImport(input);
  input.fill(0);
  const preview = await preparing;
  expect(preview).toMatchObject({
    records: 1,
    salts: 1,
    added: 1,
    replacing: false,
  });
  expect(service.state().records).toEqual([]);
  const imported = await service.commitPreview(preview.token);
  expect(imported.records[0].serviceName).toBe('Fictional');
  const result = await service.generate('service-1', 'salt-1', '');
  expect(copied()).toHaveLength(16);
  expect(JSON.stringify(result)).not.toContain(copied());
  expect(JSON.stringify(result)).not.toContain('fictional-salt');
  expect(JSON.stringify(result)).not.toContain('symbols');
});

it('reports replacement losses and can re-import an earlier JSON without changing IDs', async () => {
  const { service, store } = await setup();
  const first = document();
  first.records[0].salts.push({ id: 'old-salt', value: 'old-value' });
  await service.commitPreview(
    (await service.prepareImport(bytes(first))).token,
  );
  const replacement = document('Changed');
  const preview = await service.prepareImport(bytes(replacement));
  expect(preview).toMatchObject({
    replacing: true,
    changed: 1,
    lostSalts: 1,
    removed: 0,
  });
  await service.commitPreview(preview.token);
  expect(store.snapshot()).toEqual(replacement);
  expect(store.backup()).toEqual(first);
  const earlierFile = await service.prepareImport(bytes(first));
  await service.commitPreview(earlierFile.token);
  expect(store.snapshot()).toEqual(first);
});

it('recovers corrupt local storage through a confirmed file import while preserving the remaining good slot', async () => {
  const { service, store, values } = await setup();
  const first = document();
  await service.commitPreview(
    (await service.prepareImport(bytes(first))).token,
  );
  await service.commitPreview(
    (await service.prepareImport(bytes(document('Second')))).token,
  );
  const protectedBytes = values.get(0);
  values.set(1, '{broken');
  expect(await service.initialize()).toMatchObject({
    status: 'error',
    error: 'storage-invalid',
  });
  const replacement = document('Re-imported');
  const preview = await service.prepareImport(bytes(replacement));
  expect(preview).toMatchObject({ recovering: true, replacing: true });
  expect(values.get(1)).toBe('{broken');
  expect((await service.commitPreview(preview.token)).status).toBe('ready');
  expect(store.snapshot()).toEqual(replacement);
  expect(values.get(0)).toBe(protectedBytes);
});

it('does not let file import overwrite an unsupported local storage version', async () => {
  const { service, values } = await setup();
  await service.commitPreview(
    (await service.prepareImport(bytes(document()))).token,
  );
  const future = JSON.parse(values.get(0)!);
  future.storageVersion = 2;
  values.set(0, JSON.stringify(future));
  const before = new Map(values);
  expect(await service.initialize()).toMatchObject({
    status: 'error',
    error: 'unsupported-storage',
  });
  await expect(
    service.prepareImport(bytes(document('Replacement'))),
  ).rejects.toMatchObject({ code: 'unsupported-storage' });
  expect(values).toEqual(before);
});

it('rejects invalid encodings/versions, partial legacy and empty imports without modifying current data', async () => {
  const { service, store } = await setup();
  const first = document();
  await service.commitPreview(
    (await service.prepareImport(bytes(first))).token,
  );
  for (const input of [
    new Uint8Array([255]),
    new TextEncoder().encode('bad'),
    new TextEncoder().encode(''),
    new TextEncoder().encode('{"formatVersion":9,"records":[]}'),
    bytes({ formatVersion: 1, records: [] }),
  ]) {
    await expect(service.prepareImport(input)).rejects.toThrow();
    expect(store.snapshot()).toEqual(first);
  }
});

it('rejects reused/cancelled/stale tokens and preserves the legacy history order', async () => {
  const { service, store } = await setup();
  const input = new TextEncoder().encode(
    'Example,info,true,true,!!@#,16,old,new\n',
  );
  const cancelled = await service.prepareImport(input);
  service.cancelPreview();
  await expect(service.commitPreview(cancelled.token)).rejects.toMatchObject({
    code: 'expired-preview',
  });
  const stale = await service.prepareImport(input);
  await service.initialize();
  await expect(service.commitPreview(stale.token)).rejects.toMatchObject({
    code: 'expired-preview',
  });
  const preview = await service.prepareImport(input);
  await service.commitPreview(preview.token);
  expect(store.snapshot().records[0].salts.map((salt) => salt.value)).toEqual([
    'new',
    'old',
  ]);
  await expect(service.commitPreview(preview.token)).rejects.toMatchObject({
    code: 'expired-preview',
  });
});

it('does not trim/normalize Unicode or whitespace, accepts empty master, and enforces the limit', async () => {
  const { service: original, store, clipboard } = await setup();
  await original.commitPreview(
    (await original.prepareImport(bytes(document()))).token,
  );
  const hash = vi.fn(sha512);
  const service = new MobileService(store, clipboard, hash, () => 'test-id');
  service.setVisibility(true, true);
  await service.generate('service-1', 'salt-1', ' 架空🔑 e\u0301 ');
  expect(hash.mock.calls[0][0]).toBe(' 架空🔑 e\u0301 fictional-salt');
  await service.generate('service-1', 'salt-1', '');
  await expect(
    service.generate('service-1', 'salt-1', 'a'.repeat(1025)),
  ).rejects.toMatchObject({ code: 'invalid-master' });
});

it('suppresses stale generation when focus is lost during a pending native hash', async () => {
  const { service: original, store, clipboard, copied } = await setup();
  await original.commitPreview(
    (await original.prepareImport(bytes(document()))).token,
  );
  let start!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    start = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  const service = new MobileService(
    store,
    clipboard,
    async (text) => {
      if (first) {
        first = false;
        start();
        await gate;
      }
      return sha512(text);
    },
    () => 'id',
  );
  service.setVisibility(true, true);
  const generating = service.generate('service-1', 'salt-1', 'FictionalMaster');
  await started;
  service.setVisibility(false, false);
  release();
  await expect(generating).rejects.toMatchObject({ code: 'cancelled' });
  expect(copied()).toBe('');
});

it('delivers queued focus changes before copying even when every digest resolves synchronously', async () => {
  const { service, copied } = await setup();
  await service.commitPreview(
    (await service.prepareImport(bytes(document()))).token,
  );
  const generating = service.generate('service-1', 'salt-1', 'FictionalMaster');
  const lostFocus = new Promise<void>((resolve) =>
    setTimeout(() => {
      service.setVisibility(false, false);
      resolve();
    }, 0),
  );
  await expect(generating).rejects.toMatchObject({ code: 'cancelled' });
  await lostFocus;
  expect(copied()).toBe('');
});
