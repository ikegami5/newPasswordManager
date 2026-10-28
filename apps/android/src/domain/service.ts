import {
  DocumentError,
  LegacyGenerationError,
  generateLegacyPc,
  migrateLegacyRecords,
  parseDocument,
  parseLegacyPc,
  type DataDocument,
  type Sha512,
} from '@newpm/core';
import { MobileStore } from './storage';
import { MobileClipboard } from './clipboard';
import {
  maximumFileBytes,
  MobileError,
  type MobilePreview,
  type MobileState,
} from './types';

function failure(error: unknown): MobileError {
  if (error instanceof MobileError) return error;
  if (error instanceof DocumentError || error instanceof LegacyGenerationError)
    return new MobileError(error.code);
  return new MobileError('operation-failed');
}

export class MobileService {
  private active = false;
  private focused = false;
  private epoch = 0;
  private revision = 0;
  private loadError = 'not-loaded';
  private queue: Promise<unknown> = Promise.resolve();
  private preview:
    | { public: MobilePreview; document: DataDocument; revision: number }
    | undefined;
  constructor(
    readonly store: MobileStore,
    readonly clipboard: MobileClipboard,
    private readonly sha512: Sha512,
    private readonly uuid: () => string,
  ) {}

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation).catch((error) => {
      throw failure(error);
    });
    this.queue = result.catch(() => {});
    return result;
  }

  setVisibility(active: boolean, focused: boolean): void {
    if (!active || !focused) this.epoch++;
    this.active = active;
    this.focused = focused;
    this.clipboard.setFocused(active && focused);
  }

  state(): MobileState {
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
            label: i === 0 ? '現在のパスワード' : `${i}つ前のパスワード`,
          })),
        })),
      };
    } catch {
      return {
        status: 'error',
        error: this.loadError,
        records: [],
        clipboard,
      };
    }
  }

  initialize(): Promise<MobileState> {
    this.epoch++;
    return this.serial(async () => {
      this.preview = undefined;
      try {
        await this.store.load();
        this.loadError = '';
      } catch (error) {
        this.loadError = failure(error).code;
      }
      this.revision++;
      return this.state();
    });
  }

  generate(
    serviceId: string,
    saltId: string,
    master: string,
  ): Promise<MobileState> {
    const epoch = this.epoch;
    return this.serial(async () => {
      if (typeof master !== 'string' || master.length > 1024)
        throw new MobileError('invalid-master');
      if (!this.active || !this.focused || epoch !== this.epoch)
        throw new MobileError('cancelled');
      const record = this.store
        .snapshot()
        .records.find((record) => record.id === serviceId);
      const salt = record?.salts.find((salt) => salt.id === saltId);
      if (!record || !salt) throw new MobileError('invalid-selection');
      const password = await generateLegacyPc(
        master,
        salt.value,
        record,
        this.sha512,
      );
      // Native digest can finish synchronously. Deliver pending visibility events
      // before checking whether this result is still eligible for copying.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      await this.clipboard.copy(
        password,
        () => epoch === this.epoch && this.active && this.focused,
      );
      return this.state();
    });
  }

  async clearClipboard(manual = false): Promise<MobileState> {
    await this.clipboard.clear(manual);
    return this.state();
  }

  private createPreview(document: DataDocument): MobilePreview {
    if (!document.records.length) throw new MobileError('empty-import');
    let old: DataDocument | undefined;
    try {
      old = this.store.snapshot();
    } catch {
      if (!this.store.canRecover())
        throw new MobileError('unsupported-storage');
    }
    const oldRecords = old?.records ?? [];
    const oldById = new Map(oldRecords.map((record) => [record.id, record]));
    const nextById = new Map(
      document.records.map((record) => [record.id, record]),
    );
    const view: MobilePreview = {
      token: this.uuid(),
      records: document.records.length,
      salts: document.records.reduce((n, record) => n + record.salts.length, 0),
      added: document.records.filter((record) => !oldById.has(record.id))
        .length,
      removed: oldRecords.filter((record) => !nextById.has(record.id)).length,
      changed: document.records.filter(
        (record) =>
          oldById.has(record.id) &&
          JSON.stringify(record) !== JSON.stringify(oldById.get(record.id)),
      ).length,
      lostSalts: oldRecords.reduce(
        (n, record) =>
          n +
          record.salts.filter(
            (salt) =>
              !nextById
                .get(record.id)
                ?.salts.some(
                  (next) => next.id === salt.id && next.value === salt.value,
                ),
          ).length,
        0,
      ),
      replacing: oldRecords.length > 0 || !old,
      recovering: !old,
    };
    this.preview = { public: view, document, revision: this.revision };
    return { ...view };
  }

  prepareImport(bytes: Uint8Array): Promise<MobilePreview> {
    this.epoch++;
    const source = bytes.slice();
    return this.serial(async () => {
      this.preview = undefined;
      if (source.length > maximumFileBytes)
        throw new MobileError('file-too-large');
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(source);
      } catch {
        throw new MobileError('invalid-encoding');
      }
      let document: DataDocument;
      if (/^\s*[[{]/.test(text)) document = parseDocument(text);
      else {
        const result = parseLegacyPc(text);
        if (!result.ok)
          throw new MobileError('invalid-legacy', result.diagnostics);
        document = migrateLegacyRecords(result.records, this.uuid);
      }
      return this.createPreview(document);
    });
  }

  cancelPreview(): void {
    this.preview = undefined;
  }

  commitPreview(token: string): Promise<MobileState> {
    this.epoch++;
    return this.serial(async () => {
      const preview = this.preview;
      this.preview = undefined;
      if (
        !preview ||
        preview.public.token !== token ||
        preview.revision !== this.revision
      )
        throw new MobileError('expired-preview');
      try {
        await this.store.save(preview.document, preview.public.recovering);
      } catch (error) {
        if (error instanceof MobileError && error.code === 'save-uncertain')
          this.loadError = 'save-uncertain';
        throw error;
      }
      this.revision++;
      return this.state();
    });
  }
}
