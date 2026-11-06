// The camp scene: a grassy clearing ringed by trees, where fighters who are at
// camp wander about. Everything is drawn at a low "logical" resolution and
// scaled up by a whole number so the pixel art stays crisp.

import { mulberry32 } from './game.js';
import { PAD, propArt } from './sprites.js';
import { lightAt, hourNow, clockText } from './daylight.js';

const SCENE_H = 160;         // logical pixels tall
const TARGET_W = 190;        // roughly how many logical pixels wide
const WALK_SPEED = 11;       // logical px per second
const FIRE_CLEARANCE = 18;   // fighters keep this far from the campfire

const GRASS = ['#4f8a3a', '#55913e', '#4a8336', '#5a9642'];
const TUFT_LIGHT = '#6dab4c';
const TUFT_DARK = '#3b6d2d';
const FLOWERS = ['#f4f0d4', '#f2c94c', '#e58fb8', '#9fc3f0'];

const LEAF = { outline: '#132313', shades: ['#1f3d24', '#2b5e30', '#3f8239', '#5fa043', '#86be52'] };
const PINE = { outline: '#102019', shades: ['#173a2e', '#21523b', '#2f6d4a', '#43875a', '#5f9e68'] };
const BARK = { outline: '#1f140c', shades: ['#3a2416', '#5c3a22', '#7a5030'] };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------- Procedural pixel trees ----------

function makeTree(rng, kind) {
  const W = 32, H = 46;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const grid = Array.from({ length: H }, () => new Array(W).fill(null));
  const pal = kind === 'pine' ? PINE : LEAF;

  // Trunk
  const tw = kind === 'pine' ? 3 : 4;
  const tx = Math.floor(W / 2 - tw / 2);
  for (let y = 24; y < H - 1; y++) {
    for (let x = tx; x < tx + tw; x++) grid[y][x] = { t: 'bark', s: x === tx ? 0 : x === tx + tw - 1 ? 1 : 2 };
  }
  // Roots
  grid[H - 2][tx - 1] = { t: 'bark', s: 0 };
  grid[H - 2][tx + tw] = { t: 'bark', s: 1 };

  // Canopy mask
  const inCanopy = [];
  if (kind === 'pine') {
    const tiers = 3 + Math.floor(rng() * 2);
    for (let i = 0; i < tiers; i++) {
      const top = 2 + i * 7, bottom = top + 13, half = 5 + i * 2.6;
      inCanopy.push((x, y) => y >= top && y <= bottom && Math.abs(x - W / 2 + 0.5) <= ((y - top) / (bottom - top)) * half + 0.5);
    }
  } else {
    const blobs = [{ x: 16, y: 15, r: 11 + rng() * 2 }];
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      blobs.push({ x: 16 + (rng() - 0.5) * 14, y: 14 + (rng() - 0.3) * 10, r: 6 + rng() * 3.5 });
    }
    for (const b of blobs) inCanopy.push((x, y) => (x - b.x) ** 2 + (y - b.y) ** 2 <= b.r * b.r);
  }
  const cx = W / 2, cy = kind === 'pine' ? 18 : 14;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!inCanopy.some((f) => f(x, y))) continue;
      // Light from the top-left, plus some leafy noise.
      const light = (-(x - cx) * 0.6 - (y - cy)) / 14 + (rng() - 0.5) * 0.7;
      const s = Math.max(0, Math.min(4, Math.round(2 + light * 1.6)));
      grid[y][x] = { t: 'leaf', s };
    }
  }

  // Paint, then add an outline around the whole silhouette.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = grid[y][x];
      if (p) {
        ctx.fillStyle = p.t === 'bark' ? BARK.shades[p.s] : pal.shades[p.s];
        ctx.fillRect(x, y, 1, 1);
      } else {
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => grid[y + dy]?.[x + dx]).filter(Boolean);
        if (near.length) {
          ctx.fillStyle = near.some((n) => n.t === 'leaf') ? pal.outline : BARK.outline;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  return { canvas: c, w: W, h: H };
}

// ---------- Scene ----------

export class CampScene {
  constructor({ onTap } = {}) {
    this.onTap = onTap;
    this.el = document.createElement('div');
    this.el.className = 'scene';
    this.canvas = document.createElement('canvas');
    this.el.appendChild(this.canvas);
    // Time of day, e.g. "Dusk · 6:42 pm".
    this.label = document.createElement('div');
    this.label.className = 'scene-time';
    this.el.appendChild(this.label);
    this.ctx = this.canvas.getContext('2d');
    this.walkers = new Map();
    this.running = false;
    this.last = 0;
    this.W = 0;
    this.scale = 1;
    this.rng = mulberry32(1234);

    this.canvas.addEventListener('click', (ev) => this.handleTap(ev));
    new ResizeObserver(() => this.resize()).observe(this.el);
  }

