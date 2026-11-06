// Character art: bodies plus attachable pieces, joined at named anchor
// points. Data lives in assets/sprites/sprites.json, edited with the Sprite
// Workshop. The sheet has three sections:
//
//   bodies.<class>   one per class, with named anchors, e.g. {hand: {x, y}},
//                    and `tints`: palette indices that vary per creature
//                    (each creature shifts their hue; see tintPalette())
//   weapons.<type>   one design per weapon type (longbow, mace, tome, ...)
//   pieces.<id>      other gear: armour, hats, anything worn
//   props.<id>       animated scenery, e.g. the campfire: {name, w, h,
//                    palette, frames: [pixels, ...], fps, sceneScale,
//                    overlay}. All frames share the palette and size;
//                    `overlay` (optional, same size) is a still layer drawn
//                    on top of every frame, like the needle in the campfire;
//                    sceneScale is how big it's drawn in the camp.
//
// A body defines anchors. A piece or weapon names the anchor it attaches to
// and its own pivot; it is drawn so its pivot lands on the anchor. Pieces with
// `wornBy` including a class are always drawn on that class. An equipped
// weapon replaces any worn piece in the same slot.
//
// WEAPON DESIGNS hold the shared shape (w, h, pixels, palette, pivot).
// A weapon is made of a main material and a fittings material (accent), and
// each palette colour is fixed, follows the main material, or follows the
// fittings:
//   swaps        palette indices that change with the main material
//   accentSwaps  palette indices that change with the fittings material
// Main materials can have a variant:
//   variants.<material> = {colors: {"<index>": "#hex"}}     a recolour
//   variants.<material> = {w, h, pixels, palette, pivot,    its own design
//                          accentSwaps, accents}
// Fittings colours are saved per fittings material on whatever holds the
// pixels (the shared design, or a main material's own design):
//   accents.<material> = {colors: {"<index>": "#hex"}}
// Anything not saved is recoloured automatically from that material's
// palette in js/data.js.

import { MATERIALS } from './data.js';

export const PAD = 8; // spare pixels around a body so pieces can stick out
const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

let sheet = null;

export function setSheet(data) { sheet = data; cache.clear(); }
export function getSheet() { return sheet; }

export async function loadSprites(url = 'assets/sprites/sprites.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  setSheet(await res.json());
  return sheet;
}

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

/**
 * Automatic colours for swap indices: spreads the material's
 * [dark, mid, light] tones over those colours, darkest to lightest.
 * One swap colour takes the mid tone.
 */
export function autoColors(palette, swaps, materialId) {
  const tones = MATERIALS[materialId]?.palette;
  if (!tones || !swaps?.length) return {};
  const order = [...swaps].sort((a, b) => lum(palette[a]) - lum(palette[b]));
  const out = {};
  order.forEach((idx, i) => {
    const t = order.length === 1 ? 1 : Math.round((i / (order.length - 1)) * 2);
    out[idx] = tones[t];
  });
  return out;
}

const applyColors = (palette, colors) => palette.map((c, i) => colors[i] || c);

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * A creature's own colouring: rotates the hue of the body's `tints` colours
 * by `tint.h` degrees and scales their saturation (`tint.s`) and lightness
 * (`tint.l`). Other colours (outlines, eyes, armour) are left alone.
 */
export function tintPalette(palette, indices, tint) {
  if (!tint || !indices?.length) return palette;
  return palette.map((hex, i) => {
    if (!indices.includes(i)) return hex;
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h + (tint.h || 0), s * (tint.s ?? 1), l * (tint.l ?? 1));
  });
}

/** A body sprite recoloured for one creature. */
export function tintedBody(data, cls, tint) {
  const body = data.bodies[cls];
  return tint ? { ...body, palette: tintPalette(body.palette, body.tints, tint) } : body;
}

/**
 * The sprite for one weapon type in a main material and (optionally) a
 * fittings material: the main material's own design if it has one,
 * otherwise the shared design recoloured; then fittings colours on top.
 */
export function weaponSprite(data, type, materialId, accentId) {
  const d = data?.weapons?.[type];
  if (!d) return null;
  const v = d.variants?.[materialId];
  const holder = v?.pixels ? v : d;
  let palette = holder === v ? [...v.palette] : applyColors(d.palette, { ...autoColors(d.palette, d.swaps, materialId), ...(v?.colors || {}) });
  if (accentId) palette = applyColors(palette, { ...autoColors(holder.palette, holder.accentSwaps, accentId), ...(holder.accents?.[accentId]?.colors || {}) });
  return { slot: 'weapon', anchor: d.anchor, layer: d.layer, name: d.name, w: holder.w, h: holder.h, pixels: holder.pixels, pivot: holder.pivot || d.pivot, palette };
}

/** How a main material's variant is defined: 'design', 'recolour' or 'auto'. */
export function variantKind(data, type, materialId) {
  const v = data?.weapons?.[type]?.variants?.[materialId];
  return v?.pixels ? 'design' : v?.colors && Object.keys(v.colors).length ? 'recolour' : 'auto';
}

