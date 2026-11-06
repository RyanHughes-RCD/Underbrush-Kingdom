import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import { REGIONS as REGIONS_ALL } from '../js/data.js';

// A new game with every region open, so tests can go anywhere.
const fresh = (seed) => { const s = G.newGame(seed); s.unlocked = Object.keys(REGIONS_ALL); return s; };
import { ENCOUNTER_MINUTES, WORKSHOPS, LURE_MINUTES, REGIONS, SCRAPS, SCRAP_RARITY_IDS, scrapsOf } from '../js/data.js';

const MIN = 60 * 1000;

test('new game starts with one fighter of each class', () => {
  const s = fresh(42);
  assert.deepEqual(s.creatures.map((c) => c.cls).sort(), ['archer', 'knight', 'mage']);
  assert.equal(s.inventory.twig, 0);
});

test('expedition duration is 10 minutes per encounter', () => {
  const s = fresh(1);
  const ids = s.creatures.map((c) => c.id);
  const e = G.startExpedition(s, 'scouting', 'thicket', ids, 6, 0);
  assert.equal(G.expeditionEndsAt(e), 6 * ENCOUNTER_MINUTES * MIN);
  assert.equal(G.encountersDone(e, 25 * MIN), 2);
  assert.ok(!G.isExpeditionComplete(e, 59 * MIN));
  assert.ok(G.isExpeditionComplete(e, 60 * MIN));
});

test('busy fighters cannot join another expedition', () => {
  const s = fresh(1);
  const [a] = s.creatures;
  G.startExpedition(s, 'research', 'creek', [a.id], 1, 0);
  assert.throws(() => G.startExpedition(s, 'research', 'creek', [a.id], 1, 0));
});

test('claiming adds loot and frees the party; early return keeps partial loot', () => {
  const s = fresh(7);
  const ids = s.creatures.map((c) => c.id);
  const e = G.startExpedition(s, 'excursion', 'meadow', ids, 4, 0);
  const expected = e.encounters.slice(0, 2).reduce((n, enc) => n + Object.values(enc.loot).reduce((a, b) => a + b, 0), 0);
  const r = G.claimExpedition(s, e.id, 2 * ENCOUNTER_MINUTES * MIN);
  assert.equal(r.done, 2);
  const total = Object.keys(SCRAPS).reduce((n, id) => n + (s.inventory[id] || 0), 0);
  assert.equal(total, expected);
  assert.equal(s.expeditions.length, 0);
  assert.ok(!G.isBusy(s, ids[0]));
});

test('an expedition needs a type and a region', () => {
  const s = fresh(2);
  const ids = s.creatures.map((c) => c.id);
  assert.throws(() => G.startExpedition(s, 'scouting', null, ids, 2, 0), /region/);
  assert.throws(() => G.startExpedition(s, null, 'meadow', ids, 2, 0), /type/);
  const e = G.startExpedition(s, 'skirmish', 'gutter', ids, 2, 0);
  assert.equal(e.type, 'skirmish');
  assert.equal(e.region, 'gutter');
  assert.equal(G.expeditionName(e.type, e.region), 'Skirmish in Old Gutter Drain');
});

test('the type sets which class is in demand', () => {
  const s = fresh(4);
  const ids = s.creatures.map((c) => c.id);
  const e = G.startExpedition(s, 'scouting', 'meadow', ids, 12, 0);
  const archers = e.encounters.filter((x) => x.demand === 'archer').length;
  assert.ok(archers > 12 / 3, `scouting should mostly want archers (${archers}/12)`);
});

