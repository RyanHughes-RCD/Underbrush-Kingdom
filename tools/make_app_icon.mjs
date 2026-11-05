// Draws the app icon from the game's own sprite data: the three heroes, each
// holding a crafted weapon, in a forest clearing. Pixel art at a low
// resolution, scaled up by whole numbers.
//
// Run: node tools/make_app_icon.mjs
// Writes assets/icons/: icon-512.png, icon-192.png (any purpose),
// maskable-512.png, maskable-192.png (content kept in the safe zone),
// apple-touch-icon.png (180) and favicon-32.png.

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, decode, tintedBody } from '../js/sprites.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sheet = JSON.parse(readFileSync(join(root, 'assets/sprites/sprites.json')));

// ---------- Tiny RGBA canvas ----------

function canvas(w, h) { return { w, h, px: new Uint8ClampedArray(w * h * 4) }; }
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function set(cv, x, y, rgb, a = 255) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= cv.w || y >= cv.h) return;
  const i = (y * cv.w + x) * 4, k = a / 255;
  for (let c = 0; c < 3; c++) cv.px[i + c] = cv.px[i + c] * (1 - k) + rgb[c] * k;
  cv.px[i + 3] = Math.max(cv.px[i + 3], a);
}
function blit(cv, rgba, w, h, ox, oy, flip = false) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + (flip ? w - 1 - x : x)) * 4;
    if (rgba[i + 3]) set(cv, ox + x, oy + y, [rgba[i], rgba[i + 1], rgba[i + 2]], rgba[i + 3]);
  }
}
function scaleUp(cv, k) {
  const out = canvas(cv.w * k, cv.h * k);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const s = ((Math.floor(y / k) * cv.w) + Math.floor(x / k)) * 4, d = (y * out.w + x) * 4;
    out.px.set(cv.px.subarray(s, s + 4), d);
  }
  return out;
}
// Box-filter downscale, for the small sizes that aren't whole multiples.
function resize(cv, size) {
  const out = canvas(size, size), k = cv.w / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const acc = [0, 0, 0, 0]; let n = 0;
    for (let sy = Math.floor(y * k); sy < Math.floor((y + 1) * k); sy++) for (let sx = Math.floor(x * k); sx < Math.floor((x + 1) * k); sx++) {
      const i = (sy * cv.w + sx) * 4; for (let c = 0; c < 4; c++) acc[c] += cv.px[i + c]; n++;
    }
    for (let c = 0; c < 4; c++) out.px[(y * size + x) * 4 + c] = acc[c] / n;
  }
  return out;
}

// ---------- PNG writer ----------

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(cv) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0); ihdr.writeUInt32BE(cv.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((cv.w * 4 + 1) * cv.h);
  for (let y = 0; y < cv.h; y++) Buffer.from(cv.px.buffer, y * cv.w * 4, cv.w * 4).copy(raw, y * (cv.w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- The scene ----------

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const SKY = ['#16281a', '#1c3321', '#233f27'];
const LEAF = ['#132313', '#1f3d24', '#2b5e30', '#3f8239', '#5fa043'];
const GRASS = ['#3e7230', '#4a8336', '#55913e', '#62a046'];

function tree(cv, cx, baseY, r, rand) {
  // Trunk, then a round canopy shaded from the top-left, then an outline.
  for (let y = baseY - r; y <= baseY; y++) for (let x = cx - 1; x <= cx + 1; x++) set(cv, x, y, hex(x === cx - 1 ? '#3a2416' : '#5c3a22'));
  const cy = baseY - r - Math.round(r * 0.6);
  const filled = new Set();
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const d = Math.hypot(x - cx, (y - cy) * 1.1);
    if (d > r + (rand() - 0.5) * 1.2) continue;
    const light = (-(x - cx) * 0.6 - (y - cy)) / r + (rand() - 0.5) * 0.6;
    set(cv, x, y, hex(LEAF[Math.max(1, Math.min(4, Math.round(2 + light * 1.4)))]));
    filled.add(`${x},${y}`);
  }
  for (const k of filled) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!filled.has(`${x + dx},${y + dy}`)) set(cv, x + dx, y + dy, hex(LEAF[0]));
  }
}

