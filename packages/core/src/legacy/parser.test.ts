import { expect, it } from 'vitest';
import { parseLegacyPc } from './parser';

it.each(['\n', '\r\n', '\r'])(
  'decodes escapes, PC trim and reverses history once (%j)',
  (newline) => {
    expect(
      parseLegacyPc(
        ' name\\Ctest , first\\nsecond\\Cend , TRUE , false , !!\\S\\C , 04 , old , new ' +
          newline,
      ),
    ).toEqual({
      ok: true,
      records: [
        {
          serviceName: 'name,test',
          serviceInfo: 'first\nsecond,end',
          hasCapital: true,
          hasNumeral: false,
          symbols: '!! ,',
          passwordLength: 4,
          salts: ['new', 'old'],
        },
      ],
    });
  },
);

it('preserves Unicode whitespace that Scala trim does not remove', () => {
  const parsed = parseLegacyPc(
    '\u00a0name\u00a0,,false,false,,1,\u00a0salt\u00a0',
  );
  expect(parsed.ok && parsed.records[0].serviceName).toBe('\u00a0name\u00a0');
  expect(parsed.ok && parsed.records[0].salts).toEqual(['\u00a0salt\u00a0']);
});

it.each([
  ['bad', 'field-count'],
  ['name,,true,no,,16,salt', 'invalid-boolean'],
  ['name,,false,false,,16junk,salt', 'invalid-length'],
  ['name,,false,false,,65,salt', 'invalid-length'],
  ['name,,false,false,,0,salt', 'invalid-length'],
  ['name,,false,false,,16,', 'missing-salt'],
  [',,false,false,,16,salt', 'empty-name'],
  ['name\\\\C,,false,false,,16,salt', 'ambiguous-escape'],
])('reports only line number and code (%s)', (row, code) => {
  expect(parseLegacyPc(row)).toEqual({
    ok: false,
    diagnostics: [{ line: 1, code }],
  });
});

it('never returns partial records on errors, including interior blank lines and duplicate decoded names', () => {
  const row = 'name\\Ctest,,false,false,,16,salt';
  expect(parseLegacyPc(row + '\n\n' + row)).toEqual({
    ok: false,
    diagnostics: [
      { line: 2, code: 'empty-line' },
      { line: 3, code: 'duplicate-name' },
    ],
  });
});

it('accepts empty files and trailing newlines without creating phantom records', () => {
  expect(parseLegacyPc('')).toEqual({ ok: true, records: [] });
  expect(parseLegacyPc('\n')).toEqual({ ok: true, records: [] });
  expect(parseLegacyPc('name,,false,false,,16,salt\n\n')).toMatchObject({
    ok: true,
    records: [{ salts: ['salt'] }],
  });
});
