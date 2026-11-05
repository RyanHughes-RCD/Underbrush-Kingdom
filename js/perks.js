// Rarity and perks: rolling them, and what a party's perks add up to.
// Pure functions only. Perk data lives in PERKS in js/data.js.

import { PERKS, PERK_IDS, RARITIES, RARITY_IDS, RARITY_WEIGHTS, STATS } from './data.js';

function pickWeighted(rng, entries) {
  const total = entries.reduce((s, [w]) => s + w, 0);
  let r = rng() * total;
  for (const [w, v] of entries) { r -= w; if (r < 0) return v; }
  return entries[entries.length - 1][1];
}

/** Odds of each rarity for a recruit drawn by a weapon of quality q. */
export function rarityOdds(quality = 1) {
  const w = RARITY_IDS.map((id) => [RARITY_WEIGHTS[id](quality), id]);
  const total = w.reduce((s, [x]) => s + x, 0);
  return Object.fromEntries(w.map(([x, id]) => [id, x / total]));
}

export function rollRarity(rng, quality = 1) {
  return pickWeighted(rng, RARITY_IDS.map((id) => [RARITY_WEIGHTS[id](quality), id]));
}

/**
 * Rolls a creature's perks for its rarity: picks one of the rarity's perk
 * sets, then fills each slot with a different perk of that tier, favouring
 * perks that suit the class.
 */
export function rollPerks(rng, cls, rarity) {
  const slots = pickWeighted(rng, RARITIES[rarity].sets);
  const chosen = [];
  for (const tier of slots) {
    const pool = PERK_IDS.filter((id) => PERKS[id].tier === tier && !chosen.includes(id))
      .map((id) => [PERKS[id].favour.includes(cls) ? 3 : 1, id]);
    if (pool.length) chosen.push(pickWeighted(rng, pool));
  }
  return chosen;
}

const sumInto = (out, obj) => { for (const [k, v] of Object.entries(obj || {})) out[k] = (out[k] || 0) + v; return out; };

/** A creature's own perk bonuses: {stat or xp: fraction}. */
export function selfBonus(perks = []) {
  return perks.reduce((out, id) => sumInto(out, PERKS[id]?.self), {});
}

/**
 * What a party's perks add up to. `members` is a list of perk lists, one per
 * fighter. Returns, for each member, the stat/xp bonus it gets from itself
 * plus every ally, and the party-wide effects.
 */
export function partyEffects(members) {
  const allyBonus = members.map((perks) => perks.reduce((out, id) => sumInto(out, PERKS[id]?.allies), {}));
  const party = { win: 0, finds: 0, demand: {} };
  for (const perks of members) {
    for (const id of perks) {
      const p = PERKS[id]?.party; if (!p) continue;
      party.win += p.win || 0;
      party.finds += p.finds || 0;
      sumInto(party.demand, p.demand);
    }
  }
  const perMember = members.map((perks, i) => {
    const out = selfBonus(perks);
    allyBonus.forEach((b, j) => { if (j !== i) sumInto(out, b); });
    return out;
  });
  return { perMember, party };
}

/** Applies stat bonuses ({dex: 0.08, ...}) to a stat block. */
export function applyStatBonus(stats, bonus) {
  return Object.fromEntries(Object.entries(stats).map(([s, v]) => [s, Math.floor(v * (1 + (bonus[s] || 0)))]));
}

const pct = (x) => `+${Math.round(x * 100)}%`;
const statName = (k) => (k === 'xp' ? 'XP' : STATS[k].short);
const listBonus = (obj) => Object.entries(obj || {}).map(([k, v]) => `${pct(v)} ${statName(k)}`).join(', ');

/** Plain-language lines for a perk: [{who, text}]. */
export function perkLines(id) {
  const p = PERKS[id];
  const lines = [];
  if (p.self) lines.push({ who: 'Self', text: listBonus(p.self) });
  if (p.allies) lines.push({ who: 'Allies', text: listBonus(p.allies) });
  if (p.party) {
    const bits = [];
    if (p.party.win) bits.push(`${pct(p.party.win)} chance to win every encounter`);
    if (p.party.finds) bits.push(`${pct(p.party.finds)} chance of an extra scrap per win`);
    for (const [cls, v] of Object.entries(p.party.demand || {})) bits.push(`${pct(v)} chance to win ${cls === 'archer' ? 'archer' : cls === 'knight' ? 'knight' : 'mage'} encounters`);
    lines.push({ who: 'Party', text: bits.join(', ') });
  }
  return lines;
}
