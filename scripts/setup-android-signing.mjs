import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.umask(0o077);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, '.local-tools', 'android-signing');
const credentials = join(directory, 'release.properties');
const keystore = join(directory, 'release.keystore');
// Refuse to overwrite any existing signing material, including partial setup.
for (const path of [credentials, keystore]) {
  try {
    await access(path, constants.F_OK);
    throw new Error(
      'Signing material already exists; preserve it for future updates.',
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
if (!process.env.JAVA_HOME) throw new Error('Run source scripts/env.sh first.');
await mkdir(directory, { recursive: true, mode: 0o700 });
const password = randomBytes(32).toString('hex');
await writeFile(
  credentials,
  `storeFile=release.keystore\nstorePassword=${password}\nkeyAlias=newpm-release\nkeyPassword=${password}\n`,
  { mode: 0o600, flag: 'wx' },
);
try {
  execFileSync(
    join(process.env.JAVA_HOME, 'bin', 'keytool'),
    [
      '-genkeypair',
      '-keystore',
      keystore,
      '-storetype',
      'PKCS12',
      '-alias',
      'newpm-release',
      '-keyalg',
      'RSA',
      '-keysize',
      '3072',
      '-validity',
      '10000',
      '-dname',
      'CN=New Password Manager',
      '-storepass:env',
      'NEWPM_KEYTOOL_PASSWORD',
      '-keypass:env',
      'NEWPM_KEYTOOL_PASSWORD',
    ],
    {
      env: { ...process.env, NEWPM_KEYTOOL_PASSWORD: password },
      stdio: 'pipe',
    },
  );
  // keytool creates the keystore; limit its permissions as well.
  const { chmod } = await import('node:fs/promises');
  await chmod(keystore, 0o600);
} catch {
  throw new Error(
    'Signing setup failed. Private files were preserved for inspection; no credentials were printed.',
  );
}
console.log(
  'Release signing key created in .local-tools/android-signing/. Back up the whole directory privately.',
);
