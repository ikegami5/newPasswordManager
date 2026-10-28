import { expect, it, vi } from 'vitest';
import { MobileClipboard } from './clipboard';

it('does not read the clipboard in background and clears an expired owned copy after focus returns', async () => {
  let now = 0;
  let text = '';
  const read = vi.fn(async () => text);
  const clipboard = new MobileClipboard(
    {
      read,
      writeSensitive: async (value) => {
        text = value;
      },
    },
    () => now,
    () => now,
  );
  clipboard.setFocused(true);
  await clipboard.copy('fictional', () => true);
  clipboard.setFocused(false);
  now = 40000;
  await clipboard.clear();
  expect(read).not.toHaveBeenCalled();
  expect(text).toBe('fictional');
  clipboard.setFocused(true);
  await clipboard.clear();
  expect(text).toBe('');
  expect(clipboard.snapshot().state).toBe('cleared');
});

it('keeps the deadline on failed recopy, preserves other apps text and never clears at initial startup', async () => {
  let now = 0;
  let text = 'other';
  const read = vi.fn(async () => text);
  const write = vi.fn(async (value: string) => {
    text = value;
  });
  const clipboard = new MobileClipboard(
    { read, writeSensitive: write },
    () => now,
    () => now,
  );
  clipboard.setFocused(true);
  await clipboard.clear(true);
  expect(read).not.toHaveBeenCalled();
  await clipboard.copy('fictional', () => true);
  now = 15000;
  write.mockRejectedValueOnce(new Error('fictional failure'));
  await expect(clipboard.copy('other result', () => true)).rejects.toThrow();
  expect(clipboard.snapshot().remainingSeconds).toBe(15);
  text = 'another app';
  now = 31000;
  await clipboard.clear();
  expect(text).toBe('another app');
  expect(clipboard.snapshot().state).toBe('changed');
});

it('handles focus loss during copy completion without losing ownership or extending its deadline', async () => {
  let now = 0;
  let text = '';
  let complete!: () => void;
  const clipboard = new MobileClipboard(
    {
      read: async () => text,
      writeSensitive: async (value) => {
        text = value;
        await new Promise<void>((resolve) => {
          complete = resolve;
        });
      },
    },
    () => now,
    () => now,
  );
  clipboard.setFocused(true);
  const copying = clipboard.copy('fictional', () => true);
  await Promise.resolve();
  clipboard.setFocused(false);
  now = 1000;
  complete();
  await copying;
  expect(clipboard.snapshot().remainingSeconds).toBe(30);
  now = 31001;
  expect(clipboard.snapshot().remainingSeconds).toBe(0);
  await clipboard.clear(true);
  expect(text).toBe('fictional');
});

it('rechecks focus after a pending read and retries erase failures honestly', async () => {
  let text = '';
  const write = vi.fn(async (value: string) => {
    text = value;
  });
  const clipboard: MobileClipboard = new MobileClipboard({
    read: async () => {
      clipboard.setFocused(false);
      return text;
    },
    writeSensitive: write,
  });
  clipboard.setFocused(true);
  await clipboard.copy('fictional', () => true);
  await clipboard.clear(true);
  expect(text).toBe('fictional');
  expect(write).toHaveBeenCalledTimes(1);
  const second = new MobileClipboard({
    read: async () => text,
    writeSensitive: write,
  });
  second.setFocused(true);
  await second.copy('fictional-two', () => true);
  write.mockRejectedValueOnce(new Error('fictional denial'));
  await second.clear(true);
  expect(second.snapshot().state).toBe('failed');
  await second.clear(true);
  expect(second.snapshot().state).toBe('cleared');
});