  resize() {
    const cssW = this.el.clientWidth;
    if (!cssW) return;
    const dpr = window.devicePixelRatio || 1;
    const devW = Math.round(cssW * dpr);
    const s = Math.max(1, Math.round(devW / TARGET_W));
    const W = Math.ceil(devW / s);
    this.canvas.width = devW;
    this.canvas.height = SCENE_H * s;
    this.canvas.style.height = `${(SCENE_H * s) / dpr}px`;
    this.scale = s;
    if (W !== this.W) {
      const first = !this.W;
      this.W = W;
      this.build();
      for (const w of this.walkers.values()) {
        const p = first ? this.randomSpot() : this.clamp(w.x, w.y);
        Object.assign(w, p, { tx: p.x, ty: p.y });
      }
    }
    this.draw(0);
  }

  // The walkable clearing is an ellipse in the middle of the scene.
  clearing() {
    return { cx: this.W / 2, cy: 94, rx: this.W / 2 - 34, ry: 30 };
  }

  clamp(x, y) {
    const { cx, cy, rx, ry } = this.clearing();
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const d = Math.hypot(dx, dy);
    return d <= 1 ? { x, y } : { x: cx + (dx / d) * rx, y: cy + (dy / d) * ry };
  }

  // The campfire sits in the middle of the clearing.
  fireSpot() { const { cx, cy } = this.clearing(); return { x: cx, y: cy + 4 }; }

  // How close (in logical px, with height counted double) a point is to the fire.
  fireDistance(x, y) { const f = this.fireSpot(); return Math.hypot(x - f.x, (y - f.y) * 2); }

