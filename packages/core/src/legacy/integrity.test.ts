import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import sources from '../../../compatibility-fixtures/sources.json';

it.each(sources)(
  'keeps pinned original bytes unchanged: $path',
  ({ path, sha256 }) => {
    const bytes = readFileSync(
      new URL(`../../../compatibility-fixtures/${path}`, import.meta.url),
    );
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
  },
);
