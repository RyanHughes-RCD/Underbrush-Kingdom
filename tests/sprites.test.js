import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layout, decode, PAD, weaponSprite, autoColors, variantKind, accentKind, tintPalette, tintedBody } from '../js/sprites.js';
import { CLASS_IDS, CLASSES, WEAPONS, FAMILIES } from '../js/data.js';

const sheet = JSON.parse(readFileSync(new URL('../assets/sprites/sprites.json', import.meta.url)));

test('every class has a body and two weapon types with a design', () => {
  for (const cls of CLASS_IDS) {
    assert.ok(sheet.bodies[cls], cls);
    assert.equal(CLASSES[cls].weapons.length, 2);
    for (const t of CLASSES[cls].weapons) assert.equal(WEAPONS[t].cls, cls);
  }
  for (const t of Object.keys(WEAPONS)) assert.ok(sheet.weapons[t], `design for ${t}`);
});

test('every weapon type renders in every material of its family', () => {
  for (const [t, w] of Object.entries(WEAPONS)) {
    for (const m of FAMILIES[w.family].list) {
      const acc = FAMILIES[w.accentFamily].list[4].id;
      const sp = weaponSprite(sheet, t, m.id, acc);
      assert.ok(sp, `${t} ${m.id}`);
      assert.equal(sp.pixels.length, sp.w * sp.h);
      assert.equal(decode(sp).length, sp.w * sp.h * 4);
    }
  }
});

test('saved recolours win; other materials recolour automatically', () => {
  const oak = weaponSprite(sheet, 'longbow', 'oak');
  assert.equal(oak.palette[1], sheet.weapons.longbow.variants.oak.colors['1']);
  assert.equal(oak.pixels, sheet.weapons.longbow.pixels);
  assert.equal(variantKind(sheet, 'longbow', 'oak'), 'recolour');
  assert.equal(variantKind(sheet, 'longbow', 'godwood'), 'auto');
  const god = weaponSprite(sheet, 'longbow', 'godwood');
  assert.notEqual(god.palette[1], sheet.weapons.longbow.palette[1]);
  // Colours that aren't swaps (outline, string) never change.
  assert.equal(god.palette[0], sheet.weapons.longbow.palette[0]);
});

test('auto colours spread dark to light over the swap colours', () => {
  const c = autoColors(['#000000', '#cccccc', '#444444'], [1, 2], 'steel');
  assert.equal(c[2], '#2c3640'); // darker base colour gets the dark tone
  assert.equal(c[1], '#d6e2ec');
});

test('fittings recolour only the fittings colours', () => {
  const plain = weaponSprite(sheet, 'staff', 'garnet');
  const oak = weaponSprite(sheet, 'staff', 'garnet', 'oak');
  const god = weaponSprite(sheet, 'staff', 'garnet', 'godwood');
  const acc = sheet.weapons.staff.accentSwaps;
  assert.ok(acc.length);
  for (let i = 0; i < plain.palette.length; i++) {
    if (acc.includes(i)) assert.notEqual(oak.palette[i], god.palette[i], `fittings colour ${i}`);
    else assert.equal(oak.palette[i], plain.palette[i], `colour ${i} is not a fitting`);
  }
  // Saved fittings colours win over automatic ones.
  const data = structuredClone(sheet);
  data.weapons.staff.accents = { oak: { colors: { [acc[0]]: '#123456' } } };
  assert.equal(weaponSprite(data, 'staff', 'garnet', 'oak').palette[acc[0]], '#123456');
  assert.equal(accentKind(data, 'staff', 'garnet', 'oak'), 'recolour');
  assert.equal(accentKind(data, 'staff', 'garnet', 'pine'), 'auto');
});

test('a material with its own design uses its own pixels', () => {
  const data = structuredClone(sheet);
  data.weapons.sword.variants.godsbane = { w: 4, h: 2, pixels: '0..00..0', palette: ['#ffffff'], pivot: { x: 1, y: 1 } };
  const sp = weaponSprite(data, 'sword', 'godsbane');
  assert.equal(sp.w, 4);
  assert.equal(variantKind(data, 'sword', 'godsbane'), 'design');
  assert.equal(weaponSprite(data, 'sword', 'iron').w, sheet.weapons.sword.w);
});

test('an equipped weapon is placed with its pivot on the body anchor', () => {
  const parts = layout(sheet, 'archer', [{ type: 'longbow', material: 'oak', accent: 'iron' }]);
  const bow = parts.find((p) => p.id === 'longbow:oak+iron');
  const a = sheet.bodies.archer.anchors.hand, pv = sheet.weapons.longbow.pivot;
  assert.equal(bow.x + pv.x, PAD + a.x);
  assert.equal(bow.y + pv.y, PAD + a.y);
});

test('worn pieces show by default and an equipped weapon replaces one in the same slot', () => {
  const data = structuredClone(sheet);
  const art = { w: 2, h: 2, palette: ['#000000'], pixels: '0000', pivot: { x: 0, y: 0 }, anchor: 'hand', layer: 'front' };
  data.pieces['starter-bow'] = { ...art, slot: 'weapon', wornBy: ['archer'] };
  data.pieces.hat = { ...art, slot: 'head', anchor: 'head', layer: 'back', wornBy: ['archer'] };
  assert.deepEqual(layout(data, 'archer').map((p) => p.id), ['hat', 'archer', 'starter-bow']);
  assert.deepEqual(layout(data, 'archer', [{ type: 'recurve', material: 'pine' }]).map((p) => p.id), ['hat', 'archer', 'recurve:pine']);
  assert.deepEqual(layout(data, 'knight').map((p) => p.id), ['knight']);
});

test('a creature tint only recolours the body colours marked to vary', () => {
  for (const cls of Object.keys(sheet.bodies)) {
    const body = sheet.bodies[cls];
    assert.ok(body.tints?.length, `${cls} has colours that vary`);
    const t = tintedBody(sheet, cls, { h: 120, s: 1.2, l: 1 });
    body.palette.forEach((c, i) => {
      if (body.tints.includes(i)) assert.notEqual(t.palette[i], c, `${cls} colour ${i}`);
      else assert.equal(t.palette[i], c);
    });
  }
  assert.deepEqual(tintPalette(['#ff0000'], [0], { h: 0, s: 1, l: 1 }), ['#ff0000']);
  assert.deepEqual(tintPalette(['#ff0000'], [0], { h: 120, s: 1, l: 1 }), ['#00ff00']);
});

test('the campfire prop has six frames sharing one palette and size', async () => {
  const { propFrame } = await import('../js/sprites.js');
  const p = sheet.props.campfire;
  assert.equal(p.frames.length, 6);
  for (let i = 0; i < p.frames.length; i++) {
    assert.equal(p.frames[i].length, p.w * p.h, `frame ${i}`);
    assert.equal(decode(propFrame(sheet, 'campfire', i)).length, p.w * p.h * 4);
  }
  assert.notEqual(p.frames[0], p.frames[1]);
  assert.equal(propFrame(sheet, 'campfire', 7).pixels, p.frames[1]); // frames loop
  assert.equal(propFrame(sheet, 'nothing', 0), null);
});