  /**
   * A random spot in the clearing, away from the campfire. With `from`, the
   * straight walk there also has to stay clear of the fire.
   */
  randomSpot(from = null) {
    const { cx, cy, rx, ry } = this.clearing();
    let best = null;
    for (let tries = 0; tries < 16; tries++) {
      const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng());
      const p = { x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r };
      best = p;
      if (this.fireDistance(p.x, p.y) < FIRE_CLEARANCE) continue;
      if (from && !this.pathClear(from, p)) continue;
      return p;
    }
    return best;
  }

  pathClear(a, b) {
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      if (this.fireDistance(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) < FIRE_CLEARANCE - 2) return false;
    }
    return true;
  }

  build() {
    const W = this.W, H = SCENE_H;
    const rng = mulberry32(98765);

    // Grass
    const bg = makeCanvas(W, H);
    const g = bg.getContext('2d');
    g.fillStyle = GRASS[0];
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H * 0.25; i++) {
      g.fillStyle = GRASS[1 + Math.floor(rng() * 3)];
      g.fillRect(Math.floor(rng() * W), Math.floor(rng() * H), 1, 1);
    }
    // Darker grass in the shade near the forest edge
    const { cx, cy, rx, ry } = this.clearing();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - cx) / (rx + 18), (y - cy) / (ry + 40));
        if (d > 1 && rng() < Math.min(0.85, (d - 1) * 2.2)) {
          g.fillStyle = rng() < 0.5 ? '#3e7230' : '#3a6a2d';
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    // Tufts and flowers
    for (let i = 0; i < W * 0.5; i++) {
      const x = Math.floor(rng() * W), y = Math.floor(rng() * H);
      g.fillStyle = TUFT_DARK;
      g.fillRect(x, y, 1, 1); g.fillRect(x + 2, y, 1, 1);
      g.fillStyle = TUFT_LIGHT;
      g.fillRect(x + 1, y - 1, 1, 2);
    }
    for (let i = 0; i < W * 0.12; i++) {
      const p = this.randomSpot();
      const x = Math.round(p.x + (rng() - 0.5) * 20), y = Math.round(p.y + (rng() - 0.5) * 16);
      g.fillStyle = FLOWERS[Math.floor(rng() * FLOWERS.length)];
      g.fillRect(x, y, 1, 1);
      g.fillStyle = TUFT_DARK;
      g.fillRect(x, y + 1, 1, 1);
    }
    // A few pebbles
    for (let i = 0; i < 5; i++) {
      const p = this.randomSpot();
      g.fillStyle = '#8d8a80'; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
      g.fillStyle = '#b9b5a8'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    this.bg = bg;

    // Trees around the borders. Each is placed by the base of its trunk so
    // trees and creatures can be depth-sorted together.
    const variants = [];
    for (let i = 0; i < 6; i++) variants.push(makeTree(rng, 'round'));
    for (let i = 0; i < 4; i++) variants.push(makeTree(rng, 'pine'));
    const trees = [];
    const add = (x, y) => trees.push({ x: Math.round(x), y: Math.round(y), t: variants[Math.floor(rng() * variants.length)] });
    for (let row = 0; row < 3; row++) {                       // top: three staggered rows
      for (let x = -12 + row * 7; x < W + 16; x += 15 + rng() * 6) add(x, 22 + row * 12 + rng() * 5);
    }
    for (let y = 58; y < H; y += 13 + rng() * 5) {              // left and right edges
      add(4 + rng() * 10, y); add(-10 + rng() * 6, y + 6);
      add(W - 4 - rng() * 10, y); add(W + 10 - rng() * 6, y + 6);
    }
    for (let x = -10; x < W + 16; x += 15 + rng() * 6) add(x, H + 16 + rng() * 8); // bottom edge
    this.trees = trees;
  }

  setCreatures(list) {
    const ids = new Set(list.map((c) => c.id));
    for (const id of this.walkers.keys()) if (!ids.has(id)) this.walkers.delete(id);
    for (const c of list) {
      if (this.walkers.has(c.id)) { this.walkers.get(c.id).art = c.art; continue; }
      const p = this.randomSpot();
      this.walkers.set(c.id, {
        id: c.id, cls: c.cls, art: c.art, x: p.x, y: p.y, tx: p.x, ty: p.y,
        wait: this.rng() * 2, facing: this.rng() < 0.5 ? 1 : -1,
        phase: this.rng() * Math.PI * 2, moving: false,
      });
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw(now / 1000);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  stop() { this.running = false; }

  update(dt) {
    for (const w of this.walkers.values()) {
      if (w.wait > 0) {
        w.wait -= dt;
        w.moving = false;
        w.phase += dt * 3;
        if (w.wait <= 0) {
          const p = this.randomSpot(w);
          w.tx = p.x; w.ty = p.y;
        }
        continue;
      }
      const dx = w.tx - w.x, dy = w.ty - w.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.5) {
        w.wait = 1.5 + this.rng() * 4;
        continue;
      }
      w.moving = true;
      const step = Math.min(d, WALK_SPEED * dt);
      w.x += (dx / d) * step;
      w.y += (dy / d) * step;
      if (Math.abs(dx) > 0.5) w.facing = dx > 0 ? 1 : -1;
      w.phase += dt * 11;
    }
  }

  draw(t = 0) {
    const { ctx, scale: s } = this;
    if (!this.bg) return;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0, this.W * s, SCENE_H * s);

    const fire = propArt('campfire');
    const fireAt = this.fireSpot();
    const fireFrame = fire ? Math.floor(t * fire.fps) % fire.frames.length : 0;
    if (fire) this.drawGlow(fireAt, t, fireFrame);
    const hour = hourNow();
    const light = lightAt(hour);

    const things = [
      ...this.trees.map((tr) => ({ y: tr.y, tree: tr })),
      ...[...this.walkers.values()].map((w) => ({ y: w.y, walker: w })),
      ...(fire ? [{ y: fireAt.y, fire: true }] : []),
    ].sort((a, b) => a.y - b.y);

    let fireRect = null;
    for (const th of things) {
      if (th.fire) {
        // Drawn at its own pixel density: sceneScale 0.5 means each campfire
        // pixel is half a camp pixel, so it sits at a sensible size beside
        // the fighters. Rounded to whole device pixels to stay crisp.
        const px = Math.max(1, Math.round(s * fire.sceneScale));
        const fw = fire.w * px, fh = fire.h * px;
        fireRect = [fire.frames[fireFrame], Math.round(fireAt.x * s - fw / 2), Math.round(fireAt.y * s - fh), fw, fh];
        ctx.drawImage(...fireRect);
        continue;
      }
      if (th.tree) {
        const t = th.tree;
        ctx.drawImage(t.t.canvas, (t.x - t.t.w / 2) * s, (t.y - t.t.h) * s, t.t.w * s, t.t.h * s);
        continue;
      }
      const w = th.walker;
      const art = w.art;
      if (!art) continue;
      // Squash and stretch, anchored at the feet. Bouncy while walking, a
      // slow gentle breath while standing still.
      const amp = w.moving ? 0.11 : 0.035;
      const k = Math.sin(w.phase);
      const sy = 1 + amp * k;
      const sx = 1 - amp * 0.7 * k;
      const fx = Math.round(w.x * s), fy = Math.round(w.y * s);
      // Shadow
      ctx.fillStyle = 'rgba(20, 40, 18, 0.35)';
      ctx.beginPath();
      ctx.ellipse(fx, fy, 9 * s * sx, 2.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(w.facing * sx * s, sy * s);
      ctx.drawImage(art.canvas, -(PAD + art.w / 2), -(PAD + art.h) + 1);
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawDaylight(light, t, fireAt, fireRect, fireFrame);
    const text = `${light.phase.name} · ${clockText(hour)}`;
    if (text !== this.labelText) { this.labelText = text; this.label.textContent = text; this.label.dataset.phase = light.phase.id; }
  }

  // ---------- Day and night ----------

  /**
   * Lights the scene for the time of day: multiplies a tint over everything,
   * then adds the campfire's light (strongest at night), keeps its flames
   * bright, and lets fireflies out after dark.
   */
  drawDaylight(light, t, fireAt, fireRect, frame) {
    const { ctx, scale: s } = this;
    const [r, g, b] = light.tint;
    if (r < 255 || g < 255 || b < 255) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }
    if (fireRect && light.fire > 0.25) {
      // The fire's own light, in stepped rings that flicker with the flames.
      const k = light.fire, flicker = 1 + 0.07 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 13.1 + frame);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [rad, a] of [[46, 0.05], [34, 0.07], [24, 0.09], [15, 0.11]]) {
        ctx.fillStyle = `rgba(255, 140, 60, ${a * k})`;
        ctx.beginPath();
        ctx.ellipse(Math.round(fireAt.x * s), Math.round((fireAt.y - 4) * s), rad * flicker * s, rad * 0.6 * flicker * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // The flames glow through the darkness, unless a fighter stands in front.
      const [, fx, fy, fw] = fireRect;
      const blocked = [...this.walkers.values()].some((w) => w.y > fireAt.y && Math.abs(w.x * s - (fx + fw / 2)) < (fw / 2 + 10 * s));
      if (!blocked) { ctx.save(); ctx.globalAlpha = Math.min(1, (k - 0.25) * 1.4); ctx.drawImage(...fireRect); ctx.restore(); }
    }
    if (light.fireflies) {
      const { cx, cy, rx, ry } = this.clearing();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < light.fireflies; i++) {
        const x = cx + Math.sin(t * 0.21 + i * 2.1) * (rx + 18) * Math.cos(i * 1.3);
        const y = cy - 20 + Math.sin(t * 0.17 + i * 1.7) * (ry + 24);
        const a = Math.max(0, Math.sin(t * 1.9 + i * 2.3));
        ctx.fillStyle = `rgba(230, 255, 140, ${0.9 * a})`;
        ctx.fillRect(Math.round(x) * s, Math.round(y) * s, s, s);
        ctx.fillStyle = `rgba(200, 255, 120, ${0.25 * a})`;
        ctx.fillRect((Math.round(x) - 1) * s, Math.round(y) * s, s * 3, s);
        ctx.fillRect(Math.round(x) * s, (Math.round(y) - 1) * s, s, s * 3);
      }
      ctx.restore();
    }
  }

  // A warm, flickering pool of light around the campfire, in a few stepped
  // rings so it stays in keeping with the pixel art.
  drawGlow(at, t, frame) {
    const { ctx, scale: s } = this;
    const flicker = 1 + 0.06 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 13.1 + frame);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [r, a] of [[30, 0.05], [21, 0.06], [13, 0.07]]) {
      ctx.fillStyle = `rgba(255, 150, 60, ${a})`;
      ctx.beginPath();
      ctx.ellipse(Math.round(at.x * s), Math.round((at.y - 2) * s), r * flicker * s, r * 0.55 * flicker * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  handleTap(ev) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * this.W;
    const y = ((ev.clientY - rect.top) / rect.height) * SCENE_H;
    const hit = [...this.walkers.values()]
      .sort((a, b) => b.y - a.y)
      .find((w) => Math.abs(x - w.x) < 12 && y < w.y + 2 && y > w.y - 28);
    if (hit && this.onTap) this.onTap(hit.id);
  }
}
