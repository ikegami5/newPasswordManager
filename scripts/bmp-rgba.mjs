import { Buffer } from 'node:buffer';

// Decode the explicitly supported Windows V5 icon source. Older Jimp's BMP
// decoder misreads this BITFIELDS format and discards its alpha channel.
// https://learn.microsoft.com/windows/win32/api/wingdi/ns-wingdi-bitmapv5header
export function decodeBmpRgba(bytes) {
  const invalid = () => {
    throw new Error(
      'Expected an unprofiled 32-bit BGRA BITMAPV5HEADER icon source',
    );
  };
  if (bytes.length < 138 || bytes.toString('ascii', 0, 2) !== 'BM')
    return invalid();
  const offset = bytes.readUInt32LE(10);
  const width = bytes.readInt32LE(18);
  const signedHeight = bytes.readInt32LE(22);
  const height = Math.abs(signedHeight);
  if (
    bytes.readUInt32LE(14) !== 124 ||
    bytes.readUInt16LE(26) !== 1 ||
    bytes.readUInt16LE(28) !== 32 ||
    bytes.readUInt32LE(30) !== 3 ||
    width < 1 ||
    width > 4096 ||
    height < 1 ||
    height > 4096 ||
    offset < 138 ||
    offset + width * height * 4 > bytes.length ||
    bytes.readUInt32LE(54) !== 0x00ff0000 ||
    bytes.readUInt32LE(58) !== 0x0000ff00 ||
    bytes.readUInt32LE(62) !== 0x000000ff ||
    bytes.readUInt32LE(66) !== 0xff000000 ||
    ![0x73524742, 0x57696e20].includes(bytes.readUInt32LE(70)) ||
    bytes.readUInt32LE(126) !== 0 ||
    bytes.readUInt32LE(130) !== 0
  )
    return invalid();
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sourceY = signedHeight > 0 ? height - 1 - y : y;
    for (let x = 0; x < width; x++) {
      const source = offset + (sourceY * width + x) * 4;
      const destination = (y * width + x) * 4;
      data[destination] = bytes[source + 2];
      data[destination + 1] = bytes[source + 1];
      data[destination + 2] = bytes[source];
      data[destination + 3] = bytes[source + 3];
    }
  }
  return { width, height, data };
}
