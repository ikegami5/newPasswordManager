import { expect, it, vi } from 'vitest';
import { OwnedClipboard } from './clipboard';

it('expires from successful completion, preserves other apps content and handles new copies', async () => {
  let time = 0;
  let value = '';
  const io = {
    readText: async () => value,
    writeText: async (text: string) => {
      value = text;
      time += 10;
    },
  };
  const clipboard = new OwnedClipboard(io, () => time);
  await clipboard.copy('fictional-one');
  expect(clipboard.snapshot()).toEqual({ state: 'copied', expiresAt: 30010 });
  time = 30009;
  await clipboard.expire();
  expect(value).toBe('fictional-one');
  await clipboard.copy('fictional-two');
  time = 30020;
  await clipboard.expire();
  expect(value).toBe('fictional-two');
  value = 'other app';
  time = 70000;
  await clipboard.expire();
  expect(value).toBe('other app');
  expect(clipboard.snapshot().state).toBe('changed');
  await clipboard.copy('fictional-three');
  await clipboard.expire(true);
  expect(value).toBe('');
  expect(clipboard.snapshot().state).toBe('cleared');
});

it('keeps the old deadline after a failed copy and reports erase failure honestly', async () => {
  let time = 0;
  let value = '';
  const writeText = vi.fn(async (text: string) => {
    value = text;
  });
  const clipboard = new OwnedClipboard(
    { readText: async () => value, writeText },
    () => time,
  );
  await clipboard.copy('fictional-one');
  writeText.mockRejectedValueOnce(new Error('fictional denial'));
  await expect(clipboard.copy('fictional-two')).rejects.toThrow();
  expect(clipboard.snapshot().expiresAt).toBe(30000);
  time = 30000;
  writeText.mockRejectedValueOnce(new Error('fictional denial'));
  await clipboard.expire();
  expect(clipboard.snapshot().state).toBe('failed');
  expect(value).toBe('fictional-one');
  await clipboard.expire();
  expect(clipboard.snapshot().state).toBe('cleared');
  expect(value).toBe('');
});

it('serializes a deadline read and a new copy', async () => {
  let time = 0;
  let value = '';
  const clipboard = new OwnedClipboard(
    {
      readText: async () => value,
      writeText: async (text) => {
        value = text;
      },
    },
    () => time,
  );
  await clipboard.copy('old');
  time = 30000;
  await Promise.all([clipboard.expire(), clipboard.copy('new')]);
  expect(value).toBe('new');
  expect(clipboard.snapshot()).toEqual({ state: 'copied', expiresAt: 60000 });
});
