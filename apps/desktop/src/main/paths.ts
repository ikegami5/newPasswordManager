import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface ApplicationPaths {
  isPackaged: boolean;
  getAppPath(): string;
  getPath(name: 'temp' | 'exe'): string;
  setPath(name: 'userData' | 'sessionData', path: string): void;
}

/** Electron requires overridden paths to exist before setPath, before ready. */
export function configureStoragePaths(
  app: ApplicationPaths,
  testProfile: string,
): string {
  if (testProfile && !/^[a-zA-Z0-9-]{1,64}$/.test(testProfile))
    throw new Error('invalid-test-profile');
  const directory = testProfile
    ? join(app.getPath('temp'), 'new-password-manager-tests', testProfile)
    : app.isPackaged
      ? dirname(app.getPath('exe'))
      : app.getAppPath();
  const session = join(directory, 'session');
  mkdirSync(session, { recursive: true, mode: 0o700 });
  app.setPath('userData', directory);
  app.setPath('sessionData', session);
  return directory;
}
