// The camp's surroundings: an original castle courtyard drawn as pixel art.
// A battlemented back wall with a gated arch, banners and torches, a corner
// tower each side, side walls, a flagstone floor with a cobbled ring for the
// campfire, hedge planters, the three workshops (the Woodworker's Cabin, the
// Forge and the Enchanter's Hut) and a low front wall.
//
// buildCourtyard(W, H, rng) returns:
//   bg       a W x H canvas of everything fighters always stand in front of
//   front    a canvas drawn over everything (the front wall)
//   objects  [{x, y, t: {canvas, w, h}}] depth-sorted with the fighters
//   buildings [{id, x, y, t, emit, effect, lights}] the workshops (also in
//            objects): x, y is the middle of the front step; emit is where
//            smoke or sparkles rise while it works; lights glow after dark
//   torches  [{x, y}] wall torches, animated and lit by the scene
//   walk     {cx, cy, rx, ry} the open floor fighters wander

const C = {
  beyond: ['#1b3320', '#24432a', '#2f5733'],
  mortar: '#4b463f', faceD: '#6a645a', face: '#857f72', faceL: '#9c9688',
  top: '#b4ad9d', topL: '#c9c2b1', shadow: '#36322d',
  floor: ['#9b9383', '#a39b8b', '#928a7a', '#a9a191'], floorMortar: '#6f685b',
  moss: ['#6b8648', '#587438'], cobble: ['#77705f', '#6a6354', '#837a69'], cobbleMortar: '#4f493f',
  floorDark: ['#8a8272', '#958d7d'],
  gate: '#171413', bars: '#43424a', barsL: '#66656e',
  banner: '#a3322e', bannerD: '#6c1f1c', gold: '#e2b33d', goldD: '#a77d22',
  iron: '#2b2a30', ironL: '#4a4952',
  leaf: ['#1f3d24', '#2b5e30', '#3f8239', '#5fa043'], leafOut: '#132313',
};

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function buildCourtyard(W, H, rng) {
  const bg = makeCanvas(W, H), g = bg.getContext('2d');
  const px = (x, y, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const cx = Math.round(W / 2);

  const WALL_TOP = 9, WALL_FACE = 17, WALL_BASE = 50;     // back wall rows
  const TOWER_W = 30, TOWER_BASE = 64;                     // corner towers
  const SIDE = 14;                                         // side wall width
  const FRONT = H - 14;                                    // front wall top

  // Treetops beyond the wall.
  for (let y = 0; y < WALL_FACE; y++) for (let x = 0; x < W; x++) px(x, y, C.beyond[Math.min(2, Math.floor((y / WALL_FACE) * 3 + rng() * 0.6))]);
  for (let x = 0; x < W; x += 5 + Math.floor(rng() * 4)) {
    const r = 3 + Math.floor(rng() * 3);
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) px(x + xx, 4 + yy, rng() < 0.5 ? C.beyond[1] : C.beyond[2]);
  }

  // Brick face helper: rows of 8x4 bricks with offset joints.
  const bricks = (x0, y0, x1, y1, base = C.face) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const row = Math.floor((y - y0) / 4), off = row % 2 ? 4 : 0;
      const joint = (y - y0) % 4 === 3 || (x - x0 + off) % 8 === 7;
      px(x, y, joint ? C.mortar : ((x - x0 + off) % 8 === 0 || (y - y0) % 4 === 0) ? C.faceL : base);
    }
    for (let i = 0; i < (x1 - x0) * (y1 - y0) * 0.02; i++) px(x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0), C.faceD);
  };
  // Battlements along a wall top.
  const merlons = (x0, x1, y, h = 5, step = 10, gap = 4) => {
    for (let x = x0; x < x1; x += step) {
      px(x, y, C.topL, step - gap, 1); px(x, y + 1, C.top, step - gap, h - 1);
      px(x + step - gap - 1, y + 1, C.faceD, 1, h - 1);
    }
  };

  // Back wall.
  px(0, WALL_TOP + 5, C.top, W, WALL_FACE - WALL_TOP - 5);
  px(0, WALL_TOP + 5, C.topL, W, 1);
  merlons(0, W, WALL_TOP);
  bricks(0, WALL_FACE, W, WALL_BASE);
  px(0, WALL_BASE, C.shadow, W, 1);

  // Gate: a stone arch with a dark passage and a portcullis.
  const gw = 30, gx = cx - gw / 2, gTop = WALL_FACE + 6;
  for (let y = gTop; y < WALL_BASE; y++) for (let x = gx; x < gx + gw; x++) {
    const ax = (x - cx + 0.5) / (gw / 2), ay = (y - (gTop + gw / 2)) / (gw / 2);
    const inArch = y >= gTop + gw / 2 || ax * ax + ay * ay <= 1;
    if (!inArch) continue;
    const edge = Math.abs(ax) > 0.84 || (y < gTop + gw / 2 && ax * ax + ay * ay > 0.72);
    px(x, y, edge ? C.topL : C.gate);
  }
  for (let x = gx + 4; x < gx + gw - 3; x += 4) for (let y = gTop + 3; y < WALL_BASE - 2; y++) {
    const ax = (x - cx + 0.5) / (gw / 2), ay = (y - (gTop + gw / 2)) / (gw / 2);
    if (y >= gTop + gw / 2 || ax * ax + ay * ay <= 0.6) px(x, y, (y % 4 === 0) ? C.barsL : C.bars);
  }
  for (let y = gTop + 10; y < WALL_BASE - 2; y += 5) px(gx + 3, y, C.bars, gw - 6, 1);

  // Banners either side of the gate, each with a gold needle.
  for (const bx of [cx - 32, cx + 22]) {
    px(bx - 1, WALL_FACE + 2, C.iron, 12, 1);
    for (let y = WALL_FACE + 3; y < WALL_FACE + 27; y++) for (let x = bx; x < bx + 10; x++) {
      const tail = y > WALL_FACE + 22 && Math.abs(x - (bx + 4.5)) < (y - (WALL_FACE + 22)) * 1.1;
      if (tail) continue;
      px(x, y, x === bx || x === bx + 9 ? C.bannerD : C.banner);
    }
    const nx = bx + 4;
    px(nx, WALL_FACE + 6, C.gold); px(nx + 1, WALL_FACE + 6, C.gold);
    px(nx, WALL_FACE + 7, C.gold); px(nx + 1, WALL_FACE + 7, C.goldD);
    px(nx, WALL_FACE + 8, C.gold, 1, 11); px(nx + 1, WALL_FACE + 8, C.goldD, 1, 10);
    px(nx, WALL_FACE + 19, C.goldD);
    px(nx - 2, WALL_FACE + 12, C.gold, 6, 1);
  }

  // Corner towers.
  for (const tx of [0, W - TOWER_W]) {
    px(tx, 0, C.top, TOWER_W, 10);
    merlons(tx, tx + TOWER_W, 0, 5, 8, 3);
    px(tx, 9, C.topL, TOWER_W, 1);
    bricks(tx, 10, tx + TOWER_W, TOWER_BASE, C.faceL);
    px(tx + (tx ? 0 : TOWER_W - 1), 10, C.shadow, 1, TOWER_BASE - 10);
    px(tx + TOWER_W / 2 - 1, 26, C.gate, 2, 9); px(tx + TOWER_W / 2 - 2, 30, C.gate, 4, 1);
    px(tx, TOWER_BASE, C.shadow, TOWER_W, 2);
  }

  // Flagstone floor.
  const fx0 = SIDE, fx1 = W - SIDE, fy0 = WALL_BASE + 1, fy1 = FRONT;
  for (let y = fy0; y < fy1; y += 7) {
    let x = fx0 - Math.floor(rng() * 10);
    while (x < fx1) {
      const w = 9 + Math.floor(rng() * 7), col = rng() < 0.18 ? pick(C.floorDark) : pick(C.floor);
      for (let yy = y; yy < Math.min(fy1, y + 7); yy++) for (let xx = Math.max(fx0, x); xx < Math.min(fx1, x + w); xx++) {
        if (xx < TOWER_W && yy < TOWER_BASE + 1) continue;
        if (xx >= W - TOWER_W && yy < TOWER_BASE + 1) continue;
        const joint = yy === y + 6 || xx === x + w - 1;
        px(xx, yy, joint ? C.floorMortar : (yy === y ? C.floor[3] : col));
      }
      x += w;
    }
  }
  // Moss in the joints, thicker near the walls; a few cracked stones.
  for (let i = 0; i < W * 3; i++) {
    const x = fx0 + Math.floor(rng() * (fx1 - fx0)), y = fy0 + Math.floor(rng() * (fy1 - fy0));
    const edge = Math.min(x - fx0, fx1 - x, (y - fy0) * 2, (fy1 - y) * 2);
    if (rng() < 0.5 - edge / 60) px(x, y, pick(C.moss));
  }
  // Shade along the foot of the walls.
  for (let x = fx0; x < fx1; x++) if (rng() < 0.6) px(x, fy0, C.shadow);

  // The open floor fighters wander: an ellipse filling the space between the
  // walls and planters. The campfire's cobbled ring sits at its centre.
  const floorMid = (fy0 + fy1) / 2;
  const walk = { cx, cy: Math.round(floorMid + 4), rx: Math.round(W / 2) - 44, ry: Math.max(26, Math.round((fy1 - fy0) / 2) - 20) };
  const fy = walk.cy + 4;
  for (let y = fy - 12; y <= fy + 8; y++) for (let x = cx - 22; x <= cx + 22; x++) {
    const d = Math.hypot((x - cx) / 22, (y - (fy - 2)) / 10);
    if (d > 1) continue;
    const cob = ((Math.floor(x / 3) + Math.floor(y / 2)) % 2) === 0;
    px(x, y, d > 0.9 ? C.cobbleMortar : (x % 3 === 0 || y % 2 === 0) ? C.cobbleMortar : cob ? C.cobble[0] : pick(C.cobble.slice(1)));
  }

  // Side walls (seen from above): stone tops with battlements on the inner edge.
  for (const sx of [0, W - SIDE]) {
    px(sx, TOWER_BASE + 2, C.top, SIDE, FRONT - TOWER_BASE - 2);
    for (let y = TOWER_BASE + 4; y < FRONT; y += 9) {
      const ix = sx ? sx : SIDE - 4;
      px(ix, y, C.topL, 4, 5); px(ix + (sx ? 0 : 3), y + 1, C.faceD, 1, 4);
    }
    px(sx ? sx : SIDE - 1, TOWER_BASE + 2, C.shadow, 1, FRONT - TOWER_BASE - 2);
  }

  // Front wall, drawn over everything.
  const front = makeCanvas(W, H), f = front.getContext('2d');
  const fpx = (x, y, col, w = 1, h = 1) => { f.fillStyle = col; f.fillRect(x, y, w, h); };
  fpx(0, FRONT, C.top, W, 6); fpx(0, FRONT, C.topL, W, 1);
  for (let x = 0; x < W; x += 10) { fpx(x, FRONT - 4, C.topL, 6, 1); fpx(x, FRONT - 3, C.top, 6, 3); fpx(x + 5, FRONT - 3, C.faceD, 1, 3); }
  for (let y = FRONT + 6; y < H; y++) for (let x = 0; x < W; x++) {
    const off = Math.floor((y - FRONT - 6) / 4) % 2 ? 4 : 0;
    fpx(x, y, (y - FRONT - 6) % 4 === 3 || (x + off) % 8 === 7 ? C.mortar : C.face);
  }

  // Hedge planters, depth-sorted with the fighters.
  const planter = makeCanvas(18, 16), p = planter.getContext('2d');
  const ppx = (x, y, col, w = 1, h = 1) => { p.fillStyle = col; p.fillRect(x, y, w, h); };
  ppx(1, 9, C.mortar, 16, 7); ppx(2, 9, C.top, 14, 2); ppx(2, 11, C.face, 14, 4); ppx(2, 9, C.topL, 14, 1);
  for (let y = 0; y < 11; y++) for (let x = 1; x < 17; x++) {
    const d = Math.hypot((x - 9) / 8, (y - 6) / 6);
    if (d > 1) continue;
    p.fillStyle = d > 0.85 ? C.leafOut : C.leaf[Math.max(0, Math.min(3, Math.round(2.4 - (y / 11) * 2 + (rng() - 0.5))))];
    p.fillRect(x, y, 1, 1);
  }
  const objects = [];
  const pt = { canvas: planter, w: 18, h: 16 };

  // The workshops: the cabin and the Forge face each other across the upper
  // floor, and the Enchanter's Hut stands at the front, below the fire.
  const art = { woodworker: drawCabin(), forge: drawForge(), enchanter: drawHut() };
  const sideY = Math.round(fy0 + (fy1 - fy0) * 0.36);
  const fireY = walk.cy + 4;
  const place = {
    woodworker: { x: SIDE + 3 + art.woodworker.w / 2, y: sideY },
    forge: { x: W - SIDE - 3 - art.forge.w / 2, y: sideY },
    enchanter: { x: cx, y: fy1 - 9 },
  };
  // A short courtyard leaves no room under the fire: step the hut aside.
  if (place.enchanter.y - art.enchanter.h < fireY + 6) place.enchanter.x = cx + 46;
  const buildings = Object.entries(place).map(([id, at]) => {
    const t = art[id], x = Math.round(at.x), y = Math.round(at.y);
    const ox = x - Math.floor(t.w / 2), oy = y - t.h;
    // A soft shadow on the flagstones along the front.
    for (let xx = ox + 1; xx < ox + t.w - 1; xx++) { px(xx, y, C.floorMortar); if (rng() < 0.7) px(xx, y + 1, C.floorMortar); }
    return {
      id, x, y, t,
      effect: t.effect,
      emit: { x: ox + t.emit[0], y: oy + t.emit[1] },
      lights: t.lights.map((l) => ({ ...l, x: ox + l.x, y: oy + l.y })),
    };
  });
  objects.push(...buildings);

  // Planters down both sides, spaced to fill however tall the courtyard is,
  // leaving out any that would crowd a workshop.
  const rows = Math.max(2, Math.round((FRONT - 4 - 72) / 56) + 1);
  const crowded = (x, y) => buildings.some((b) => Math.abs(x - b.x) < b.t.w / 2 + 10 && y > b.y - b.t.h + 2 && y < b.y + 22);
  for (let i = 0; i < rows; i++) {
    const y = Math.round(72 + (i * (FRONT - 4 - 72)) / (rows - 1));
    for (const x of [SIDE + 12, W - SIDE - 12]) if (!crowded(x, y)) objects.push({ x, y, t: pt });
  }

  const torches = [{ x: cx - 50, y: WALL_FACE + 12 }, { x: cx + 50, y: WALL_FACE + 12 }];
  for (const t of torches) { px(t.x - 1, t.y, C.iron, 3, 1); px(t.x, t.y + 1, C.iron, 1, 4); px(t.x - 1, t.y + 5, C.ironL, 3, 1); }

  return { bg, front, objects, buildings, torches, walk };
}

