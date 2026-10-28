import {
  DocumentError,
  serializeDocument,
  validateDocument,
  type DataDocument,
} from '@newpm/core';
import { maximumFileBytes, MobileError } from './types';

export interface SnapshotFiles {
  read(slot: number): Promise<string | null>;
  write(slot: number, text: string): Promise<void>;
  remove(slot: number): Promise<void>;
}
interface Snapshot {
  storageVersion: 1;
  sequence: number;
  digest: string;
  document: DataDocument;
}

/** Two complete snapshots: the active slot is never overwritten during a save. */
export class MobileStore {
  private current: { slot: number; snapshot: Snapshot } | undefined;
  private document: DataDocument | undefined;
  private candidates: { slot: number; snapshot: Snapshot }[] = [];
  private loaded = false;
  private readOnly = false;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly files: SnapshotFiles,
    private readonly hash: (text: string) => Promise<string>,
  ) {}

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  private async decode(text: string): Promise<Snapshot> {
    if (new TextEncoder().encode(text).length > maximumFileBytes + 1024)
      throw new MobileError('file-too-large');
    const value = JSON.parse(text) as Partial<Snapshot>;
    if (
      value &&
      typeof value === 'object' &&
      'storageVersion' in value &&
      value.storageVersion !== 1
    )
      throw new MobileError('unsupported-storage');
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !==
        'digest,document,sequence,storageVersion' ||
      value.storageVersion !== 1 ||
      !Number.isSafeInteger(value.sequence) ||
      value.sequence! < 1 ||
      typeof value.digest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(value.digest)
    )
      throw new MobileError('storage-invalid');
    const document = validateDocument(value.document);
    if ((await this.hash(serializeDocument(document))) !== value.digest)
      throw new MobileError('storage-invalid');
    return {
      storageVersion: 1,
      sequence: value.sequence!,
      digest: value.digest,
      document,
    };
  }

  snapshot(): DataDocument {
    if (!this.document) throw new MobileError('not-loaded');
    return validateDocument(this.document);
  }

  canRecover(): boolean {
    return this.loaded && !this.readOnly;
  }

  backup(): DataDocument | null {
    if (this.readOnly) return null;
    const candidate = this.candidates
      .filter((value) => value.slot !== this.current?.slot)
      .sort((a, b) => b.snapshot.sequence - a.snapshot.sequence)[0];
    return candidate ? validateDocument(candidate.snapshot.document) : null;
  }

  load(): Promise<DataDocument> {
    return this.serial(async () => {
      this.document = undefined;
      this.current = undefined;
      this.candidates = [];
      this.loaded = false;
      this.readOnly = false;
      let invalid = false;
      for (const slot of [0, 1]) {
        try {
          const text = await this.files.read(slot);
          if (text !== null)
            this.candidates.push({ slot, snapshot: await this.decode(text) });
        } catch (error) {
          invalid = true;
          if (
            (error instanceof DocumentError &&
              error.code !== 'invalid-document') ||
            (error instanceof MobileError &&
              error.code === 'unsupported-storage')
          )
            this.readOnly = true;
        }
      }
      this.loaded = true;
      if (invalid)
        throw new MobileError(
          this.readOnly ? 'unsupported-storage' : 'storage-invalid',
        );
      const ordered = [...this.candidates].sort(
        (a, b) => b.snapshot.sequence - a.snapshot.sequence,
      );
      if (
        ordered.length === 2 &&
        ordered[0].snapshot.sequence === ordered[1].snapshot.sequence
      )
        throw new MobileError('storage-invalid');
      this.current = ordered[0];
      this.document = this.current?.snapshot.document ?? {
        formatVersion: 1,
        records: [],
      };
      return this.snapshot();
    });
  }

  /** Recovery requires a confirmed import; normal replacement needs a valid load. */
  save(document: DataDocument, recovery = false): Promise<DataDocument> {
    const candidate = validateDocument(document);
    return this.serial(async () => {
      if (this.readOnly) throw new MobileError('unsupported-storage');
      if (!this.loaded || (!this.document && !recovery))
        throw new MobileError('not-loaded');
      if (!candidate.records.length) throw new MobileError('empty-import');
      const serialized = serializeDocument(candidate);
      if (new TextEncoder().encode(serialized).length > maximumFileBytes)
        throw new MobileError('file-too-large');
      const protectedSlot =
        this.current?.slot ??
        [...this.candidates].sort(
          (a, b) => b.snapshot.sequence - a.snapshot.sequence,
        )[0]?.slot;
      const target = protectedSlot === 0 ? 1 : 0;
      const sequence =
        Math.max(
          0,
          ...this.candidates.map((value) => value.snapshot.sequence),
        ) + 1;
      if (!Number.isSafeInteger(sequence))
        throw new MobileError('storage-invalid');
      const snapshot: Snapshot = {
        storageVersion: 1,
        sequence,
        digest: await this.hash(serialized),
        document: candidate,
      };
      const text = JSON.stringify(snapshot);
      const oldDocument = this.document;
      try {
        await this.files.write(target, text);
        const readBack = await this.files.read(target);
        if (readBack !== text) throw new MobileError('save-failed');
        await this.decode(readBack);
      } catch {
        // Partial inactive writes must never become a backup or be auto-promoted.
        this.candidates = this.candidates.filter(
          (value) => value.slot !== target,
        );
        try {
          await this.files.remove(target);
        } catch {
          this.document = undefined;
          throw new MobileError('save-uncertain');
        }
        this.document = oldDocument;
        throw new MobileError('save-failed');
      }
      this.current = { slot: target, snapshot };
      this.candidates = [
        ...this.candidates.filter((value) => value.slot !== target),
        this.current,
      ];
      this.document = snapshot.document;
      return this.snapshot();
    });
  }
}
