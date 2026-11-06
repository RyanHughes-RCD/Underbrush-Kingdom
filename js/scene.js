// The camp scene: a castle courtyard (see js/courtyard.js) where fighters who
// are at camp wander about around the campfire. Everything is drawn at a low "logical" resolution and
// scaled up by a whole number so the pixel art stays crisp.

import { mulberry32 } from './game.js';
import { PAD, propArt } from './sprites.js';
import { lightAt, hourNow, clockText } from './daylight.js';
import { buildCourtyard, drawTorchFlame } from './courtyard.js';

const MIN_H = 160;           // logical pixels tall, at least
const TARGET_W = 190;        // roughly how many logical pixels wide
const WALK_SPEED = 11;       // logical px per second
const FIRE_CLEARANCE = 18;   // fighters keep this far from the campfire

// ---------- Scene ----------

export class CampScene {
  /**
   * onTap(creatureId) when a fighter is tapped, onBuilding(workshopId) when a
   * workshop is, and busy(workshopId) says whether a workshop is smelting.
   */
  constructor({ onTap, onBuilding, busy } = {}) {
    this.onTap = onTap;
    this.onBuilding = onBuilding;
    this.busy = busy || (() => false);
    this.buildings = [];
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

  // Fills the element: the width sets a whole-number scale (about TARGET_W
  // logical pixels across) and the height follows, so the courtyard covers
  // the whole screen on a phone.
  resize() {
    const cssW = this.el.clientWidth, cssH = this.el.clientHeight;
    if (!cssW) return;
    const dpr = window.devicePixelRatio || 1;
    const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
    const s = Math.max(1, Math.round(devW / TARGET_W));
    const W = Math.ceil(devW / s), H = Math.max(MIN_H, Math.ceil(devH / s));
    this.canvas.width = devW;
    this.canvas.height = H * s;
    this.canvas.style.height = `${(H * s) / dpr}px`;
    this.scale = s;
    if (W !== this.W || H !== this.H) {
      const first = !this.W;
      this.W = W; this.H = H;
      this.build();
      for (const w of this.walkers.values()) {
        const p = first ? this.randomSpot() : this.clamp(w.x, w.y);
        Object.assign(w, p, { tx: p.x, ty: p.y });
      }
    }
    this.draw(0);
  }

  // The open courtyard floor fighters wander (an ellipse).
  clearing() {
    return this.walk || { cx: Math.round(this.W / 2), cy: Math.round((this.H || MIN_H) * 0.62), rx: Math.round(this.W / 2) - 44, ry: 30 };
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

  // Whether a fighter's feet at x, y would be in the fire or in (or just
  // behind) a workshop. `slack` eases the margins for paths.
  blocked(x, y, slack = 0) {
    if (this.fireDistance(x, y) < FIRE_CLEARANCE - slack) return true;
    return this.buildings.some((b) => Math.abs(x - b.x) < b.t.w / 2 + 6 - slack && y > b.y - b.t.h + 4 + slack && y < b.y + 5 - slack);
  }

  /**
   * A random spot in the clearing, away from the campfire and the workshops.
   * With `from`, the straight walk there also has to stay clear of them.
   */
  randomSpot(from = null) {
    const { cx, cy, rx, ry } = this.clearing();
    let best = null;
    for (let tries = 0; tries < 16; tries++) {
      const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng());
      const p = { x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r };
      best = p;
      if (this.blocked(p.x, p.y)) continue;
      if (from && !this.pathClear(from, p)) continue;
      return p;
    }
    return best;
  }

  pathClear(a, b) {
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      if (this.blocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 2)) return false;
    }
    return true;
  }

  build() {
    const c = buildCourtyard(this.W, this.H, mulberry32(98765));
    this.bg = c.bg;
    this.front = c.front;
    this.trees = c.objects;     // planters and workshops, depth-sorted with fighters
    this.buildings = c.buildings;
    this.torches = c.torches;
    this.walk = c.walk;
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
    ctx.drawImage(this.bg, 0, 0, this.W * s, this.H * s);

    const fire = propArt('campfire');
    const fireAt = this.fireSpot();
    const fireFrame = fire ? Math.floor(t * fire.fps) % fire.frames.length : 0;
    if (fire) this.drawGlow(fireAt, t, fireFrame);
    const hour = hourNow();
    const light = lightAt(hour);
    (this.torches || []).forEach((tc, i) => drawTorchFlame(ctx, s, t, tc.x, tc.y, i));

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
    for (const b of this.buildings) if (this.busy(b.id)) this.drawWork(b, t);
    if (this.front) ctx.drawImage(this.front, 0, 0, this.W * s, this.H * s);
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
    if (light.fire > 0.25) {
      // Wall torches: a small warm pool each, and flames that stay bright.
      const k = light.fire;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      (this.torches || []).forEach((tc, i) => {
        const fl = 1 + 0.08 * Math.sin(t * 9 + i * 2);
        for (const [rad, a] of [[22, 0.04], [14, 0.06], [7, 0.09]]) {
          ctx.fillStyle = `rgba(255, 150, 70, ${a * k})`;
          ctx.beginPath(); ctx.ellipse(tc.x * s, (tc.y - 2) * s, rad * fl * s, rad * 0.8 * fl * s, 0, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.restore();
      ctx.save(); ctx.globalAlpha = Math.min(1, (k - 0.25) * 1.4);
      (this.torches || []).forEach((tc, i) => drawTorchFlame(ctx, s, t, tc.x, tc.y, i));
      ctx.restore();
    }
    if (light.fire > 0.25) {
      // Workshop windows, the furnace and the hut's crystal, glowing after
      // dark (brighter while the workshop is busy).
      const k = light.fire;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.buildings.forEach((bd, i) => {
        const on = this.busy(bd.id) ? 1.4 : 1;
        for (const l of bd.lights) {
          const [r, g, b] = l.rgb, fl = 1 + 0.05 * Math.sin(t * 5 + i * 3 + l.x);
          for (const [f, a] of [[1, 0.05], [0.6, 0.08]]) {
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a * k * on})`;
            ctx.beginPath(); ctx.ellipse(l.x * s, l.y * s, l.r * f * fl * s, l.r * f * 0.75 * fl * s, 0, 0, Math.PI * 2); ctx.fill();
          }
          const [gw, gh] = l.glass;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.45 * k * on})`;
          ctx.fillRect(Math.round(l.x - gw / 2) * s, Math.round(l.y - gh / 2) * s, gw * s, gh * s);
        }
      });
      ctx.restore();
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

  // A busy workshop: smoke curling from the chimney, or for the hut,
  // sparkles drifting up from its crystal.
  drawWork(b, t) {
    const { ctx, scale: s } = this;
    const { x, y } = b.emit;
    ctx.save();
    if (b.effect === 'sparkle') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const age = (t * 0.45 + i / 7) % 1;
        const sx = Math.round(x + Math.sin(i * 2.3 + age * 5) * (3 + age * 5)), sy = Math.round(y - 1 - age * 18);
        const a = (1 - age) * Math.max(0, Math.sin(t * 6 + i * 1.9) * 0.5 + 0.6);
        ctx.fillStyle = i % 2 ? `rgba(214, 168, 255, ${a})` : `rgba(140, 235, 255, ${a})`;
        ctx.fillRect(sx * s, sy * s, s, s);
        if (a > 0.6) { ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.35})`; ctx.fillRect((sx - 1) * s, sy * s, 3 * s, s); ctx.fillRect(sx * s, (sy - 1) * s, s, 3 * s); }
      }
    } else {
      const dark = b.id === 'forge';
      for (let i = 0; i < 6; i++) {
        const age = (t * 0.35 + i / 6) % 1;
        const r = 1 + Math.floor(age * 3);
        const sx = Math.round(x + Math.sin(age * 4 + i) * 1.5 + age * 7 - r / 2), sy = Math.round(y - 2 - age * 24);
        ctx.fillStyle = dark ? `rgba(92, 88, 84, ${Math.min(1, (1 - age) * 1.1)})` : `rgba(196, 190, 182, ${Math.min(1, (1 - age) * 1.1)})`;
        ctx.fillRect(sx * s, sy * s, (r + 1) * s, r * s);
      }
    }
    ctx.restore();
  }

  handleTap(ev) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * this.W;
    const y = ((ev.clientY - rect.top) / rect.height) * this.H;
    const hit = [...this.walkers.values()]
      .sort((a, b) => b.y - a.y)
      .find((w) => Math.abs(x - w.x) < 12 && y < w.y + 2 && y > w.y - 28);
    if (hit) { if (this.onTap) this.onTap(hit.id); return; }
    const shop = this.buildings.find((b) => Math.abs(x - b.x) < b.t.w / 2 && y > b.y - b.t.h && y < b.y + 2);
    if (shop && this.onBuilding) this.onBuilding(shop.id);
  }
}
