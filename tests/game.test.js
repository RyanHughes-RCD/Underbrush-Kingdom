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

test('smelting odds: 3 bottle caps give about 50% iron, never above steel', () => {
  const odds = G.smeltOdds('bottlecap', 3);
  assert.deepEqual(odds.map((o) => o.material), ['iron', 'copper', 'bronze', 'steel']);
  assert.ok(Math.abs(odds[0].p - 0.5) < 0.02, `iron ${odds[0].p}`);
  assert.ok(Math.abs(odds.reduce((a, o) => a + o.p, 0) - 1) < 1e-9);
  assert.ok(odds[3].p < 0.05, `steel should be very rare (${odds[3].p})`);
  // More value in, better odds of higher tiers.
  assert.ok(G.smeltOdds('bottlecap', 3)[3].p > G.smeltOdds('bottlecap', 2)[3].p);
  assert.ok(G.smeltOdds('bottlecap', 1)[0].p > 0.7);
});

test('smelting results match the odds over many batches', () => {
  const s = G.newGame(11);
  const counts = {};
  for (let i = 0; i < 4000; i++) {
    s.inventory.bottlecap = 3;
    const j = G.startSmelting(s, 'forge', 3, 0);
    counts[j.result] = (counts[j.result] || 0) + 1;
  }
  assert.ok(Math.abs(counts.iron / 4000 - 0.5) < 0.04, JSON.stringify(counts));
  assert.ok(!counts.silversteel);
});

test('workshop smelts over time, batches queue in turn', () => {
  const s = G.newGame(3);
  s.inventory.twig = 5;
  const a = G.startSmelting(s, 'woodworker', 3, 0);
  const b = G.startSmelting(s, 'woodworker', 2, 0);
  assert.equal(s.inventory.twig, 0);
  assert.equal(b.startsAt, a.endsAt);
  G.tick(s, WORKSHOPS.woodworker.minutes * MIN);
  assert.equal(s.inventory[a.result], 1 + (a.result === b.result ? 0 : 0));
  G.tick(s, 2 * WORKSHOPS.woodworker.minutes * MIN);
  assert.equal(s.inventory.pine + s.inventory.oak + s.inventory.ashwood + s.inventory.ironwood, 2);
  assert.throws(() => G.startSmelting(s, 'woodworker', 1, 0));
  s.inventory.twig = 50;
  assert.throws(() => G.startSmelting(s, 'woodworker', 4, 0), /at most 3/);
});

test('craft, equip and lure', () => {
  const s = G.newGame(5);
  s.inventory.pine = 2; s.inventory.steel = 2; s.inventory.oak = 2; s.inventory.iron = 2; s.inventory.garnet = 1;
  const bow = G.craftWeapon(s, 'longbow', 'pine', 'iron');
  assert.equal(G.weaponName(bow), 'Iron-bound Pine Longbow');
  assert.equal(s.inventory.pine, 0);
  assert.equal(s.inventory.iron, 1);
  assert.throws(() => G.craftWeapon(s, 'recurve', 'pine', 'iron'), /Needs 2 Pine/);
  assert.throws(() => G.craftWeapon(s, 'longbow', 'oak', 'garnet'), /metal for the fittings/);
  assert.throws(() => G.craftWeapon(s, 'longbow', 'steel', 'iron'));
  const sword = G.craftWeapon(s, 'mace', 'steel', 'garnet');
  assert.equal(G.weaponName(sword), 'Garnet-set Steel Mace');
  assert.ok(G.weaponProfile(sword).attack > G.weaponProfile(bow).attack); // steel beats pine
  const archer = s.creatures.find((c) => c.cls === 'archer');
  const knight = s.creatures.find((c) => c.cls === 'knight');
  const before = G.creaturePower(s, archer);
  assert.throws(() => G.equipWeapon(s, knight.id, bow.id));
  G.equipWeapon(s, archer.id, bow.id);
  assert.ok(G.creaturePower(s, archer) > before);

  const bow2 = G.craftWeapon(s, 'recurve', 'oak', 'iron');
  G.startLure(s, bow2.id, 0);
  G.tick(s, LURE_MINUTES * MIN);
  assert.equal(s.creatures.length, 4);
  assert.equal(s.creatures[3].cls, 'archer');
  assert.equal(s.creatures[3].weaponId, bow2.id);
});

test('version 1 saves migrate to tiered materials', () => {
  const v1 = {
    version: 1, seed: 1, nextId: 9, creatures: [], expeditions: [], lures: [], log: [],
    inventory: { twig: 2, bottlecap: 0, pebble: 1, wood: 3, metal: 1, gem: 0 },
    weapons: [{ id: 'w1', type: 'sword', tier: 2 }],
    jobs: [{ id: 'j1', workshop: 'forge', startsAt: 0, endsAt: 10 }],
  };
  const s = G.deserialize(JSON.stringify(v1));
  assert.equal(s.version, G.SAVE_VERSION);
  assert.equal(s.inventory.pine, 3);
  assert.equal(s.inventory.iron, 1);
  assert.equal(s.inventory.wood, undefined);
  assert.equal(s.weapons[0].material, 'copper');
  assert.equal(s.weapons[0].type, 'sword');
  G.tick(s, 10);
  assert.equal(s.inventory.iron, 2);
});

test('version 2 saves: bows become longbows', () => {
  const v2 = { version: 2, seed: 1, nextId: 3, creatures: [], expeditions: [], lures: [], log: [], jobs: [], discovered: [],
    inventory: { twig: 0 }, weapons: [{ id: 'w1', type: 'bow', material: 'oak' }, { id: 'w2', type: 'staff', material: 'quartz' }] };
  const s = G.deserialize(JSON.stringify(v2));
  assert.deepEqual(s.weapons.map((w) => w.type), ['longbow', 'staff']);
});

test('version 3 saves: weapons get basic fittings', () => {
  const v3 = { version: 3, seed: 1, nextId: 3, creatures: [], expeditions: [], lures: [], log: [], jobs: [], discovered: [],
    inventory: {}, weapons: [{ id: 'w1', type: 'longbow', material: 'oak' }, { id: 'w2', type: 'tome', material: 'garnet' }, { id: 'w3', type: 'mace', material: 'iron' }] };
  const s = G.deserialize(JSON.stringify(v3));
  assert.deepEqual(s.weapons.map((w) => w.accent), ['iron', 'pine', 'quartz']);
});

test('save round-trips', () => {
  const s = G.newGame(9);
  const copy = G.deserialize(G.serialize(s));
  assert.deepEqual(copy, s);
});
