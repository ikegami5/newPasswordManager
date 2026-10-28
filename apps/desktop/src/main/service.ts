import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { generateLegacyPc, parseLegacyPc } from '@newpm/core';
import { DataStore, LegacyImportError, StorageError } from './storage';
import { OwnedClipboard } from './clipboard';
import type {
  ImportPreview,
  PublicState,
  RegistrationInput,
} from '../shared/api';

export class ServiceError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function salt(): string {
  const alphabet =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  while (result.length < 64) {
    for (const byte of randomBytes(128)) {
      if (byte < 248) result += alphabet[byte % 62];
      if (result.length === 64) break;
    }
  }
  return result;
}

function registration(input: unknown): RegistrationInput {
  if (!input || typeof input !== 'object')
    throw new ServiceError('invalid-input');
  const v = input as Record<string, unknown>;
  if (
    typeof v.serviceName !== 'string' ||
    typeof v.serviceInfo !== 'string' ||
    typeof v.symbols !== 'string' ||
    typeof v.hasCapital !== 'boolean' ||
    typeof v.hasNumeral !== 'boolean' ||
    typeof v.passwordLength !== 'number' ||
    !Number.isInteger(v.passwordLength) ||
    v.passwordLength < 8 ||
    v.passwordLength > 64 ||
    v.serviceName.length > 1024 ||
    v.serviceInfo.length > 100_000 ||
    v.symbols.length > 1024 ||
    !v.serviceName.trim() ||
    [...v.serviceName].some(
      (c) =>
        c.charCodeAt(0) < 32 ||
        (c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159) ||
        c === '\u2028' ||
        c === '\u2029',
    ) ||
    // Old registration accepts printable ASCII punctuation and space only.
    /[^\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e\u00a5]/.test(v.symbols)
  )
    throw new ServiceError('invalid-registration');
  return {
    serviceName: v.serviceName.trim(),
    serviceInfo: v.serviceInfo,
    symbols: [...new Set(v.symbols)].join(''),
    hasCapital: v.hasCapital,
    hasNumeral: v.hasNumeral,
    passwordLength: v.passwordLength,
  };
}

/** Main-only service. Public state contains no generator parameters or salt values. */
export class DesktopService {
  private loadError = 'not-loaded';
  private revision = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private preview:
    | {
        token: string;
        revision: number;
        bytes: Buffer;
      }
    | undefined;
  constructor(
    readonly store: DataStore,
    readonly clipboard: OwnedClipboard,
  ) {}

  async shutdown(): Promise<void> {
    await this.queue;
    await this.clipboard.expire(true);
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  state(): PublicState {
    const clipboard = this.clipboard.snapshot();
    try {
      const document = this.store.snapshot();
      return {
        status: 'ready',
        clipboard,
        records: document.records.map((record) => ({
          id: record.id,
          serviceName: record.serviceName,
          serviceInfo: record.serviceInfo,
          salts: record.salts.map((salt, i) => ({
            id: salt.id,
            label: i === 0 ? '現在のパスワード' : `${i}個前のパスワード`,
          })),
        })),
      };
    } catch {
      return { status: 'error', clipboard, error: this.loadError };
    }
  }

  reload(): Promise<PublicState> {
    return this.serial(async () => {
      this.preview = undefined;
      try {
        await this.store.load();
      } catch (error) {
        this.loadError =
          error instanceof StorageError ? error.code : 'read-failed';
      }
      this.revision++;
      return this.state();
    });
  }

  generate(
    serviceId: unknown,
    saltId: unknown,
    master: unknown,
  ): Promise<PublicState> {
    return this.serial(async () => {
      if (typeof master !== 'string' || !/^[a-zA-Z0-9]{8,1024}$/.test(master))
        throw new ServiceError('invalid-master');
      const record = this.store
        .snapshot()
        .records.find((record) => record.id === serviceId);
      const selected = record?.salts.find((salt) => salt.id === saltId);
      if (!record || !selected) throw new ServiceError('invalid-selection');
      const password = await generateLegacyPc(
        master,
        selected.value,
        record,
        (text) => createHash('sha512').update(text, 'utf8').digest('hex'),
      );
      try {
        await this.clipboard.copy(password);
      } catch {
        throw new ServiceError('copy-failed');
      }
      return this.state();
    });
  }

  register(input: unknown): Promise<PublicState> {
    return this.serial(async () => {
      const v = registration(input);
      await this.store.update((document) => {
        if (
          document.records.some(
            (record) => record.serviceName === v.serviceName,
          )
        )
          throw new ServiceError('duplicate-name');
        document.records.push({
          ...v,
          id: randomUUID(),
          generatorVersion: 'legacy-pc-v1',
          salts: [{ id: randomUUID(), value: salt() }],
        });
        return document;
      });
      this.revision++;
      return this.state();
    });
  }

  appendSalt(serviceId: unknown): Promise<PublicState> {
    return this.serial(async () => {
      await this.store.update((document) => {
        const record = document.records.find(
          (record) => record.id === serviceId,
        );
        if (!record) throw new ServiceError('invalid-selection');
        record.salts.unshift({ id: randomUUID(), value: salt() });
        return document;
      });
      this.revision++;
      return this.state();
    });
  }

  prepareImport(source: Buffer): ImportPreview {
    this.preview = undefined;
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(source);
    } catch {
      throw new ServiceError('invalid-document');
    }
    if (this.store.snapshot().records.length)
      throw new ServiceError('import-not-empty');
    const parsed = parseLegacyPc(text);
    if (!parsed.ok) throw new LegacyImportError(parsed.diagnostics);
    if (!parsed.records.length) throw new ServiceError('empty-import');
    const token = randomUUID();
    this.preview = {
      token,
      revision: this.revision,
      bytes: Buffer.from(source),
    };
    return {
      token,
      records: parsed.records.length,
      salts: parsed.records.reduce((n, record) => n + record.salts.length, 0),
    };
  }

  commitImport(token: unknown): Promise<PublicState> {
    return this.serial(async () => {
      const preview = this.preview;
      this.preview = undefined;
      if (
        !preview ||
        preview.token !== token ||
        preview.revision !== this.revision
      )
        throw new ServiceError('expired-preview');
      await this.store.importLegacy(preview.bytes);
      this.revision++;
      return this.state();
    });
  }
}
