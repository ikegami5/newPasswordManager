import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateLegacyPc, legacyHash, LegacyRandom } from './generator';
import { parseLegacyPc } from './parser';
import { mobileReference } from './mobile-reference.test-helper';
import synthetic from '../../../compatibility-fixtures/pc/synthetic.json';
import differences from '../../../compatibility-fixtures/mobile/differences.json';

const fixture = (path: string): string =>
  readFileSync(
    new URL(`../../../compatibility-fixtures/${path}`, import.meta.url),
    'utf8',
  );
const sha512 = (text: string): string =>
  createHash('sha512').update(text, 'utf8').digest('hex');
const text = fixture('pc/records.txt');
const expected = fixture('pc/expected.txt').trimEnd().split('\n');
const master = fixture('pc/master.txt').replace(/\r?\n$/, '');
const parsed = parseLegacyPc(text);
if (!parsed.ok) throw new Error('Fixture parsing failed');
const records = parsed.records;
const mobile = mobileReference();

it('keeps the two independently stored sample documents aligned', () => {
  const lines = fixture('mobile/password-sample.txt').split(/\r?\n/);
  expect(
    lines.filter((line) => /^\d+,/.test(line)).map((line) => line.trimEnd()),
  ).toEqual(
    text
      .trimEnd()
      .split('\n')
      .map((s) => s.trimEnd()),
  );
  const heading = lines.indexOf('出力パスワード（上から順、最新のsaltを使用）');
  expect(lines.slice(heading + 1).filter(Boolean)).toEqual(expected);
  const masterHeading = lines.indexOf('マスターパスワード');
  expect(lines.slice(masterHeading + 1, heading).find(Boolean)).toBe(master);
  expect(records).toHaveLength(67);
  expect(expected).toHaveLength(67);
});

describe('independent 67 GUI expectations', () => {
  it.each(Array.from({ length: 67 }, (_, i) => i))(
    'sample %i: PC and old mobile match',
    async (index) => {
      const record = records[index];
      expect(record.serviceName).toBe(String(index + 1));
      expect(
        await generateLegacyPc(master, record.salts[0], record, sha512),
      ).toBe(expected[index]);
      expect(
        mobile.get_password(
          record.salts[0],
          master,
          record.passwordLength,
          record.hasCapital,
          record.hasNumeral,
          record.symbols,
        ),
      ).toBe(expected[index]);
    },
  );

  it('is independent of reverse order and concurrent requests', async () => {
    const results = await Promise.all(
      [...records]
        .reverse()
        .map((record) =>
          generateLegacyPc(master, record.salts[0], record, sha512),
        ),
    );
    expect(results).toEqual([...expected].reverse());
  });

  it('retains every historical salt and regenerates it after using the latest', async () => {
    for (const [index, record] of records.entries()) {
      const rowSalts = text
        .trimEnd()
        .split('\n')
        [index].split(',')
        .slice(6)
        .map((s) => s.trim())
        .reverse();
      expect(record.salts).toEqual(rowSalts);
      for (const salt of record.salts.slice(1)) {
        const before = await generateLegacyPc(master, salt, record, sha512);
        await generateLegacyPc(master, record.salts[0], record, sha512);
        expect(await generateLegacyPc(master, salt, record, sha512)).toBe(
          before,
        );
      }
    }
  });
});

it('uses 64 binary-output hashes with the original concatenation order', async () => {
  const inputs: string[] = [];
  const hash = await legacyHash('input', 'salt', (s) => {
    inputs.push(s);
    return 'a'.repeat(128);
  });
  expect(inputs).toHaveLength(64);
  expect(inputs[0]).toBe('inputsalt');
  expect(inputs[1]).toBe('salt' + '1010'.repeat(128));
  expect(inputs[2]).toBe('1010'.repeat(128) + 'salt');
  expect(hash).toBe('1010'.repeat(128));
});

it('matches the independently recorded Java random sequence and shuffle', () => {
  const random = new LegacyRandom(12345);
  expect(Array.from({ length: 8 }, () => random.nextInt())).toEqual([
    1553932502, -2090749135, -287790814, -355989640, -716867186, 161804169,
    1402202751, 535445604,
  ]);
  expect(new LegacyRandom(12345).shuffle(['a', 'b', 'c', 'd', 'e'])).toEqual([
    'd',
    'e',
    'a',
    'c',
    'b',
  ]);
});

it('rejects malformed hash results and impossible conditions without logging inputs', async () => {
  const conditions = {
    hasCapital: true,
    hasNumeral: true,
    symbols: '!',
    passwordLength: 1,
  };
  await expect(
    generateLegacyPc('dummy', 'dummy', conditions, sha512),
  ).rejects.toMatchObject({ code: 'exhausted' });
  await expect(
    generateLegacyPc('dummy', 'dummy', conditions, () => 'bad'),
  ).rejects.toMatchObject({ code: 'invalid-digest' });
  for (const passwordLength of [0, -1, 65, 1.5, NaN]) {
    await expect(
      generateLegacyPc(
        'dummy',
        'dummy',
        { ...conditions, passwordLength },
        sha512,
      ),
    ).rejects.toMatchObject({ code: 'invalid-input' });
  }
});

describe('fixed outputs captured from unchanged Scala 2.12.13', () => {
  it.each(synthetic.map((vector, index) => ({ ...vector, index })))(
    'synthetic $index',
    async (vector) => {
      const result = generateLegacyPc(
        vector.master,
        vector.salt,
        vector,
        sha512,
      );
      if ('error' in vector)
        await expect(result).rejects.toMatchObject({ code: vector.error });
      else expect(await result).toBe(vector.expected);
    },
  );
});

describe('documented old mobile differences (do not silently migrate)', () => {
  it.each(differences)(
    'preserves independently captured mobile output for synthetic $index',
    ({ index, expected: mobileExpected }) => {
      const v = synthetic[index];
      expect(
        mobile.get_password(
          v.salt,
          v.master,
          v.passwordLength,
          v.hasCapital,
          v.hasNumeral,
          v.symbols,
        ),
      ).toBe(mobileExpected);
      expect(mobileExpected).not.toBe(v.expected);
    },
  );

  it('isolates modulo rounding to long chunks, while 10..64 stay within exact Number integers', async () => {
    const v = synthetic[1];
    const bits = await legacyHash(v.master, v.salt, sha512);
    expect(mobile.hash_64_times(v.master, v.salt)).toBe(bits);
    for (let length = 4; length <= 64; length++) {
      const width = Math.floor(512 / length);
      let differences = 0;
      for (let i = 0; i < length; i++) {
        const chunk = bits.slice(width * i, width * i + width - 1);
        if (
          new mobile.Binary(chunk).mod(new mobile.Binary('11010')) !==
          Number(BigInt('0b' + chunk) % 26n)
        )
          differences++;
      }
      if (length <= 9) expect(differences).toBeGreaterThan(0);
      else expect(differences).toBe(0);
    }
  });

  it('also reproduces the bounded random overflow difference, independent of password length', () => {
    // Java 17 java.util.Random(76974151).nextInt(26) independently returns 7.
    expect(new LegacyRandom(76974151).nextInt(26)).toBe(7);
    expect(new mobile.Random(76974151).nextInt(26)).toBe(1);
  });
});
