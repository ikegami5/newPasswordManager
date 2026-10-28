import { expect, it } from 'vitest';
import {
  migrateLegacyRecords,
  parseDocument,
  serializeDocument,
  validateDocument,
} from './document';
import { parseLegacyPc } from '../legacy/parser';

function document() {
  const legacy = parseLegacyPc('Example,info,true,true,!!#@,4,old,new');
  if (!legacy.ok) throw new Error('Bad test input');
  let id = 0;
  return migrateLegacyRecords(legacy.records, () => `id-${++id}`);
}

it('round trips IDs, versions, exact symbols, and history without storing secrets', () => {
  const value = document();
  expect(value.records[0]).toMatchObject({
    generatorVersion: 'legacy-pc-v1',
    symbols: '!!#@',
    passwordLength: 4,
    salts: [
      { id: 'id-2', value: 'new' },
      { id: 'id-3', value: 'old' },
    ],
  });
  expect(parseDocument(serializeDocument(value))).toEqual(value);
  const clone = validateDocument(value);
  clone.records[0].salts.reverse();
  expect(value.records[0].salts[0].value).toBe('new');
});

it.each([
  '{',
  'null',
  '{"formatVersion":2,"records":[]}',
  '{"formatVersion":1,"records":[],"master":"fictional"}',
])('rejects invalid/unknown documents (%s)', (text) => {
  expect(() => parseDocument(text)).toThrow();
});

it('rejects unknown algorithms, duplicate IDs/names, empty history, and invalid conditions', () => {
  const base = document();
  for (const patch of [
    { generatorVersion: 'future' },
    { salts: [] },
    { passwordLength: 65 },
    { hasCapital: 'false' },
    { id: '../path' },
    { master: 'fictional' },
  ]) {
    expect(() =>
      validateDocument({
        ...base,
        records: [{ ...base.records[0], ...patch }],
      }),
    ).toThrow();
  }
  expect(() =>
    validateDocument({ ...base, records: [base.records[0], base.records[0]] }),
  ).toThrow();
  const salt = base.records[0].salts[0];
  expect(() =>
    validateDocument({
      ...base,
      records: [{ ...base.records[0], salts: [salt, salt] }],
    }),
  ).toThrow();
});