/** Draws a wall torch's little flame (3 frames), on top of the bracket. */
export function drawTorchFlame(ctx, s, t, x, y, i) {
  const f = Math.floor(t * 8 + i * 1.7) % 3;
  const shapes = [
    [[0, -4, '#f2c94c'], [0, -3, '#f2c94c'], [-1, -2, '#e0842e'], [0, -2, '#f8d988'], [1, -2, '#e0842e'], [0, -1, '#c23121'], [-1, -1, '#c23121'], [1, -1, '#c23121']],
    [[1, -4, '#f2c94c'], [0, -3, '#f2c94c'], [1, -3, '#e0842e'], [-1, -2, '#e0842e'], [0, -2, '#f8d988'], [1, -2, '#e0842e'], [0, -1, '#c23121'], [-1, -1, '#c23121'], [1, -1, '#c23121']],
    [[-1, -4, '#f2c94c'], [0, -3, '#f2c94c'], [-1, -3, '#e0842e'], [-1, -2, '#e0842e'], [0, -2, '#f8d988'], [1, -2, '#e0842e'], [0, -1, '#c23121'], [-1, -1, '#c23121'], [1, -1, '#c23121']],
  ];
  for (const [dx, dy, col] of shapes[f]) { ctx.fillStyle = col; ctx.fillRect((x + dx) * s, (y + dy) * s, s, s); }
}


