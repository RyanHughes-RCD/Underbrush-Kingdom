// Draws the app icon from the game's own sprite data: the campfire (its
// first frame, without the needle overlay) glowing at night on a ring of
// cobblestones, with sparks rising. Pixel art at a low resolution, scaled
// up by whole numbers.
//
// Run: node tools/make_app_icon.mjs
// Writes assets/icons/: icon-512.png, icon-192.png (any purpose),
// maskable-512.png, maskable-192.png (content kept in the safe zone),
// apple-touch-icon.png (180) and favicon-32.png.

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from '../js/sprites.js';

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

// Which campfire frame the icon shows. The needle lives in the prop's
// overlay, so drawing a frame on its own leaves it out.
const FIRE_FRAME = 0;

// Draws the icon at `size` logical pixels; the 64-pixel artwork is centred,
// so a larger size just adds more background around it (for maskable icons).
function scene(size) {
  const cv = canvas(size, size), o = (size - 64) / 2;
  const fire = sheet.props.campfire;
  const sprite = { w: fire.w, h: fire.h, palette: fire.palette, pixels: fire.frames[FIRE_FRAME] };
  const cx = size / 2, groundY = o + 56, glowY = o + 34;
  // Night sky, a touch lighter low down where the fire lights the air.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - cx, (y - glowY) * 1.1);
    set(cv, x, y, hex(d < 20 ? '#5a2a1e' : d < 27 ? '#3d1f1c' : d < 35 ? '#2a1a20' : d < 44 ? '#1c1622' : '#141220'));
  }
  // A few stars, kept away from the glow.
  for (const [sx, sy] of [[7, 7], [15, 4], [52, 6], [58, 15], [5, 20], [46, 3], [60, 27], [3, 33]]) {
    set(cv, o + sx, o + sy, hex('#e9e4ff')); set(cv, o + sx + 1, o + sy, hex('#8f88b8'), 120);
  }
  // Cobbled ground ring under the fire, lit warm near the middle.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot((x - cx) / 28, (y - groundY) / 9);
    if (d > 1) continue;
    const joint = x % 3 === 0 || y % 2 === 0;
    const lit = d < 0.45 ? 2 : d < 0.75 ? 1 : 0;
    set(cv, x, y, hex(joint ? ['#2a221f', '#3a2a22', '#4d3324'][lit] : ['#4a403a', '#6b5444', '#8f6a4c'][lit]));
  }
  // The fire, feet on the cobbles.
  const ox = Math.round(cx - sprite.w / 2), oy = Math.round(groundY + 3 - sprite.h);
  blit(cv, decode(sprite), sprite.w, sprite.h, ox, oy);
  // Sparks rising out of the flames.
  for (const [sx, sy, c] of [[22, 4, '#f2c94c'], [41, 8, '#e0842e'], [19, 14, '#e0842e'], [45, 2, '#f8d988'], [37, 1, '#f2c94c']]) {
    set(cv, o + sx, o + sy, hex(c));
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