test('harder regions are harder and pay better', () => {
  const s = fresh(6);
  const ids = s.creatures.map((c) => c.id);
  const easy = G.previewExpedition(s, 'excursion', 'meadow', ids, 6);
  const hard = G.previewExpedition(s, 'excursion', 'gutter', ids, 6);
  assert.ok(hard.avgChance < easy.avgChance);
  // Per win, the hard region finds more scrap and gives more XP.
  assert.ok(hard.expectedFinds / hard.expectedWins > easy.expectedFinds / easy.expectedWins);
  assert.ok(hard.expectedXp / hard.expectedWins > easy.expectedXp / easy.expectedWins);
  const order = Object.values(REGIONS).map((r) => r.baseDifficulty);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('there are eight regions, each harder and richer than the last', () => {
  const list = Object.values(REGIONS);
  assert.equal(list.length, 8);
  list.forEach((r, i) => assert.equal(r.level, i + 1, r.id));
  const better = (r) => { const t = Object.values(r.rarity).reduce((a, b) => a + b, 0); return (t - (r.rarity.common || 0)) / t; };
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    assert.ok(b.baseDifficulty > a.baseDifficulty, `${b.id} harder`);
    assert.ok(b.bonusFinds >= a.bonusFinds && b.xpPerWin >= a.xpPerWin, `${b.id} pays more`);
    assert.ok(better(b) > better(a), `${b.id} has rarer scrap`);
    for (const k of Object.keys(b.loot)) assert.ok(['wood', 'metal', 'crystal'].includes(k));
  }
});

test('coins: earned per won encounter, spent to unlock regions in order', () => {
  const s = G.newGame(31);
  const ids = s.creatures.map((c) => c.id);
  assert.equal(s.coins, 0);
  assert.deepEqual(s.unlocked, ['meadow']);
  assert.throws(() => G.startExpedition(s, 'excursion', 'thicket', ids, 1, 0), /locked/);
  const e = G.startExpedition(s, 'excursion', 'meadow', ids, 12, 0);
  const wins = e.encounters.filter((x) => x.success).length;
  const r = G.claimExpedition(s, e.id, 12 * ENCOUNTER_MINUTES * MIN);
  assert.equal(r.coins, wins * REGIONS.meadow.coinsPerWin);
  assert.equal(s.coins, r.coins);
  // In order only, and only with enough coins.
  s.coins = 1000;
  assert.throws(() => G.unlockRegion(s, 'creek'), /Tangled Thicket first/);
  G.unlockRegion(s, 'thicket');
  assert.equal(s.coins, 1000 - REGIONS.thicket.unlockCost);
  assert.ok(G.isUnlocked(s, 'thicket'));
  assert.throws(() => G.unlockRegion(s, 'thicket'), /already open/);
  s.coins = 3;
  assert.throws(() => G.unlockRegion(s, 'creek'), /Needs 150 coins/);
});

test('every region but the first costs coins, and costs rise', () => {
  const list = Object.values(REGIONS);
  assert.equal(list[0].unlockCost, 0);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i].unlockCost > list[i - 1].unlockCost, list[i].id);
    assert.ok(list[i].coinsPerWin > list[i - 1].coinsPerWin, list[i].id);
  }
});

test('version 8 saves open the first region plus any with a party out', () => {
  const v8 = { version: 8, seed: 1, nextId: 3, creatures: [], lures: [], log: [], jobs: [], discovered: [], inventory: {}, weapons: [],
    expeditions: [{ id: 'e1', type: 'skirmish', region: 'gutter', partyIds: [], startedAt: 0, encounterMs: 1, encounters: [] }] };
  const s = G.deserialize(JSON.stringify(v8));
  assert.equal(s.coins, 0);
  assert.deepEqual(s.unlocked, ['meadow', 'gutter']);
});

test('XP per win comes from the region', () => {
  const s = fresh(8);
  const ids = s.creatures.map((c) => c.id);
  const e = G.startExpedition(s, 'excursion', 'gutter', ids, 3, 0);
  const wins = e.encounters.filter((x) => x.success).length;
  const r = G.claimExpedition(s, e.id, 3 * ENCOUNTER_MINUTES * MIN);
  assert.equal(r.xp, wins * REGIONS.gutter.xpPerWin);
});

test('version 4 saves: zone expeditions become a type plus a region', () => {
  const v4 = { version: 4, seed: 1, nextId: 3, creatures: [], lures: [], log: [], jobs: [], discovered: [], inventory: {}, weapons: [],
    expeditions: [{ id: 'e1', type: 'gutter', partyIds: [], startedAt: 0, encounterMs: 1, encounters: [] }] };
  const s = G.deserialize(JSON.stringify(v4));
  assert.equal(s.expeditions[0].type, 'skirmish');
  assert.equal(s.expeditions[0].region, 'gutter');
});

test('smelting odds: 3 bottle caps give about 50% iron, never above steel', () => {
  const odds = G.smeltOdds({ bottlecap: 3 });
  assert.deepEqual(odds.map((o) => o.material), ['iron', 'copper', 'bronze', 'steel']);
  assert.ok(Math.abs(odds[0].p - 0.5) < 0.02, `iron ${odds[0].p}`);
  assert.ok(Math.abs(odds.reduce((a, o) => a + o.p, 0) - 1) < 1e-9);
  assert.ok(odds[3].p < 0.05, `steel should be very rare (${odds[3].p})`);
  assert.ok(G.smeltOdds({ bottlecap: 1 })[0].p > 0.7);
});

test('rarer scrap pushes the odds up the tiers and raises the cap', () => {
  const likeliest = (inputs) => G.smeltOdds(inputs).reduce((best, o) => (o.p > best.p ? o : best)).tier;
  const tiers = scrapsOf('metal').map((id) => likeliest({ [id]: 3 }));
  for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i] >= tiers[i - 1], `rarity ${i}: ${tiers}`);
  assert.equal(tiers[0], 1);
  assert.ok(tiers[6] >= 8, `3 divine scrap should centre high (${tiers[6]})`);
  assert.equal(G.smeltOdds({ ancient_crown_fragment: 3 }).length, 10);
  assert.equal(G.smeltOdds({ screw: 3 }).length, SCRAPS.screw.maxTier);
  // Mixing: one rare piece lifts a batch of commons a little.
  assert.ok(G.smeltOdds({ bottlecap: 2, old_key: 1 })[0].p < G.smeltOdds({ bottlecap: 3 })[0].p);
});