// ---------- The workshops ----------
// Each is a little canvas drawn pixel by pixel, standing on its bottom row.
// emit: where smoke (or sparkles) rises; lights: what glows after dark, as
// {x, y, r, rgb, glass: [w, h]} with x, y the middle of the glow.

function sprite(w, h) {
  const canvas = makeCanvas(w, h), g = canvas.getContext('2d');
  const px = (x, y, col, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
  return { canvas, w, h, px };
}

// A pitched roof seen from the front: narrow at the ridge, full width at the eave.
function roof(px, x0, x1, y0, y1, slope, cols, joint, step = 2) {
  for (let y = y0; y <= y1; y++) {
    const inset = Math.max(0, (slope - (y - y0)) * 1);
    const a = x0 + inset, b = x1 - inset;
    for (let x = a; x <= b; x++) {
      const row = Math.floor((y - y0) / step), off = row % 2 ? 2 : 0;
      const j = (y - y0) % step === step - 1 || (x + off) % 4 === 0;
      px(x, y, y === y0 ? cols[2] : y === y1 ? joint : j ? cols[0] : cols[1]);
    }
  }
}

function drawCabin() {
  const s = sprite(34, 32), { px } = s;
  const log = ['#b07a46', '#93623a', '#5f3d22'], end = '#c9a06a', ring = '#7a5230', dark = '#3b2414';
  // Stovepipe.
  px(23, 0, '#3a3940', 5, 1); px(24, 1, '#2b2a30', 3, 9); px(24, 1, '#4a4952', 1, 9);
  // Log walls, with the log ends poking out at the corners.
  for (let y = 14; y < 32; y++) px(3, y, log[(y - 14) % 3], 28, 1);
  for (let y = 15; y < 31; y += 3) { px(1, y, end, 2, 2); px(31, y, end, 2, 2); px(1, y + 1, ring); px(32, y + 1, ring); }
  // Shingle roof over the top.
  roof(px, 0, 33, 4, 14, 5, ['#5e2c1d', '#8f4a2e', '#a8603c'], '#3f1d12');
  px(5, 4, '#a8603c', 24, 1);
  // Window with shutters and a door of planks.
  px(5, 18, dark, 7, 6); px(6, 19, '#8fa3a6', 5, 4); px(8, 19, dark, 1, 4); px(6, 21, dark, 5, 1);
  px(4, 18, '#7a3b26', 1, 6); px(12, 18, '#7a3b26', 1, 6);
  px(14, 20, dark, 7, 12); px(15, 21, '#6e4528', 5, 11); px(17, 21, '#5a3720', 1, 11); px(19, 26, '#e2b33d');
  // A stack of cut logs by the door.
  for (const [x, y] of [[23, 28], [26, 28], [29, 28], [24, 25], [27, 25], [25.5, 22]]) {
    px(Math.round(x), y, end, 3, 3); px(Math.round(x) + 1, y + 1, ring); px(Math.round(x), y + 2, log[2], 3, 1);
  }
  // Axe in the chopping stump.
  px(9, 29, '#6b4a2e', 5, 3); px(9, 29, '#8a6440', 5, 1); px(11, 25, '#93623a', 1, 4); px(10, 25, '#9aa0a8', 1, 2); px(12, 25, '#9aa0a8', 1, 2);
  return Object.assign(s, {
    effect: 'smoke', emit: [25.5, 0],
    lights: [{ x: 8.5, y: 21, r: 9, rgb: [255, 190, 90], glass: [5, 4] }],
  });
}

function drawForge() {
  const s = sprite(38, 32), { px } = s;
  const stone = ['#5a554d', '#6d675e', '#7f786d'], mortar = '#3e3a34';
  // Stone walls.
  for (let y = 14; y < 32; y++) for (let x = 2; x < 36; x++) {
    const row = Math.floor((y - 14) / 3), off = row % 2 ? 3 : 0;
    px(x, y, (y - 14) % 3 === 2 || (x + off) % 6 === 0 ? mortar : stone[(row + Math.floor((x + off) / 6)) % 3]);
  }
  // Slate roof (the chimney rises through it).
  roof(px, 0, 37, 6, 15, 5, ['#3b4452', '#5f6c7e', '#76849a'], '#262c36');
  // Brick chimney, rising through the roof.
  for (let y = 0; y < 12; y++) for (let x = 4; x < 11; x++) {
    const off = Math.floor(y / 2) % 2 ? 2 : 0;
    px(x, y, y % 2 === 1 || (x + off) % 4 === 0 ? '#5e2e22' : '#8a4632');
  }
  px(3, 0, '#4e4a44', 9, 2); px(3, 0, '#6d675e', 9, 1); px(4, 11, '#262c36', 7, 1);
  // The furnace: a stone arch full of glowing coals.
  for (let y = 18; y < 32; y++) for (let x = 12; x < 26; x++) {
    const ax = (x - 18.5) / 6.5, ay = (y - 24) / 6.5;
    if (y < 24 && ax * ax + ay * ay > 1) continue;
    const rim = Math.abs(ax) > 0.78 || (y < 24 && ax * ax + ay * ay > 0.62);
    px(x, y, rim ? '#9c9688' : '#1d1210');
  }
  const coals = ['#c23121', '#e0842e', '#f2c94c', '#8a2a1a'];
  for (let y = 26; y < 31; y++) for (let x = 15; x < 23; x++) px(x, y, coals[(x * 7 + y * 3) % (y > 28 ? 4 : 3)]);
  px(14, 31, '#4e4a44', 10, 1);
  // Anvil on a stump, and a quench bucket.
  px(29, 27, '#6b4a2e', 6, 5); px(29, 27, '#8a6440', 6, 1);
  px(27, 23, '#66656e', 9, 1); px(28, 24, '#2b2a30', 8, 1); px(26, 23, '#4a4952', 2, 1);
  px(30, 25, '#2b2a30', 4, 2); px(29, 26, '#2b2a30', 6, 1);
  px(3, 26, '#5a3720', 6, 6); px(3, 27, '#2b2a30', 6, 1); px(3, 30, '#2b2a30', 6, 1); px(4, 26, '#5f8fa8', 4, 1);
  return Object.assign(s, {
    effect: 'smoke', emit: [7.5, 0],
    lights: [{ x: 18.5, y: 27, r: 14, rgb: [255, 120, 40], glass: [8, 5] }],
  });
}

function drawHut() {
  const s = sprite(28, 42), { px } = s;
  const wall = '#d9ccb0', wallD = '#b8a988', beam = '#5a3720';
  const purple = ['#3e2563', '#5b3a8a', '#7a52b0'];
  // Plaster walls with timber posts.
  px(4, 24, wall, 20, 18); px(4, 24, wallD, 20, 2); px(4, 24, beam, 1, 18); px(23, 24, beam, 1, 18); px(4, 27, beam, 20, 1);
  // A tall pointed roof, banded in gold and dotted with stars.
  for (let y = 6; y <= 25; y++) {
    const half = 1 + 13 * Math.pow((y - 6) / 19, 0.85);
    const a = Math.round(14 - half), b = Math.round(13 + half);
    for (let x = a; x <= b; x++) {
      const band = (y - 6) % 4 === 3;
      px(x, y, y === 25 ? purple[0] : band ? purple[0] : x - a < 2 ? purple[2] : purple[1]);
    }
  }
  px(3, 21, '#e2b33d', 22, 1); px(4, 22, '#a77d22', 20, 1);
  for (const [x, y] of [[12, 11], [16, 15], [9, 18], [18, 19]]) px(x, y, '#f2c94c');
  // A crystal on the tip.
  px(13, 0, '#d6fbff', 2, 1); px(12, 1, '#7fe3f0', 4, 3); px(12, 1, '#d6fbff', 1, 2); px(15, 2, '#3fb3d0', 1, 2);
  px(13, 4, '#3fb3d0', 2, 2);
  // A round window and an arched door.
  for (let y = 29; y < 36; y++) for (let x = 6; x < 13; x++) {
    const d = Math.hypot(x - 9, y - 32);
    if (d < 3.6) px(x, y, d > 2.4 ? beam : (x === 9 || y === 32) ? '#4a2f5e' : '#8f6cc7');
  }
  for (let y = 31; y < 42; y++) for (let x = 15; x < 22; x++) {
    if (y < 34 && Math.hypot(x - 18, y - 34) > 3.6) continue;
    px(x, y, (x === 15 || x === 21 || Math.hypot(x - 18, y - 34) > 2.8 && y < 34) ? beam : '#4a2f5e');
  }
  px(20, 37, '#e2b33d');
  // Crystals growing beside the step.
  px(24, 37, '#3fb3d0', 1, 5); px(25, 35, '#7fe3f0', 1, 7); px(26, 38, '#3fb3d0', 1, 4); px(25, 35, '#d6fbff');
  px(1, 39, '#8f6cc7', 1, 3); px(2, 37, '#b48ce0', 1, 5); px(2, 37, '#e9d8ff');
  return Object.assign(s, {
    effect: 'sparkle', emit: [13.5, 1],
    lights: [
      { x: 9, y: 32, r: 9, rgb: [190, 130, 255], glass: [5, 5] },
      { x: 13.5, y: 2.5, r: 8, rgb: [120, 230, 255], glass: [4, 4] },
    ],
  });
}
