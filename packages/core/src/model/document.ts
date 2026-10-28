import type { LegacyConditions } from '../legacy/generator';
import type { LegacyRecord } from '../legacy/parser';

export interface ServiceRecord extends LegacyConditions {
  id: string;
  serviceName: string;
  serviceInfo: string;
  generatorVersion: 'legacy-pc-v1';
  salts: { id: string; value: string }[];
}

export interface DataDocument {
  formatVersion: 1;
  records: ServiceRecord[];
}

export class DocumentError extends Error {
  constructor(
    public readonly code:
      'invalid-document' | 'unsupported-format' | 'unsupported-generator',
  ) {
    super(code);
    this.name = 'DocumentError';
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

const validId = (id: unknown): id is string =>
  typeof id === 'string' && /^[\w-]{1,128}$/.test(id);

/** Validates before constructing a fresh object; no coercion, truncation or normalization. */
export function validateDocument(value: unknown): DataDocument {
  const invalid = (): never => {
    throw new DocumentError('invalid-document');
  };
  if (!object(value)) return invalid();
  if (value.formatVersion !== 1) throw new DocumentError('unsupported-format');
  if (
    !exactKeys(value, ['formatVersion', 'records']) ||
    !Array.isArray(value.records)
  )
    return invalid();
  const recordIds = new Set<string>();
  const names = new Set<string>();
  const records = value.records.map((record): ServiceRecord => {
    if (!object(record)) return invalid();
    if (record.generatorVersion !== 'legacy-pc-v1')
      throw new DocumentError('unsupported-generator');
    if (
      !exactKeys(record, [
        'id',
        'serviceName',
        'serviceInfo',
        'generatorVersion',
        'hasCapital',
        'hasNumeral',
        'symbols',
        'passwordLength',
        'salts',
      ]) ||
      !validId(record.id) ||
      recordIds.has(record.id) ||
      typeof record.serviceName !== 'string' ||
      !record.serviceName ||
      names.has(record.serviceName) ||
      typeof record.serviceInfo !== 'string' ||
      typeof record.symbols !== 'string' ||
      typeof record.hasCapital !== 'boolean' ||
      typeof record.hasNumeral !== 'boolean' ||
      typeof record.passwordLength !== 'number' ||
      !Number.isInteger(record.passwordLength) ||
      record.passwordLength < 1 ||
      record.passwordLength > 64 ||
      !Array.isArray(record.salts) ||
      !record.salts.length
    )
      return invalid();
    recordIds.add(record.id);
    names.add(record.serviceName);
    const saltIds = new Set<string>();
    const salts = record.salts.map((salt) => {
      if (
        !object(salt) ||
        !exactKeys(salt, ['id', 'value']) ||
        !validId(salt.id) ||
        saltIds.has(salt.id) ||
        typeof salt.value !== 'string' ||
        !salt.value
      )
        return invalid();
      saltIds.add(salt.id);
      return { id: salt.id, value: salt.value };
    });
    return {
      id: record.id,
      serviceName: record.serviceName,
      serviceInfo: record.serviceInfo,
      generatorVersion: 'legacy-pc-v1',
      hasCapital: record.hasCapital,
      hasNumeral: record.hasNumeral,
      symbols: record.symbols,
      passwordLength: record.passwordLength,
      salts,
    };
  });
  return { formatVersion: 1, records };
}

export function parseDocument(text: string): DataDocument {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DocumentError('invalid-document');
  }
  return validateDocument(value);
}

export function serializeDocument(document: DataDocument): string {
  return JSON.stringify(validateDocument(document), null, 2) + '\n';
}

/** Called only after legacy preview approval. Preserves symbols and latest-first salts. */
export function migrateLegacyRecords(
  records: LegacyRecord[],
  createId: () => string,
): DataDocument {
  return validateDocument({
    formatVersion: 1,
    records: records.map((record) => ({
      ...record,
      id: createId(),
      generatorVersion: 'legacy-pc-v1',
      salts: record.salts.map((value) => ({ id: createId(), value })),
    })),
  });
}
