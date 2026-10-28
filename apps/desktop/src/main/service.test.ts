import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { DataStore } from './storage';
import { DesktopService } from './service';
import { OwnedClipboard } from './clipboard';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => fs.rm(path, { recursive: true, force: true })),
  );
});
async function setup() {
  const directory = await fs.mkdtemp(join(tmpdir(), 'newpm-service-'));
  directories.push(directory);
  let text = '';
  const clipboard = new OwnedClipboard({
    readText: async () => text,
    writeText: async (value) => {
      text = value;
    },
  });
  const store = new DataStore(directory);
  const service = new DesktopService(store, clipboard);
  await service.reload();
  return { directory, service, store, copied: () => text };
}

it('runs preview/import/generate/change/history/restart with fictional data', async () => {
  const { service, store, directory, copied } = await setup();
  const preview = service.prepareImport(
    Buffer.from(
      'Example,info,true,true,!@#,12,dummy-old-salt,dummy-new-salt\n',
    ),
  );
  expect(preview).toMatchObject({ records: 1, salts: 2 });
  const imported = await service.commitImport(preview.token);
  if (imported.status !== 'ready') throw new Error('Not ready');
  const record = imported.records[0];
  expect(JSON.stringify(imported)).not.toContain('dummy-old-salt');
  expect(JSON.stringify(imported)).not.toContain('generatorVersion');
  const oldSalt = record.salts[1];
  await service.generate(record.id, oldSalt.id, 'dummyMaster1');
  const old = copied();
  expect(old).toHaveLength(12);
  await service.appendSalt(record.id);
  const changed = store.snapshot();
  expect(changed.records[0].salts).toHaveLength(3);
  expect(changed.records[0].salts[0].value).toMatch(/^[A-Za-z0-9]{64}$/);
  await service.generate(record.id, oldSalt.id, 'dummyMaster1');
  expect(copied()).toBe(old);
  expect(await new DataStore(directory).load()).toEqual(changed);
  const raw = await fs.readFile(store.path, 'utf8');
  expect(raw).not.toContain('dummyMaster1');
  expect(raw).not.toContain(old);
  await service.shutdown();
  expect(copied()).toBe('');
});

it('validates new registrations while preserving first occurrence symbol order', async () => {
  const { service, store } = await setup();
  const input = {
    serviceName: ' Example ',
    serviceInfo: 'first\nsecond',
    hasCapital: true,
    hasNumeral: true,
    symbols: '!! ,¥\\@!',
    passwordLength: 8,
  };
  await service.register(input);
  expect(store.snapshot().records[0]).toMatchObject({
    serviceName: 'Example',
    serviceInfo: 'first\nsecond',
    symbols: '! ,¥\\@',
    passwordLength: 8,
  });
  await expect(service.register(input)).rejects.toMatchObject({
    code: 'duplicate-name',
  });
  for (const patch of [
    { passwordLength: 7 },
    { passwordLength: 65 },
    { passwordLength: 8.5 },
    { serviceName: 'bad\nname' },
    { serviceName: '  ' },
    { symbols: 'abc' },
    { hasCapital: 'true' },
  ]) {
    await expect(
      service.register({ ...input, ...patch }),
    ).rejects.toMatchObject({ code: 'invalid-registration' });
  }
  expect(store.snapshot().records).toHaveLength(1);
});

it('rejects stale/reused preview tokens and protects actual source bytes against later caller mutation', async () => {
  const { service, store } = await setup();
  const source = Buffer.from('Example,,false,false,,16,fictional-salt');
  const preview = service.prepareImport(source);
  source.fill(0);
  await service.commitImport(preview.token);
  expect(store.snapshot().records[0].serviceName).toBe('Example');
  await expect(service.commitImport(preview.token)).rejects.toMatchObject({
    code: 'expired-preview',
  });
  const second = await setup();
  const pending = second.service.prepareImport(
    Buffer.from('Pending,,false,false,,16,fictional'),
  );
  await second.service.register({
    serviceName: 'Another',
    serviceInfo: '',
    hasCapital: false,
    hasNumeral: false,
    symbols: '',
    passwordLength: 16,
  });
  await expect(
    second.service.commitImport(pending.token),
  ).rejects.toMatchObject({ code: 'expired-preview' });
});

it('validates selections and masters in main before writing to the clipboard', async () => {
  const { service, store, copied } = await setup();
  await service.register({
    serviceName: 'Example',
    serviceInfo: '',
    hasCapital: false,
    hasNumeral: false,
    symbols: '',
    passwordLength: 16,
  });
  const record = store.snapshot().records[0];
  for (const master of [
    '',
    'short',
    'nonASCII日本語',
    ' leadingSpace',
    'x'.repeat(1025),
  ]) {
    await expect(
      service.generate(record.id, record.salts[0].id, master),
    ).rejects.toMatchObject({ code: 'invalid-master' });
  }
  await expect(
    service.generate(record.id, 'missing', 'validMaster1'),
  ).rejects.toMatchObject({ code: 'invalid-selection' });
  expect(copied()).toBe('');
});
