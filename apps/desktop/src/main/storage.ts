import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  DocumentError,
  parseDocument,
  serializeDocument,
  validateDocument,
  parseLegacyPc,
  migrateLegacyRecords,
  type LegacyDiagnostic,
  type DataDocument,
} from '@newpm/core';

export type StorageIo = Pick<
  typeof fs,
  'readFile' | 'mkdir' | 'open' | 'rename' | 'unlink'
>;
export type StorageErrorCode =
  | 'not-loaded'
  | 'read-failed'
  | 'save-failed'
  | 'external-change'
  | 'invalid-document'
  | 'unsupported-format'
  | 'unsupported-generator'
  | 'import-not-empty'
  | 'empty-import'
  | 'invalid-legacy';
export class StorageError extends Error {
  constructor(public readonly code: StorageErrorCode) {
    super(code);
    this.name = 'StorageError';
  }
}

export class LegacyImportError extends StorageError {
  constructor(public readonly diagnostics: LegacyDiagnostic[]) {
    super('invalid-legacy');
  }
}

function missing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

export class DataStore {
  readonly path: string;
  readonly backupPath: string;
  private document: DataDocument | undefined;
  private original: Buffer | undefined;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly directory: string,
    private readonly io: StorageIo = fs,
  ) {
    this.path = join(directory, 'data.json');
    this.backupPath = join(directory, 'data.json.bak');
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  snapshot(): DataDocument {
    if (!this.document) throw new StorageError('not-loaded');
    return validateDocument(this.document);
  }

  load(): Promise<DataDocument> {
    return this.serial(async () => {
      this.document = undefined;
      this.original = undefined;
      try {
        let bytes: Buffer;
        try {
          bytes = await this.io.readFile(this.path);
        } catch (error) {
          if (!missing(error)) throw error;
          this.document = { formatVersion: 1, records: [] };
          return this.snapshot();
        }
        this.original = bytes;
        const parsed = parseDocument(
          new TextDecoder('utf-8', { fatal: true }).decode(bytes),
        );
        this.document = parsed;
        return this.snapshot();
      } catch (error) {
        throw new StorageError(
          error instanceof DocumentError ? error.code : 'read-failed',
        );
      }
    });
  }

  /** All mutations run against the latest committed snapshot inside this queue. */
  update(
    change: (current: DataDocument) => DataDocument,
  ): Promise<DataDocument> {
    return this.serial(async () => {
      const current = this.snapshot();
      const candidate = validateDocument(change(current));
      return this.persist(candidate);
    });
  }

  private async persist(candidate: DataDocument): Promise<DataDocument> {
    const bytes = Buffer.from(serializeDocument(candidate), 'utf8');
    try {
      let disk: Buffer | undefined;
      try {
        disk = await this.io.readFile(this.path);
      } catch (error) {
        if (!missing(error)) throw error;
      }
      if (
        (disk === undefined) !== (this.original === undefined) ||
        (disk && !disk.equals(this.original!))
      ) {
        // Refuse further writes until the externally changed file is reloaded.
        this.document = undefined;
        throw new StorageError('external-change');
      }
      await this.io.mkdir(this.directory, { recursive: true, mode: 0o700 });
      if (disk) await this.atomicWrite(this.backupPath, disk);
      await this.atomicWrite(this.path, bytes);
      this.original = bytes;
      this.document = candidate;
      return this.snapshot();
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError('save-failed');
    }
  }

  /** Original bytes are retained before the first migrated JSON is committed. */
  importLegacy(source: Buffer): Promise<DataDocument> {
    const originalBytes = Buffer.from(source);
    return this.serial(async () => {
      if (this.snapshot().records.length)
        throw new StorageError('import-not-empty');
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(originalBytes);
      } catch {
        throw new StorageError('invalid-legacy');
      }
      const parsed = parseLegacyPc(text);
      if (!parsed.ok) throw new LegacyImportError(parsed.diagnostics);
      if (!parsed.records.length) throw new StorageError('empty-import');
      const candidate = migrateLegacyRecords(parsed.records, randomUUID);
      try {
        await this.io.mkdir(this.directory, { recursive: true, mode: 0o700 });
        await this.atomicWrite(
          join(this.directory, `legacy-import-${randomUUID()}.txt`),
          originalBytes,
        );
      } catch {
        throw new StorageError('save-failed');
      }
      return this.persist(candidate);
    });
  }

  private async atomicWrite(path: string, bytes: Buffer): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const handle = await this.io.open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await this.io.rename(temporary, path);
    } finally {
      // A failed cleanup must not report a committed rename as a failed save.
      await this.io.unlink(temporary).catch(() => {});
    }
  }
}
