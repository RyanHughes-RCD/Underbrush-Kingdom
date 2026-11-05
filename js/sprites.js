// Character art: bodies plus attachable pieces (weapons, armour), joined at
// named anchor points. Data lives in assets/sprites/sprites.json, which is
// edited with the Sprite Workshop.
//
// A body defines anchors, e.g. {hand: {x, y}}. A piece names the anchor it
// attaches to and its own pivot; it's drawn so its pivot lands on the anchor.
// Pieces with `wornBy` including a class are always drawn on that class
// (armour, hats). An equipped weapon replaces any worn piece in the same slot.
// Weapon art is chosen per material, see weaponPieceId().

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

/**
 * The art piece for a weapon. A piece named after the exact material
 * (`sword-steel`) wins; otherwise tiers share art in three groups:
 * `sword-1` for tiers 1-3, `sword-2` for 4-6, `sword-3` for 7-10.
 */
export function weaponArtGroup(tier) { return tier <= 3 ? 1 : tier <= 6 ? 2 : 3; }
export function weaponPieceId(type, materialId, data = sheet) {
  const exact = `${type}-${materialId}`;
  if (data?.pieces?.[exact]) return exact;
  return `${type}-${weaponArtGroup(MATERIALS[materialId]?.tier || 1)}`;
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

/**
 * Which pieces a class wears, and where. Returns draw-ordered layers with
 * positions relative to the composite's top-left (body at PAD, PAD).
 */
export function layout(data, cls, equippedIds = []) {
  const body = data.bodies[cls];
  if (!body) return [];
  const equipped = equippedIds.map((id) => [id, data.pieces[id]]).filter(([, p]) => p);
  const equippedSlots = new Set(equipped.map(([, p]) => p.slot));
  const worn = Object.entries(data.pieces)
    .filter(([id, p]) => (p.wornBy || []).includes(cls) && !equippedSlots.has(p.slot) && !equippedIds.includes(id));
  const parts = [...worn, ...equipped].map(([id, p]) => {
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
 * A class's body with its worn pieces and optional equipped pieces.
 * Returns {canvas, url, w, h} where w/h are the body's size; the canvas is
 * (w + 2*PAD) x (h + 2*PAD) with the body's feet at (PAD + w/2, PAD + h).
 */
export function creatureArt(cls, equippedIds = []) {
  const key = `c:${cls}:${equippedIds.join(',')}`;
  if (cache.has(key)) return cache.get(key);
  const body = sheet.bodies[cls];
  const c = document.createElement('canvas');
  c.width = body.w + PAD * 2; c.height = body.h + PAD * 2;
  const ctx = c.getContext('2d');
  for (const part of layout(sheet, cls, equippedIds)) ctx.drawImage(spriteCanvas(part.sprite), part.x, part.y);
  const art = { canvas: c, url: c.toDataURL(), w: body.w, h: body.h };
  cache.set(key, art);
  return art;
}

/** A single piece on its own, for inventory icons. */
export function pieceArt(id) {
  const key = `p:${id}`;
  if (cache.has(key)) return cache.get(key);
  const p = sheet.pieces[id];
  if (!p) return null;
  const c = spriteCanvas(p);
  const art = { canvas: c, url: c.toDataURL(), w: p.w, h: p.h };
  cache.set(key, art);
  return art;
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
