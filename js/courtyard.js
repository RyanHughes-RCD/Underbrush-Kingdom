// The camp's surroundings: an original castle courtyard drawn as pixel art.
// A battlemented back wall with a gated arch, banners and torches, a corner
// tower each side, side walls, a flagstone floor with a cobbled ring for the
// campfire, hedge planters, and a low front wall.
//
// buildCourtyard(W, H, rng) returns:
//   bg       a W x H canvas of everything fighters always stand in front of
//   front    a canvas drawn over everything (the front wall)
//   objects  [{x, y, t: {canvas, w, h}}] depth-sorted with the fighters
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

  // Cobbled ring where the campfire stands.
  const walk = { cx, cy: 100, rx: Math.round(W / 2) - 44, ry: 30 };
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
  for (const [x, y] of [[SIDE + 12, 72], [W - SIDE - 12, 72], [SIDE + 12, 128], [W - SIDE - 12, 128]]) objects.push({ x, y, t: pt });

  const torches = [{ x: cx - 50, y: WALL_FACE + 12 }, { x: cx + 50, y: WALL_FACE + 12 }];
  for (const t of torches) { px(t.x - 1, t.y, C.iron, 3, 1); px(t.x, t.y + 1, C.iron, 1, 4); px(t.x - 1, t.y + 5, C.ironL, 3, 1); }

  return { bg, front, objects, torches, walk };
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