/** Whether a fittings material has saved colours ('recolour') or not ('auto'). */
export function accentKind(data, type, materialId, accentId) {
  const d = data?.weapons?.[type]; if (!d) return 'auto';
  const v = d.variants?.[materialId];
  const holder = v?.pixels ? v : d;
  return holder.accents?.[accentId]?.colors && Object.keys(holder.accents[accentId].colors).length ? 'recolour' : 'auto';
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Decodes a sprite into RGBA bytes (length w*h*4). */
export function decode(sprite) {
  const { w, h, palette, pixels } = sprite;
  const out = new Uint8ClampedArray(w * h * 4);
  const rgb = palette.map(hexToRgb);
  for (let i = 0; i < w * h; i++) {
    const ch = pixels[i];
    if (!ch || ch === '.') continue;
    const c = rgb[CHARS.indexOf(ch)];
    if (!c) continue;
    out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
  }
  return out;
}

/** Resolves an equipped item: a piece id, or a weapon {type, material, accent}. */
function resolve(data, e) {
  if (typeof e === 'string') return data.pieces?.[e] ? [e, data.pieces[e]] : null;
  const sp = weaponSprite(data, e.type, e.material, e.accent);
  return sp ? [`${e.type}:${e.material}${e.accent ? '+' + e.accent : ''}`, sp] : null;
}

/**
 * Which pieces a class wears, and where. `equipped` lists piece ids and/or
 * weapons as {type, material, accent}; `tint` is the creature's colouring.
 * Returns draw-ordered layers with positions
 * relative to the composite's top-left (body at PAD, PAD).
 */
export function layout(data, cls, equipped = [], tint = null) {
  const body = tintedBody(data, cls, tint);
  if (!body) return [];
  const eq = equipped.map((e) => resolve(data, e)).filter(Boolean);
  const eqSlots = new Set(eq.map(([, p]) => p.slot));
  const eqIds = new Set(eq.map(([id]) => id));
  const worn = Object.entries(data.pieces || {})
    .filter(([id, p]) => (p.wornBy || []).includes(cls) && !eqSlots.has(p.slot) && !eqIds.has(id));
  const parts = [...worn, ...eq].map(([id, p]) => {
    const a = body.anchors?.[p.anchor] || { x: Math.floor(body.w / 2), y: Math.floor(body.h / 2) };
    return { id, sprite: p, layer: p.layer === 'back' ? 'back' : 'front', x: PAD + a.x - p.pivot.x, y: PAD + a.y - p.pivot.y };
  });
  return [
    ...parts.filter((p) => p.layer === 'back'),
    { id: cls, sprite: body, layer: 'body', x: PAD, y: PAD },
    ...parts.filter((p) => p.layer === 'front'),
  ];
}

// ---------- Canvas rendering (browser only) ----------

const cache = new Map();

function spriteCanvas(sprite) {
  const c = document.createElement('canvas');
  c.width = sprite.w; c.height = sprite.h;
  c.getContext('2d').putImageData(new ImageData(decode(sprite), sprite.w, sprite.h), 0, 0);
  return c;
}

/**
 * A class's body with its worn pieces and anything equipped.
 * Returns {canvas, url, w, h} where w/h are the body's size; the canvas is
 * (w + 2*PAD) x (h + 2*PAD) with the body's feet at (PAD + w/2, PAD + h).
 */
export function creatureArt(cls, equipped = [], tint = null) {
  const key = `c:${cls}:${JSON.stringify(equipped)}:${tint ? `${tint.h},${tint.s},${tint.l}` : ''}`;
  if (cache.has(key)) return cache.get(key);
  const body = sheet.bodies[cls];
  const c = document.createElement('canvas');
  c.width = body.w + PAD * 2; c.height = body.h + PAD * 2;
  const ctx = c.getContext('2d');
  for (const part of layout(sheet, cls, equipped, tint)) ctx.drawImage(spriteCanvas(part.sprite), part.x, part.y);
  const art = { canvas: c, url: c.toDataURL(), w: body.w, h: body.h };
  cache.set(key, art);
  return art;
}

function artFor(key, sprite) {
  if (cache.has(key)) return cache.get(key);
  if (!sprite) return null;
  const c = spriteCanvas(sprite);
  const art = { canvas: c, url: c.toDataURL(), w: sprite.w, h: sprite.h };
  cache.set(key, art);
  return art;
}

/** Draws a still overlay over a frame: any non-transparent overlay pixel wins. */
export function withOverlay(pixels, overlay) {
  if (!overlay) return pixels;
  let out = '';
  for (let i = 0; i < pixels.length; i++) out += overlay[i] && overlay[i] !== '.' ? overlay[i] : pixels[i];
  return out;
}

/** One frame of an animated prop (with its overlay) as a plain sprite, or null. */
export function propFrame(data, id, frame = 0) {
  const p = data?.props?.[id];
  if (!p?.frames?.length) return null;
  const f = ((frame % p.frames.length) + p.frames.length) % p.frames.length;
  return { w: p.w, h: p.h, palette: p.palette, pixels: withOverlay(p.frames[f], p.overlay) };
}

/** All frames of a prop as canvases, for animating. */
export function propArt(id) {
  const key = `prop:${id}`;
  if (cache.has(key)) return cache.get(key);
  const p = sheet?.props?.[id];
  if (!p) return null;
  const art = { frames: p.frames.map((_, i) => spriteCanvas(propFrame(sheet, id, i))), w: p.w, h: p.h, fps: p.fps || 6, sceneScale: p.sceneScale ?? 0.5 };
  cache.set(key, art);
  return art;
}

/** A single gear piece on its own. */
export function pieceArt(id) { return artFor(`p:${id}`, sheet.pieces?.[id]); }

/** One weapon, for inventory icons. */
export function weaponArt(type, materialId, accentId) {
  return artFor(`w:${type}:${materialId}:${accentId || ''}`, weaponSprite(sheet, type, materialId, accentId));
}

/**
 * An <img> of creature art where `size` is the on-screen size of the body
 * itself; the padding around it spills outside via negative margins.
 */
export function creatureImg(art, size, cls = '') {
  const k = size / art.w;
  const pw = (art.w + PAD * 2) * k, ph = (art.h + PAD * 2) * k, m = PAD * k;
  return `<img class="${cls}" src="${art.url}" alt="" style="width:${pw}px;height:${ph}px;margin:${-m}px">`;
}
