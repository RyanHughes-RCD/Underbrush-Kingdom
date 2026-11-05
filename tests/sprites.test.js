import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layout, decode, PAD, weaponPieceId } from '../js/sprites.js';
import { CLASS_IDS, WEAPONS, MATERIALS } from '../js/data.js';

const sheet = JSON.parse(readFileSync(new URL('../assets/sprites/sprites.json', import.meta.url)));

test('every class has a body and every weapon material has art', () => {
  for (const cls of CLASS_IDS) assert.ok(sheet.bodies[cls], cls);
  for (const [type, wt] of Object.entries(WEAPONS)) {
    for (const mat of Object.values(MATERIALS).filter((m) => m.family === wt.family)) {
      assert.ok(sheet.pieces[weaponPieceId(type, mat.id, sheet)], `${type} ${mat.id}`);
    }
  }
});

test('weapon art: exact material piece wins, else tier group', () => {
  assert.equal(weaponPieceId('sword', 'copper', sheet), 'sword-1');
  assert.equal(weaponPieceId('sword', 'mithril', sheet), 'sword-2');
  assert.equal(weaponPieceId('sword', 'godsbane', sheet), 'sword-3');
  const data = { pieces: { ...sheet.pieces, 'sword-steel': sheet.pieces['sword-1'] } };
  assert.equal(weaponPieceId('sword', 'steel', data), 'sword-steel');
});

test('sprites decode to the right size', () => {
  for (const s of [...Object.values(sheet.bodies), ...Object.values(sheet.pieces)]) {
    assert.equal(s.pixels.length, s.w * s.h);
    assert.equal(decode(s).length, s.w * s.h * 4);
  }
});

test('an equipped piece is placed with its pivot on the body anchor', () => {
  const parts = layout(sheet, 'archer', ['bow-2']);
  const bow = parts.find((p) => p.id === 'bow-2');
  const a = sheet.bodies.archer.anchors.hand, pv = sheet.pieces['bow-2'].pivot;
  assert.equal(bow.x + pv.x, PAD + a.x);
  assert.equal(bow.y + pv.y, PAD + a.y);
});

test('worn pieces show by default and an equipped piece replaces one in the same slot', () => {
  const data = structuredClone(sheet);
  data.pieces['starter-bow'] = { ...data.pieces['bow-1'], wornBy: ['archer'] };
  data.pieces.hat = { ...data.pieces['bow-1'], slot: 'head', anchor: 'head', layer: 'back', wornBy: ['archer'] };
  const bare = layout(data, 'archer').map((p) => p.id);
  assert.deepEqual(bare, ['hat', 'archer', 'starter-bow']);
  const armed = layout(data, 'archer', ['bow-3']).map((p) => p.id);
  assert.deepEqual(armed, ['hat', 'archer', 'bow-3']);
  assert.deepEqual(layout(data, 'knight').map((p) => p.id), ['knight']);
});
