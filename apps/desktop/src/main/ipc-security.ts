import type { IpcMainInvokeEvent, WebContents } from 'electron';

export function trustedSender(
  event: IpcMainInvokeEvent,
  contents: WebContents,
  expectedUrl: string,
): boolean {
  return (
    event.sender === contents &&
    event.senderFrame === contents.mainFrame &&
    event.senderFrame?.url === expectedUrl
  );
}
