import type { ClipboardStatus } from '../shared/api';

export interface ClipboardIo {
  readText(): Promise<string>;
  writeText(value: string): Promise<void>;
}

/** Ownership and deadlines live only in main. All clipboard I/O is serialized. */
export class OwnedClipboard {
  private text: string | undefined;
  private status: ClipboardStatus = { state: 'idle' };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly io: ClipboardIo,
    private readonly now: () => number = Date.now,
  ) {}

  snapshot(): ClipboardStatus {
    return { ...this.status };
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  copy(text: string): Promise<void> {
    return this.serial(async () => {
      // Failed copies leave the previous ownership/deadline intact.
      await this.io.writeText(text);
      this.text = text;
      this.status = { state: 'copied', expiresAt: this.now() + 30_000 };
    });
  }

  expire(force = false): Promise<void> {
    return this.serial(async () => {
      if (
        this.text === undefined ||
        (!force && this.now() < this.status.expiresAt!)
      )
        return;
      try {
        if ((await this.io.readText()) === this.text) {
          await this.io.writeText('');
          this.status = { state: 'cleared' };
        } else this.status = { state: 'changed' };
        this.text = undefined;
      } catch {
        this.status = { state: 'failed', expiresAt: this.status.expiresAt };
        // Preserve ownership for another deadline check or normal exit retry.
      }
    });
  }
}
