import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import { ENCOUNTER_MINUTES, WORKSHOPS, LURE_MINUTES } from '../js/data.js';

const MIN = 60 * 1000;

test('new game starts with one fighter of each class', () => {
  const s = G.newGame(42);
  assert.deepEqual(s.creatures.map((c) => c.cls).sort(), ['archer', 'knight', 'mage']);
  assert.equal(s.inventory.twig, 0);
});

test('expedition duration is 10 minutes per encounter', () => {
  const s = G.newGame(1);
  const ids = s.creatures.map((c) => c.id);
  const e = G.startExpedition(s, 'thicket', ids, 6, 0);
  assert.equal(G.expeditionEndsAt(e), 6 * ENCOUNTER_MINUTES * MIN);
  assert.equal(G.encountersDone(e, 25 * MIN), 2);
  assert.ok(!G.isExpeditionComplete(e, 59 * MIN));
  assert.ok(G.isExpeditionComplete(e, 60 * MIN));
});

test('busy fighters cannot join another expedition', () => {
  const s = G.newGame(1);
  const [a] = s.creatures;
  G.startExpedition(s, 'creek', [a.id], 1, 0);
  assert.throws(() => G.startExpedition(s, 'creek', [a.id], 1, 0));
});

test('claiming adds loot and frees the party; early return keeps partial loot', () => {
  const s = G.newGame(7);
  const ids = s.creatures.map((c) => c.id);
  const e = G.startExpedition(s, 'meadow', ids, 4, 0);
  const expected = e.encounters.slice(0, 2).reduce((n, enc) => n + Object.values(enc.loot).reduce((a, b) => a + b, 0), 0);
  const r = G.claimExpedition(s, e.id, 2 * ENCOUNTER_MINUTES * MIN);
  assert.equal(r.done, 2);
  const total = s.inventory.twig + s.inventory.bottlecap + s.inventory.pebble;
  assert.equal(total, expected);
  assert.equal(s.expeditions.length, 0);
  assert.ok(!G.isBusy(s, ids[0]));
});

test('workshop turns scrap into material over time, queued sequentially', () => {
  const s = G.newGame(3);
  s.inventory.twig = WORKSHOPS.woodworker.inputQty * 2;
  G.startProcessing(s, 'woodworker', 2, 0);
  assert.equal(s.inventory.twig, 0);
  G.tick(s, WORKSHOPS.woodworker.minutes * MIN);
  assert.equal(s.inventory.wood, 1);
  G.tick(s, 2 * WORKSHOPS.woodworker.minutes * MIN);
  assert.equal(s.inventory.wood, 2);
  assert.throws(() => G.startProcessing(s, 'woodworker', 1, 0));
});

test('craft, equip and lure', () => {
  const s = G.newGame(5);
  s.inventory.wood = 10;
  const bow = G.craftWeapon(s, 'bow', 1);
  const archer = s.creatures.find((c) => c.cls === 'archer');
  const knight = s.creatures.find((c) => c.cls === 'knight');
  const before = G.creaturePower(s, archer);
  assert.throws(() => G.equipWeapon(s, knight.id, bow.id));
  G.equipWeapon(s, archer.id, bow.id);
  assert.ok(G.creaturePower(s, archer) > before);

  const bow2 = G.craftWeapon(s, 'bow', 2);
  G.startLure(s, bow2.id, 0);
  assert.equal(G.freeWeapons(s).length, 0);
  G.tick(s, LURE_MINUTES * MIN);
  assert.equal(s.creatures.length, 4);
  assert.equal(s.creatures[3].cls, 'archer');
  assert.equal(s.creatures[3].weaponId, bow2.id);
});

test('save round-trips', () => {
  const s = G.newGame(9);
  const copy = G.deserialize(G.serialize(s));
  assert.deepEqual(copy, s);
});
