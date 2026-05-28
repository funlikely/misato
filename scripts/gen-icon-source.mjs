// Generates a 1024x1024 solid-color PNG used as the source for `tauri icon`.
// Pure Node stdlib (no deps). Run with: node scripts/gen-icon-source.mjs
import { writeFileSync } from "node:fs";
import zlib from "node:zlib";

const W = 1024;
const H = 1024;
const [r, g, b] = [0xff, 0x6f, 0xa5]; // Misato pink

const row = 1 + W * 4;
const raw = Buffer.alloc(row * H);
for (let y = 0; y < H; y++) {
  raw[y * row] = 0;
  for (let x = 0; x < W; x++) {
    const i = y * row + 1 + x * 4;
    raw[i] = r;
    raw[i + 1] = g;
    raw[i + 2] = b;
    raw[i + 3] = 0xff;
  }
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync("icon-source.png", png);
console.log("wrote icon-source.png", png.length, "bytes");
