import { expect, it } from 'vitest';
import { MobileStore } from './storage';
import { document, memory, sha256 } from './fixtures.test-helper';

it('keeps exact IDs/symbols/history, retains a previous generation and survives restart', async () => {
  const { values, io } = memory();
  const store = new MobileStore(io, sha256);
  expect(await store.load()).toEqual({ formatVersion: 1, records: [] });
  expect(values.size).toBe(0);
  const first = document();
  first.records[0].salts.push({ id: 'salt-old', value: 'old-fictional' });
  await store.save(first);
  expect(store.backup()).toBe(null);
  const next = document('Updated');
  await store.save(next);
  expect(store.snapshot()).toEqual(next);
  expect(store.backup()).toEqual(first);
  expect(await new MobileStore(io, sha256).load()).toEqual(next);
});

it.each(['partial-write', 'readback', 'cleanup'] as const)(
  'protects the active generation on %s failure',
  async (failure) => {
    const { io, values } = memory();
    const store = new MobileStore(io, sha256);
    await store.load();
    const original = document();
    await store.save(original);
    const active = values.get(0);
    io.write = async (slot, text) => {
      values.set(
        slot,
        failure === 'readback' ? text + 'broken' : text.slice(0, 30),
      );
      if (failure !== 'readback') throw new Error('fictional full disk');
    };
    if (failure === 'cleanup')
      io.remove = async () => {
        throw new Error('fictional denial');
      };
    await expect(store.save(document('Updated'))).rejects.toMatchObject({
      code: failure === 'cleanup' ? 'save-uncertain' : 'save-failed',
    });
    expect(values.get(0)).toBe(active);
    if (failure === 'cleanup') {
      expect(() => store.snapshot()).toThrow();
      const restarted = new MobileStore(io, sha256);
      await expect(restarted.load()).rejects.toThrow();
      expect(restarted.backup()).toEqual(original);
    } else {
      expect(store.snapshot()).toEqual(original);
      expect(await new MobileStore(io, sha256).load()).toEqual(original);
    }
  },
);

it('does not silently fall back on corrupt current data; explicit recovery preserves the good slot', async () => {
  const { io, values } = memory();
  const store = new MobileStore(io, sha256);
  await store.load();
  const first = document();
  await store.save(first);
  await store.save(document('Next'));
  const protectedBytes = values.get(0);
  values.set(1, '{broken');
  const restarted = new MobileStore(io, sha256);
  await expect(restarted.load()).rejects.toMatchObject({
    code: 'storage-invalid',
  });
  expect(() => restarted.snapshot()).toThrow();
  expect(restarted.backup()).toEqual(first);
  await expect(restarted.save(first)).rejects.toMatchObject({
    code: 'not-loaded',
  });
  await restarted.save(first, true);
  expect(values.get(0)).toBe(protectedBytes);
  expect(await new MobileStore(io, sha256).load()).toEqual(first);
});

it('detects modified conditions by digest and blocks unknown storage/model/generator versions', async () => {
  for (const mode of ['digest', 'storage', 'format', 'generator']) {
    const { io, values } = memory();
    const store = new MobileStore(io, sha256);
    await store.load();
    await store.save(document());
    const raw = JSON.parse(values.get(0)!);
    if (mode === 'digest') raw.document.records[0].symbols = '#!';
    if (mode === 'storage') raw.storageVersion = 2;
    if (mode === 'format') raw.document.formatVersion = 2;
    if (mode === 'generator')
      raw.document.records[0].generatorVersion = 'future';
    values.set(0, JSON.stringify(raw));
    const restarted = new MobileStore(io, sha256);
    await expect(restarted.load()).rejects.toThrow();
    if (mode !== 'digest') {
      expect(restarted.backup()).toBe(null);
      await expect(restarted.save(document(), true)).rejects.toMatchObject({
        code: 'unsupported-storage',
      });
    }
  }
});

it('does not interpret read permissions failures as empty data or persist empty replacements', async () => {
  const { io } = memory();
  io.read = async () => {
    throw new Error('fictional denied');
  };
  const store = new MobileStore(io, sha256);
  await expect(store.load()).rejects.toThrow();
  expect(() => store.snapshot()).toThrow();
  await expect(
    store.save({ formatVersion: 1, records: [] }, true),
  ).rejects.toMatchObject({ code: 'empty-import' });
});
