import { generateLegacyPc, parseLegacyPc, type Sha512 } from '@newpm/core';
import gui from '../../../../packages/compatibility-fixtures/pc/gui-sample.json';
import synthetic from '../../../../packages/compatibility-fixtures/pc/synthetic.json';
import { MobileError } from './types';

export interface CheckProgress {
  completed: number;
  passed: number;
  failed: number;
  total: number;
}

/** Local test helper only; never imported by the Android app. */
export async function runCompatibilityCheck(
  sha512: Sha512,
  progress: (value: CheckProgress) => void,
  shouldContinue: () => boolean = () => true,
): Promise<CheckProgress> {
  const parsed = parseLegacyPc(gui.rows.join('\n'));
  if (!parsed.ok || parsed.records.length !== 67 || gui.expected.length !== 67)
    throw new MobileError('self-check-failed');
  const result: CheckProgress = {
    completed: 0,
    passed: 0,
    failed: 0,
    total: 67 + synthetic.length,
  };
  const check = async (operation: () => Promise<boolean>): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (!shouldContinue()) throw new MobileError('cancelled');
    let passed = false;
    try {
      passed = await operation();
    } catch {
      /* Only aggregate results leave this function. */
    }
    if (passed) result.passed++;
    else result.failed++;
    result.completed++;
    progress({ ...result });
  };
  for (const [i, record] of parsed.records.entries()) {
    await check(
      async () =>
        (await generateLegacyPc(
          gui.master,
          record.salts[0],
          record,
          sha512,
        )) === gui.expected[i],
    );
  }
  for (const vector of synthetic) {
    await check(async () => {
      try {
        const output = await generateLegacyPc(
          vector.master,
          vector.salt,
          vector,
          sha512,
        );
        return !('error' in vector) && output === vector.expected;
      } catch (error) {
        return (
          'error' in vector &&
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === vector.error
        );
      }
    });
  }
  return { ...result };
}
