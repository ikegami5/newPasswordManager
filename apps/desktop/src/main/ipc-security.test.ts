import { expect, it } from 'vitest';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { trustedSender } from './ipc-security';

it('accepts only the configured main frame of the configured window at the exact expected URL', () => {
  const frame = { url: 'file:///fictional/index.html' };
  const contents = { mainFrame: frame } as unknown as WebContents;
  const event = {
    sender: contents,
    senderFrame: frame,
  } as unknown as IpcMainInvokeEvent;
  expect(trustedSender(event, contents, frame.url)).toBe(true);
  expect(
    trustedSender({ ...event, sender: {} as WebContents }, contents, frame.url),
  ).toBe(false);
  expect(
    trustedSender(
      { ...event, senderFrame: { ...frame } } as IpcMainInvokeEvent,
      contents,
      frame.url,
    ),
  ).toBe(false);
  expect(trustedSender(event, contents, 'file:///other/index.html')).toBe(
    false,
  );
  expect(
    trustedSender({ ...event, senderFrame: null }, contents, frame.url),
  ).toBe(false);
});