function fighter(cls, weapon, tint) {
  const parts = layout(sheet, cls, weapon ? [weapon] : [], tint);
  const W = 48, out = new Uint8ClampedArray(W * W * 4);
  for (const p of parts) {
    const src = decode(p.sprite);
    for (let y = 0; y < p.sprite.h; y++) for (let x = 0; x < p.sprite.w; x++) {
      const tx = p.x + x, ty = p.y + y, i = (y * p.sprite.w + x) * 4;
      if (tx < 0 || ty < 0 || tx >= W || ty >= W || !src[i + 3]) continue;
      out.set(src.subarray(i, i + 4), (ty * W + tx) * 4);
    }
  }
  return out;
}

// Draws the icon at `size` logical pixels; the 64-pixel artwork is centred,
// so a larger size just adds more background around it (for maskable icons).
function scene(size) {
  const cv = canvas(size, size), rand = rng(20261105), o = (size - 64) / 2;
  // Night-forest backdrop, darker at the top.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(cv, x, y, hex(SKY[Math.min(2, Math.floor((y / size) * 3))]));
  // Back row of trees, then the clearing floor.
  for (let x = -6; x < size + 8; x += 9 + Math.floor(rand() * 4)) tree(cv, x, o + 25 + Math.floor(rand() * 4), 6 + Math.floor(rand() * 3), rand);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot((x - size / 2) / (size * 0.66), (y - (o + 56)) / (size * 0.42));
    if (d < 1) set(cv, x, y, hex(GRASS[d < 0.45 ? 3 : d < 0.7 ? 2 : d < 0.88 ? 1 : 0]));
  }
  for (let i = 0; i < size * 1.2; i++) {          // grass tufts
    const x = Math.floor(rand() * size), y = Math.floor(o + 40 + rand() * (size - o - 40));
    set(cv, x, y, hex('#2f5d27')); set(cv, x + 1, y - 1, hex('#7bb54a'));
  }
  for (let i = 0; i < 7; i++) {                    // fireflies
    const x = o + 4 + rand() * 56, y = o + 3 + rand() * 18;
    set(cv, x, y, hex('#fff3a0')); set(cv, x + 1, y, hex('#f2c94c'), 140); set(cv, x, y + 1, hex('#f2c94c'), 140);
  }
  // The three heroes, feet on the grass, each with a weapon. The beetle
  // stands further back (higher up) between the other two, and the mouse
  // turns to face in.
  const heroes = [
    { cls: 'knight', weapon: { type: 'sword', material: 'steel', accent: 'garnet' }, x: 33, y: 46 },
    { cls: 'archer', weapon: { type: 'longbow', material: 'oak', accent: 'iron' }, x: 15, y: 60 },
    { cls: 'mage', weapon: { type: 'staff', material: 'amethyst', accent: 'oak' }, x: 50, y: 60, flip: true },
  ];
  for (const h of heroes) {
    for (let dx = -8; dx <= 8; dx++) for (let dy = -1; dy <= 1; dy++) {      // shadow
      if ((dx / 8) ** 2 + dy * dy <= 1) set(cv, o + h.x + dx, o + h.y + dy, [16, 30, 14], 110);
    }
    // Composite canvas is 48x48 with the body's feet at (8 + 16, 8 + 32).
    blit(cv, fighter(h.cls, h.weapon, null), 48, 48, o + h.x - 24, o + h.y - 39, h.flip);
  }
  return cv;
}

const out = (name, cv) => writeFileSync(join(root, 'assets/icons', name), png(cv));
const any = scene(64), maskable = scene(80); // maskable: art inside the central 80%
out('icon-512.png', scaleUp(any, 8));
out('icon-192.png', scaleUp(any, 3));
out('maskable-512.png', resize(scaleUp(maskable, 32), 512));
out('maskable-192.png', resize(scaleUp(maskable, 12), 192));
out('apple-touch-icon.png', resize(scaleUp(any, 45), 180));
out('favicon-32.png', resize(scaleUp(any, 1), 32));
console.log('wrote app icons');