test('every family has seven scrap rarities', () => {
  for (const fam of ['metal', 'wood', 'crystal']) {
    const ids = scrapsOf(fam);
    assert.equal(ids.length, 7);
    ids.forEach((id, i) => { assert.equal(SCRAPS[id].rarity, SCRAP_RARITY_IDS[i]); assert.equal(SCRAPS[id].family, fam); });
  }
});

test('smelting results match the odds over many batches', () => {
  const s = fresh(11);
  const counts = {};
  for (let i = 0; i < 4000; i++) {
    s.inventory.bottlecap = 3;
    const j = G.startSmelting(s, 'forge', { bottlecap: 3 }, 0);
    counts[j.result] = (counts[j.result] || 0) + 1;
  }
  assert.ok(Math.abs(counts.iron / 4000 - 0.5) < 0.04, JSON.stringify(counts));
  assert.ok(!counts.silversteel);
});

test('workshop smelts mixed batches over time, batches queue in turn', () => {
  const s = fresh(3);
  s.inventory.twig = 4; s.inventory.birch_bark = 1;
  const a = G.startSmelting(s, 'woodworker', { twig: 2, birch_bark: 1 }, 0);
  const b = G.startSmelting(s, 'woodworker', { twig: 2 }, 0);
  assert.equal(s.inventory.twig, 0);
  assert.equal(s.inventory.birch_bark, 0);
  assert.equal(b.startsAt, a.endsAt);
  G.tick(s, 2 * WORKSHOPS.woodworker.minutes * MIN);
  const woods = ['pine', 'oak', 'ashwood', 'ironwood', 'heartwood', 'thornwood'].reduce((n, m) => n + (s.inventory[m] || 0), 0);
  assert.equal(woods, 2);
  s.inventory.twig = 50; s.inventory.bottlecap = 5;
  assert.throws(() => G.startSmelting(s, 'woodworker', { twig: 4 }, 0), /at most 3/);
  assert.throws(() => G.startSmelting(s, 'woodworker', { twig: 1, bottlecap: 1 }, 0), /can't use/);
  assert.throws(() => G.startSmelting(s, 'woodworker', { acorn_cap: 1 }, 0), /only have/);
});

test('harder regions find rarer scrap', () => {
  const s = fresh(14);
  const ids = s.creatures.map((c) => c.id);
  const rareShare = (region) => {
    let rare = 0, all = 0;
    for (let i = 0; i < 40; i++) {
      for (const c of s.creatures) c.traits.perks = [];
      const e = G.startExpedition(s, 'excursion', region, ids, 6, 0);
      for (const enc of e.encounters) for (const [k, q] of Object.entries(enc.loot)) { all += q; if (SCRAPS[k].rarity !== 'common') rare += q; }
      s.expeditions = [];
    }
    return rare / all;
  };
  assert.ok(rareShare('gutter') > rareShare('meadow') + 0.2);
});

test('version 7 saves: pebbles become broken glass', () => {
  const v7 = { version: 7, seed: 1, nextId: 3, creatures: [], lures: [], log: [], discovered: [], weapons: [],
    inventory: { pebble: 4, twig: 1 },
    jobs: [{ id: 'j1', workshop: 'enchanter', input: 'pebble', count: 3, result: 'quartz', startsAt: 0, endsAt: 10 }],
    expeditions: [{ id: 'e1', type: 'research', region: 'creek', partyIds: [], startedAt: 0, encounterMs: 1, encounters: [{ name: 'x', demand: 'mage', success: true, loot: { pebble: 2 } }] }] };
  const s = G.deserialize(JSON.stringify(v7));
  assert.equal(s.inventory.broken_glass, 4);
  assert.equal(s.inventory.pebble, undefined);
  assert.deepEqual(s.jobs[0].inputs, { broken_glass: 3 });
  assert.deepEqual(s.expeditions[0].encounters[0].loot, { broken_glass: 2 });
});

test('craft, equip and lure', () => {
  const s = fresh(5);
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

test('every creature rolls its own traits, and v5 saves get them too', () => {
  const s = fresh(12);
  for (const c of s.creatures) { assert.ok(c.traits?.tint); assert.ok(c.traits.base.hp); }
  const lured = G.addCreature(s, 'mage');
  const twin = G.addCreature(s, 'mage');
  assert.notDeepEqual(lured.traits, twin.traits);
  const v5 = { version: 5, seed: 3, nextId: 3, expeditions: [], lures: [], log: [], jobs: [], discovered: [], inventory: {}, weapons: [],
    creatures: [{ id: 'c1', name: 'Nib', cls: 'mage', level: 2, xp: 0, weaponId: null }] };
  const a = G.deserialize(JSON.stringify(v5)), b = G.deserialize(JSON.stringify(v5));
  assert.ok(a.creatures[0].traits.tint);
  assert.deepEqual(a.creatures[0].traits, b.creatures[0].traits); // stable per creature
});

test('save round-trips', () => {
  const s = fresh(9);
  const copy = G.deserialize(G.serialize(s));
  assert.deepEqual(copy, s);
});
