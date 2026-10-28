import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeBmpRgba } from './bmp-rgba.mjs';

function fixture(topDown = false) {
  const bytes = Buffer.alloc(138 + 16);
  bytes.write('BM');
  bytes.writeUInt32LE(bytes.length, 2);
  bytes.writeUInt32LE(138, 10);
  bytes.writeUInt32LE(124, 14);
  bytes.writeInt32LE(2, 18);
  bytes.writeInt32LE(topDown ? -2 : 2, 22);
  bytes.writeUInt16LE(1, 26);
  bytes.writeUInt16LE(32, 28);
  bytes.writeUInt32LE(3, 30);
  [0x00ff0000, 0x0000ff00, 0x000000ff, 0xff000000, 0x73524742].forEach(
    (value, i) => bytes.writeUInt32LE(value, 54 + i * 4),
  );
  const rows = [
    [0, 0, 255, 255, 0, 255, 0, 128],
    [255, 0, 0, 0, 30, 20, 10, 64],
  ];
  bytes.set((topDown ? rows : rows.toReversed()).flat(), 138);
  return bytes;
}

for (const topDown of [false, true])
  test(`preserves RGBA, alpha and orientation (topDown=${topDown})`, () => {
    const result = decodeBmpRgba(fixture(topDown));
    assert.equal(result.width, 2);
    assert.equal(result.height, 2);
    assert.deepEqual(
      [...result.data],
      [255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 64],
    );
  });

test('rejects incomplete data and incompatible channel masks instead of silently changing colors', () => {
  assert.throws(() => decodeBmpRgba(fixture().subarray(0, 145)));
  const bytes = fixture();
  bytes.writeUInt32LE(0, 66);
  assert.throws(() => decodeBmpRgba(bytes));
});

test('rejects invalid dimensions and embedded profiles', () => {
  const bytes = fixture();
  bytes.writeInt32LE(0, 18);
  assert.throws(() => decodeBmpRgba(bytes));
  const profiled = fixture();
  profiled.writeUInt32LE(1, 130);
  assert.throws(() => decodeBmpRgba(profiled));
});
