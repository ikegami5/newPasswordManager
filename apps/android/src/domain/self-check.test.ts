import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import gui from '../../../../packages/compatibility-fixtures/pc/gui-sample.json';
import { runCompatibilityCheck } from './compatibility.test-helper';
import { sha512 } from './fixtures.test-helper';

it('packages the original GUI fixture values without generating new expectations', () => {
  const fixture = (name: string) =>
    readFileSync(
      new URL(
        `../../../../packages/compatibility-fixtures/pc/${name}`,
        import.meta.url,
      ),
      'utf8',
    );
  expect(gui.master).toBe(fixture('master.txt').replace(/\n$/, ''));
  expect(gui.rows).toEqual(
    fixture('records.txt').replace(/\n$/, '').split('\n'),
  );
  expect(gui.expected).toEqual(
    fixture('expected.txt').replace(/\n$/, '').split('\n'),
  );
});

it('runs the same 67 GUI and 92 Scala vectors and returns only aggregate results', async () => {
  const result = await runCompatibilityCheck(sha512, () => {});
  expect(result).toEqual({
    completed: 159,
    passed: 159,
    failed: 0,
    total: 159,
  });
});

it('can stop on background/focus changes without reading user data', async () => {
  let completed = 0;
  await expect(
    runCompatibilityCheck(
      sha512,
      (progress) => {
        completed = progress.completed;
      },
      () => completed < 2,
    ),
  ).rejects.toMatchObject({ code: 'cancelled' });
});
