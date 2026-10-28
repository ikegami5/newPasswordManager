import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';
import { configureStoragePaths } from './paths';

const directories: string[] = [];
afterEach(() => {
  directories
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true }));
});
it.each([
  { packaged: true, profile: '', expected: 'portable' },
  { packaged: false, profile: '', expected: 'dev-app' },
  {
    packaged: true,
    profile: 'fictional-validation',
    expected: 'temp/new-password-manager-tests/fictional-validation',
  },
  {
    packaged: false,
    profile: 'fictional-validation',
    expected: 'temp/new-password-manager-tests/fictional-validation',
  },
])(
  'uses the EXE directory in production and isolates $profile (packaged=$packaged)',
  ({ packaged, profile, expected }) => {
    const root = mkdtempSync(join(tmpdir(), 'newpm-paths-'));
    directories.push(root);
    const calls: string[] = [];
    const app = {
      isPackaged: packaged,
      getAppPath: () => join(root, 'dev-app'),
      getPath: (name: 'temp' | 'exe') =>
        name === 'exe'
          ? join(root, 'portable', 'New Password Manager.exe')
          : join(root, 'temp'),
      setPath: (name: 'userData' | 'sessionData', path: string) => {
        expect(existsSync(path)).toBe(true);
        calls.push(name);
      },
    };
    const directory = configureStoragePaths(app, profile);
    expect(directory).toBe(join(root, expected));
    expect(calls).toEqual(['userData', 'sessionData']);
    expect(existsSync(join(directory, 'data.json'))).toBe(false);
  },
);

it('refuses malformed test profile paths before touching the filesystem or normal profile', () => {
  const app = {
    isPackaged: true,
    getAppPath: vi.fn(),
    getPath: vi.fn(),
    setPath: vi.fn(),
  };
  for (const profile of ['../normal', 'a/b', 'space name', 'a'.repeat(65)])
    expect(() => configureStoragePaths(app, profile)).toThrow(
      'invalid-test-profile',
    );
  expect(app.getPath).not.toHaveBeenCalled();
  expect(app.setPath).not.toHaveBeenCalled();
});
