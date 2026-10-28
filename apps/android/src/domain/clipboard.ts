import { MobileError, type MobileClipboardState } from './types';

export interface MobileClipboardIo {
  read(): Promise<string>;
  writeSensitive(text: string): Promise<void>;
}

export class MobileClipboard {
  private focused = false;
  private text: string | undefined;
  private copiedAt = 0;
  private wallCopiedAt = 0;
  private nextRetryAt = 0;
  private state: MobileClipboardState['state'] = 'idle';
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly io: MobileClipboardIo,
    private readonly now = () => performance.now(),
    private readonly wallNow = Date.now,
  ) {}

  setFocused(value: boolean): void {
    this.focused = value;
  }
  private elapsed(): number {
    return Math.max(
      this.now() - this.copiedAt,
      this.wallNow() - this.wallCopiedAt,
    );
  }
  snapshot(): MobileClipboardState {
    return {
      state: this.state,
      remainingSeconds:
        this.text === undefined
          ? 0
          : Math.max(0, Math.ceil((30_000 - this.elapsed()) / 1000)),
    };
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  copy(text: string, isCurrent: () => boolean): Promise<void> {
    return this.serial(async () => {
      if (!this.focused || !isCurrent()) throw new MobileError('cancelled');
      try {
        await this.io.writeSensitive(text);
      } catch {
        throw new MobileError('copy-failed');
      }
      // If focus was lost during the native write, ownership is still tracked.
      this.text = text;
      this.copiedAt = this.now();
      this.wallCopiedAt = this.wallNow();
      this.nextRetryAt = 0;
      this.state = 'copied';
    });
  }
  clear(manual = false): Promise<void> {
    return this.serial(async () => {
      if (
        !this.focused ||
        this.text === undefined ||
        (!manual && (this.elapsed() < 30_000 || this.now() < this.nextRetryAt))
      )
        return;
      try {
        const current = await this.io.read();
        if (!this.focused) return;
        if (current === this.text) {
          await this.io.writeSensitive('');
          this.state = 'cleared';
        } else this.state = 'changed';
        this.text = undefined;
      } catch {
        this.state = 'failed';
        this.nextRetryAt = this.now() + 5000;
      }
    });
  }
}
