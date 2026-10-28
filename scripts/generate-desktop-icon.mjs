// Optional asset maintenance command; normal builds use the committed ICO.
// jimp-compact 0.16.1 is already installed through Expo's image-utils.
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { decodeBmpRgba } from './bmp-rgba.mjs';

const require = createRequire(import.meta.url);
const Jimp = require('jimp-compact');
const directory = new URL('../apps/desktop/resources/', import.meta.url);
const original = await readFile(new URL('icon-source.bmp', directory));
const image = new Jimp(decodeBmpRgba(original));
await writeFile(
  new URL('icon-preview.png', directory),
  await image.getBufferAsync(Jimp.MIME_PNG),
);

const sizes = [16, 24, 32, 48, 64, 128, 256];
const frames = await Promise.all(
  sizes.map((size) =>
    image
      .clone()
      .resize(size, size, Jimp.RESIZE_BICUBIC)
      .getBufferAsync(Jimp.MIME_PNG),
  ),
);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [i, size] of sizes.entries()) {
  const entry = 6 + 16 * i;
  header[entry] = header[entry + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frames[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frames[i].length;
}
await writeFile(
  new URL('icon.ico', directory),
  Buffer.concat([header, ...frames]),
);
console.log('Generated desktop ICO: 16, 24, 32, 48, 64, 128, 256 px');
