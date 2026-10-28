// Test-only execution of unchanged, pinned legacy sources. No native I/O runs.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

interface MobileReference {
  Random: new (seed: number) => { nextInt(bound: number): number };
  Binary: new (bits: string) => {
    mod(divisor: { value: string }): number;
    value: string;
  };
  hash_64_times: (master: string, salt: string) => string;
  get_password: (
    salt: string,
    master: string,
    length: number,
    capital: boolean,
    numeral: boolean,
    symbols: string,
  ) => string;
  parse_records: (text: string) => unknown[];
}

export function mobileReference(): MobileReference {
  const source = ['binary', 'random', 'util']
    .map((name) =>
      readFileSync(
        new URL(
          `../../../compatibility-fixtures/mobile/${name}.js.txt`,
          import.meta.url,
        ),
        'utf8',
      )
        .replace(/^import .*;\r?\n/gm, '')
        .replace(/^export \{[^}]+\};\r?$/gm, '')
        .replace(/^export /gm, ''),
    )
    .join('\n');
  return runInNewContext(
    source + '\n({get_password, parse_records, Random, Binary, hash_64_times})',
    {
      sha512: (text: string) =>
        createHash('sha512').update(text, 'utf8').digest('hex'),
      console: { log: () => {} },
    },
  ) as MobileReference;
}
