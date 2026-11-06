import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERKS, PERK_IDS, RARITIES, RARITY_IDS, STAT_IDS, ENCOUNTER_MINUTES } from '../js/data.js';
import { rollPerks, rollRarity, rarityOdds, partyEffects, selfBonus, perkLines } from '../js/perks.js';
import * as G from '../js/game.js';
import { REGIONS as REGIONS_ALL } from '../js/data.js';

// A new game with every region open, so tests can go anywhere.
const fresh = (seed) => { const s = G.newGame(seed); s.unlocked = Object.keys(REGIONS_ALL); return s; };

const cost = { minor: 1, mid: 2 };

test('every perk helps in battle and has readable text', () => {
  for (const id of PERK_IDS) {
    const p = PERKS[id];
    assert.ok(['minor', 'mid'].includes(p.tier), id);
    assert.ok(p.self || p.allies || p.party, `${id} does something`);
    for (const k of Object.keys({ ...p.self, ...p.allies })) assert.ok(k === 'xp' || STAT_IDS.includes(k), `${id}: ${k}`);
    assert.ok(perkLines(id).length);
    // Each perk reaches beyond the creature itself.
    assert.ok(p.allies || p.party, `${id} helps allies too`);
  }
});

test('mid perks are about twice as strong as minor ones', () => {
  const minor = PERKS.keen_eye, mid = PERKS.eagle_eye;
  assert.ok(mid.self.dex >= 2 * minor.self.dex && mid.allies.dex >= 2 * minor.allies.dex);
});

test('perk sets spend exactly the rarity budget, with no repeats', () => {
  for (const r of RARITY_IDS) {
    for (const [, set] of RARITIES[r].sets) assert.equal(set.reduce((s, t) => s + cost[t], 0), RARITIES[r].points, r);
    const rng = G.mulberry32(r.length * 101);
    for (let i = 0; i < 200; i++) {
      const perks = rollPerks(rng, 'mage', r);
      assert.equal(perks.reduce((s, id) => s + cost[PERKS[id].tier], 0), RARITIES[r].points);
      assert.equal(new Set(perks).size, perks.length);
    }
  }
});

test('class-favoured perks come up more often', () => {
  const rng = G.mulberry32(5);
  let dex = 0, int = 0;
  for (let i = 0; i < 2000; i++) { const [p] = rollPerks(rng, 'archer', 'common'); if (p === 'keen_eye') dex++; if (p === 'quick_wit') int++; }
  assert.ok(dex > int * 2, `${dex} vs ${int}`);
});

test('better lure weapons draw rarer creatures', () => {
  const lo = rarityOdds(1), hi = rarityOdds(3.5);
  assert.ok(lo.common > 0.5);
  assert.ok(hi.epic > lo.epic * 5);
  assert.ok(Math.abs(Object.values(hi).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const rng = G.mulberry32(9);
  const counts = {};
  for (let i = 0; i < 3000; i++) { const r = rollRarity(rng, 1); counts[r] = (counts[r] || 0) + 1; }
  assert.ok(Math.abs(counts.common / 3000 - lo.common) < 0.04);
});

test('perks help the creature and its allies', () => {
  const fx = partyEffects([['keen_eye'], ['lookout'], []]);
  assert.equal(fx.perMember[0].dex, PERKS.keen_eye.self.dex);   // self only, not its own ally bonus
  assert.equal(fx.perMember[1].dex, PERKS.keen_eye.allies.dex);
  assert.equal(fx.perMember[2].dex, PERKS.keen_eye.allies.dex);
  assert.equal(fx.party.win, PERKS.lookout.party.win);
  assert.deepEqual(selfBonus(['keen_eye', 'eagle_eye']), { dex: 0.26 });
});

test('starters are Common with one minor perk; lured creatures roll a rarity', () => {
  const s = fresh(3);
  for (const c of s.creatures) {
    assert.equal(c.traits.rarity, 'common');
    assert.equal(c.traits.perks.length, 1);
    assert.equal(PERKS[c.traits.perks[0]].tier, 'minor');
  }
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(G.addCreature(s, 'knight', null, 3.5).traits.rarity);
  assert.ok(seen.has('epic') && seen.has('rare'));
});

test('ally perks raise party odds; party perks add wins, scrap and XP', () => {
  const s = fresh(21);
  const ids = s.creatures.map((c) => c.id);
  s.creatures.forEach((c) => { c.traits.perks = []; });
  const plain = G.previewExpedition(s, 'excursion', 'creek', ids, 6);
  s.creatures[0].traits.perks = ['rallying_cry'];
  s.creatures[1].traits.perks = ['brawler'];
  s.creatures[2].traits.perks = ['treasure_nose'];
  const perked = G.previewExpedition(s, 'excursion', 'creek', ids, 6);
  assert.ok(perked.avgChance > plain.avgChance);
  assert.ok(perked.expectedFinds > plain.expectedFinds);
  // Mentor: more XP for everyone.
  s.creatures.forEach((c) => { c.traits.perks = []; c.xp = 0; });
  s.creatures[0].traits.perks = ['mentor'];
  const e = G.startExpedition(s, 'excursion', 'meadow', ids, 12, 0);
  const r = G.claimExpedition(s, e.id, 12 * ENCOUNTER_MINUTES * 60 * 1000);
  assert.ok(r.xp > 0);
  assert.equal(r.xpGiven[ids[0]], Math.floor(r.xp * (1 + PERKS.mentor.self.xp)));
  assert.equal(r.xpGiven[ids[1]], Math.floor(r.xp * (1 + PERKS.mentor.allies.xp)));
});

test('version 6 saves give existing creatures a Common perk', () => {
  const v6 = { version: 6, seed: 3, nextId: 3, expeditions: [], lures: [], log: [], jobs: [], discovered: [], inventory: {}, weapons: [],
    creatures: [{ id: 'c1', name: 'Nib', cls: 'mage', level: 2, xp: 0, weaponId: null, traits: { base: {}, growth: {}, tint: { h: 0, s: 1, l: 1 } } }] };
  const s = G.deserialize(JSON.stringify(v6));
  assert.equal(s.creatures[0].traits.rarity, 'common');
  assert.equal(s.creatures[0].traits.perks.length, 1);
});
