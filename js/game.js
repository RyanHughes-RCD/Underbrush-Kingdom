// Pure game logic. Every function takes the state (and `now` in ms where time
// matters) and mutates/returns it. No DOM access here so it can be unit tested.

import {
  CLASSES, CLASS_IDS, ITEMS, WEAPONS, WORKSHOPS, EXPEDITION_TYPES, REGIONS, SCRAPS, MATERIALS, RARITIES,
  materialAt, SMELT_FALLOFF, MAX_BATCH, WEAPON_COST, ACCENT_WORD,
  ENCOUNTER_MINUTES, MIN_ENCOUNTERS, MAX_ENCOUNTERS, MAX_PARTY,
  LURE_MINUTES, MAX_ROSTER,
} from './data.js';
import * as ST from './stats.js';
import * as PK from './perks.js';

export const SAVE_VERSION = 7;
const MINUTE = 60 * 1000;

// Debug/testing: multiplies the speed of all timers. Set via ?speed=60.
let timeScale = 1;
export function setTimeScale(s) { timeScale = s > 0 ? s : 1; }
export function minutesToMs(min) { return (min * MINUTE) / timeScale; }

// ---------- RNG (seeded, so expeditions are reproducible) ----------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextSeed(state) {
  const rng = mulberry32(state.seed);
  state.seed = Math.floor(rng() * 2 ** 32);
  return state.seed;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  // Final avalanche (murmur3 fmix32) so similar strings give unrelated seeds.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

function pickWeighted(rng, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
  return entries[entries.length - 1][0];
}

// ---------- New game ----------

export function newGame(seed = Date.now()) {
  const state = {
    version: SAVE_VERSION,
    seed: seed >>> 0,
    nextId: 1,
    creatures: [],
    inventory: Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0])),
    weapons: [],
    expeditions: [],
    jobs: [],
    lures: [],
    log: [],
    discovered: [],
  };
  for (const cls of CLASS_IDS) addCreature(state, cls);
  addLog(state, 'Three brave fighters gather beneath the ferns. The Underbrush Kingdom begins.');
  return state;
}

function newId(state, prefix) { return `${prefix}${state.nextId++}`; }

export function addLog(state, text, now = Date.now()) {
  state.log.unshift({ t: now, text });
  if (state.log.length > 50) state.log.length = 50;
}

// ---------- Creatures ----------

/**
 * Adds a creature. `lureQuality` is the quality of the weapon that drew it
 * to the Lure Post (better weapons draw rarer creatures); starters use 1
 * and are always Common.
 */
export function addCreature(state, cls, weaponId = null, lureQuality = null) {
  const rng = mulberry32(nextSeed(state));
  const used = new Set(state.creatures.map((c) => c.name));
  const pool = CLASSES[cls].names.filter((n) => !used.has(n));
  const name = pool.length ? pick(rng, pool) : `${pick(rng, CLASSES[cls].names)} ${state.nextId}`;
  const traits = rollTraits(rng);
  const rarity = lureQuality == null ? 'common' : PK.rollRarity(rng, lureQuality);
  Object.assign(traits, { rarity, perks: PK.rollPerks(rng, cls, rarity) });
  const c = { id: newId(state, 'c'), name, cls, level: 1, xp: 0, weaponId, traits };
  state.creatures.push(c);
  return c;
}

/**
 * Everything that makes one creature unique: stat multipliers and a colour
 * tint. About a third keep close to their class's usual colours; the rest
 * can land anywhere on the colour wheel.
 */
export function rollTraits(rng) {
  const near = rng() < 0.3;
  const tint = {
    h: Math.round(near ? rng() * 40 - 20 : rng() * 360 - 180),
    s: Math.round((0.9 + rng() * 0.6) * 100) / 100,
    l: Math.round((0.9 + rng() * 0.2) * 100) / 100,
  };
  return { ...ST.rollStatTraits(rng), tint };
}

export function getCreature(state, id) { return state.creatures.find((c) => c.id === id); }
export function getWeapon(state, id) { return state.weapons.find((w) => w.id === id); }

export function weaponProfile(w) { return ST.weaponProfile(w.type, w.material, w.accent); }
export function weaponName(w) {
  const base = `${MATERIALS[w.material].name} ${WEAPONS[w.type].name}`;
  return w.accent ? `${MATERIALS[w.accent].name}-${ACCENT_WORD[MATERIALS[w.accent].family]} ${base}` : base;
}
export function weaponTier(w) { return MATERIALS[w.material].tier; }
export const withArticle = (name) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;

/** A fighter's stats, including its own perks (allies' perks apply on expeditions). */
export function creatureStats(c, bonus = PK.selfBonus(c.traits?.perks)) {
  return PK.applyStatBonus(ST.statsAt(c.cls, c.level, c.traits), bonus);
}

/** What a fighter hits for with its current weapon (or bare claws). */
export function creatureDamage(state, c, weapon = getWeapon(state, c.weaponId), bonus) {
  const stats = creatureStats(c, bonus);
  return weapon ? ST.weaponDamage(weaponProfile(weapon), stats) : ST.unarmedDamage(c.cls, stats);
}

/** Overall power from stats and weapon damage; used for expedition odds. */
export function creaturePowerExact(state, c, bonus) {
  return ST.powerOf(creatureStats(c, bonus), creatureDamage(state, c, undefined, bonus));
}
export function creaturePower(state, c) { return Math.round(creaturePowerExact(state, c) * 10) / 10; }

export function xpToNext(level) { return 3 + level * 2; }

function grantXp(state, c, amount, now) {
  c.xp += amount;
  while (c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level += 1;
    addLog(state, `${c.name} reached level ${c.level}!`, now);
  }
}

export function isBusy(state, creatureId) {
  return state.expeditions.some((e) => e.partyIds.includes(creatureId));
}

// ---------- Expeditions ----------
// An expedition is a party, a type (which skills are in demand), a duration
// (number of encounters) and a region (difficulty and rewards).

export function encounterDifficulty(region, index) {
  return region.baseDifficulty + index * 1.5;
}

export function expeditionName(typeId, regionId) {
  return `${EXPEDITION_TYPES[typeId].name} in ${REGIONS[regionId].name}`;
}

/** Everything a party's perks add: per-member stat/XP bonuses and party-wide effects. */
export function partyPerks(state, partyIds) {
  return PK.partyEffects(partyIds.map((id) => getCreature(state, id)?.traits?.perks || []));
}

export function partyScore(state, partyIds, demand, effects = partyPerks(state, partyIds)) {
  return partyIds.reduce((sum, id, i) => {
    const c = getCreature(state, id);
    const p = creaturePowerExact(state, c, effects.perMember[i]);
    return sum + (c.cls === demand ? p * 1.6 : p);
  }, 0);
}

/** Win chance: power against difficulty, plus perk bonuses, kept within 10-95%. */
export function successChance(score, difficulty, bonus = 0) {
  return Math.min(0.95, Math.max(0.1, score / (score + difficulty) + bonus));
}
const perkWin = (effects, demand) => effects.party.win + (effects.party.demand[demand] || 0);

/** Expected scrap from one won encounter at this depth in this region. */
export function expectedFinds(region, index) { return 2 + Math.floor(index / 3) + region.bonusFinds; }

/** Rough odds and rewards shown to the player before setting out. */
export function previewExpedition(state, typeId, regionId, partyIds, count) {
  const type = EXPEDITION_TYPES[typeId], region = REGIONS[regionId];
  const fx = partyPerks(state, partyIds);
  const byDemand = {};
  for (const cls of CLASS_IDS) byDemand[cls] = partyScore(state, partyIds, cls, fx);
  let wins = 0, finds = 0;
  for (let i = 0; i < count; i++) {
    const d = encounterDifficulty(region, i);
    const p = type.encounters.reduce((s, e) => s + successChance(byDemand[e.demand], d, perkWin(fx, e.demand)), 0) / type.encounters.length;
    wins += p;
    finds += p * (expectedFinds(region, i) + Math.min(1, fx.party.finds)) + (1 - p) * 0.5;
  }
  return { expectedWins: wins, avgChance: count ? wins / count : 0, expectedFinds: finds, expectedXp: wins * region.xpPerWin, perks: fx };
}

export function canStartExpedition(state, typeId, regionId, partyIds, count) {
  if (!EXPEDITION_TYPES[typeId]) return 'Choose an expedition type.';
  if (!REGIONS[regionId]) return 'Choose a region.';
  if (!partyIds.length) return 'Choose at least one fighter.';
  if (partyIds.length > MAX_PARTY) return `A party can have at most ${MAX_PARTY} fighters.`;
  if (new Set(partyIds).size !== partyIds.length) return 'Duplicate fighter.';
  for (const id of partyIds) {
    if (!getCreature(state, id)) return 'Unknown fighter.';
    if (isBusy(state, id)) return 'That fighter is already away.';
  }
  if (!Number.isInteger(count) || count < MIN_ENCOUNTERS || count > MAX_ENCOUNTERS) {
    return `Choose between ${MIN_ENCOUNTERS} and ${MAX_ENCOUNTERS} encounters.`;
  }
  return null;
}

/**
 * Starts an expedition. Encounter outcomes are rolled immediately (seeded) and
 * revealed to the player one by one as each 10-minute encounter elapses.
 */
export function startExpedition(state, typeId, regionId, partyIds, count, now = Date.now()) {
  const err = canStartExpedition(state, typeId, regionId, partyIds, count);
  if (err) throw new Error(err);
  const type = EXPEDITION_TYPES[typeId], region = REGIONS[regionId];
  const rng = mulberry32(nextSeed(state));
  const fx = partyPerks(state, partyIds);
  const encounters = [];
  for (let i = 0; i < count; i++) {
    const tpl = pick(rng, type.encounters);
    const difficulty = encounterDifficulty(region, i);
    const chance = successChance(partyScore(state, partyIds, tpl.demand, fx), difficulty, perkWin(fx, tpl.demand));
    const success = rng() < chance;
    const loot = {};
    let finds = success ? 1 + Math.floor(rng() * 3) + Math.floor(i / 3) + region.bonusFinds : (rng() < 0.5 ? 1 : 0);
    if (success && rng() < fx.party.finds) finds += 1; // Forager, Treasure Nose
    for (let f = 0; f < finds; f++) {
      const item = pickWeighted(rng, region.loot);
      loot[item] = (loot[item] || 0) + 1;
    }
    encounters.push({ name: tpl.name, demand: tpl.demand, difficulty, chance, success, loot });
  }
  const e = {
    id: newId(state, 'e'),
    type: typeId,
    region: regionId,
    partyIds: [...partyIds],
    startedAt: now,
    encounterMs: minutesToMs(ENCOUNTER_MINUTES),
    encounters,
  };
  state.expeditions.push(e);
  const names = partyIds.map((id) => getCreature(state, id).name).join(', ');
  addLog(state, `${names} set out: ${expeditionName(typeId, regionId)} (${count} encounters).`, now);
  return e;
}

export function encountersDone(e, now = Date.now()) {
  return Math.min(e.encounters.length, Math.floor((now - e.startedAt) / e.encounterMs));
}

export function expeditionEndsAt(e) { return e.startedAt + e.encounters.length * e.encounterMs; }
export function isExpeditionComplete(e, now = Date.now()) { return encountersDone(e, now) >= e.encounters.length; }

/**
 * Brings a party home. If called before the expedition is complete, the party
 * returns early with whatever the completed encounters yielded.
 */
export function claimExpedition(state, expeditionId, now = Date.now()) {
  const idx = state.expeditions.findIndex((x) => x.id === expeditionId);
  if (idx < 0) throw new Error('No such expedition.');
  const e = state.expeditions[idx];
  const done = encountersDone(e, now);
  const loot = {};
  let wins = 0;
  for (const enc of e.encounters.slice(0, done)) {
    if (enc.success) wins++;
    for (const [k, q] of Object.entries(enc.loot)) loot[k] = (loot[k] || 0) + q;
  }
  for (const [k, q] of Object.entries(loot)) state.inventory[k] = (state.inventory[k] || 0) + q;
  state.expeditions.splice(idx, 1);
  const xp = wins * (REGIONS[e.region]?.xpPerWin || 1);
  const present = e.partyIds.filter((id) => getCreature(state, id));
  const fx = partyPerks(state, present);
  const xpGiven = {};
  present.forEach((id, i) => {
    // Quick Learner, Mentor: XP bonuses, rounded down.
    xpGiven[id] = Math.floor(xp * (1 + (fx.perMember[i].xp || 0)));
    grantXp(state, getCreature(state, id), xpGiven[id], now);
  });
  const lootText = Object.entries(loot).map(([k, q]) => `${q} ${ITEMS[k].name}${q > 1 ? 's' : ''}`).join(', ') || 'nothing';
  const early = done < e.encounters.length ? ' early' : '';
  addLog(state, `Party returned${early} from ${expeditionName(e.type, e.region)}: ${wins}/${done} encounters won, found ${lootText}.`, now);
  return { loot, wins, done, xp, xpGiven };
}

// ---------- Workshops (smelting scrap into materials) ----------

/**
 * Odds for each material a batch could become. `count` pieces of `scrapId`
 * are put in; their total value spreads the odds toward higher tiers, up to
 * the scrap's maxTier. Returns [{material, tier, p}] with p summing to 1.
 */
export function smeltOdds(scrapId, count) {
  const sc = SCRAPS[scrapId];
  const value = sc.value * count;
  const spread = Math.sqrt(value) / SMELT_FALLOFF;
  const weights = [];
  for (let t = 1; t <= sc.maxTier; t++) weights.push(Math.exp(-((t - 1) ** 2) / (2 * spread * spread)));
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w, i) => ({ material: materialAt(sc.family, i + 1), tier: i + 1, p: w / total }));
}

export function workshopJobs(state, workshopId) {
  return state.jobs.filter((j) => j.workshop === workshopId).sort((a, b) => a.endsAt - b.endsAt);
}

export function canSmelt(state, workshopId, count) {
  const w = WORKSHOPS[workshopId];
  if (!w) return 'Unknown workshop.';
  if (!Number.isInteger(count) || count < 1) return 'Put in at least one piece.';
  if (count > MAX_BATCH) return `A batch holds at most ${MAX_BATCH} pieces.`;
  if ((state.inventory[w.input] || 0) < count) return `You only have ${state.inventory[w.input] || 0} ${ITEMS[w.input].name}s.`;
  return null;
}

/**
 * Puts `count` scrap into a workshop. The result is rolled now (seeded) and
 * revealed when the batch finishes. Batches in one workshop run in turn.
 */
export function startSmelting(state, workshopId, count, now = Date.now()) {
  const err = canSmelt(state, workshopId, count);
  if (err) throw new Error(err);
  const w = WORKSHOPS[workshopId];
  state.inventory[w.input] -= count;
  const rng = mulberry32(nextSeed(state));
  const odds = smeltOdds(w.input, count);
  let r = rng(), result = odds[0].material;
  for (const o of odds) { r -= o.p; if (r < 0) { result = o.material; break; } }
  const queue = workshopJobs(state, workshopId);
  const start = Math.max(now, queue.length ? queue[queue.length - 1].endsAt : now);
  const job = { id: newId(state, 'j'), workshop: workshopId, input: w.input, count, result, startsAt: start, endsAt: start + minutesToMs(w.minutes) };
  state.jobs.push(job);
  return job;
}

// ---------- Crafting weapons ----------

export function canCraft(state, weaponType, materialId, accentId) {
  const wt = WEAPONS[weaponType];
  if (!wt) return 'Unknown weapon.';
  const mat = MATERIALS[materialId], acc = MATERIALS[accentId];
  if (!mat || mat.family !== wt.family) return `Pick a ${wt.family} for the ${wt.name.toLowerCase()}.`;
  if (!acc || acc.family !== wt.accentFamily) return `Pick a ${wt.accentFamily} for the fittings.`;
  if ((state.inventory[materialId] || 0) < WEAPON_COST.main) return `Needs ${WEAPON_COST.main} ${mat.name}.`;
  if ((state.inventory[accentId] || 0) < WEAPON_COST.accent) return `Needs ${WEAPON_COST.accent} ${acc.name}.`;
  return null;
}

export function craftWeapon(state, weaponType, materialId, accentId, now = Date.now()) {
  const err = canCraft(state, weaponType, materialId, accentId);
  if (err) throw new Error(err);
  state.inventory[materialId] -= WEAPON_COST.main;
  state.inventory[accentId] -= WEAPON_COST.accent;
  const w = { id: newId(state, 'w'), type: weaponType, material: materialId, accent: accentId };
  state.weapons.push(w);
  addLog(state, `Crafted ${withArticle(weaponName(w))}.`, now);
  return w;
}

/** Weapons in the armory: not held by a creature and not left at the lure post. */
export function freeWeapons(state) {
  const held = new Set(state.creatures.map((c) => c.weaponId).filter(Boolean));
  const lured = new Set(state.lures.map((l) => l.weaponId));
  return state.weapons.filter((w) => !held.has(w.id) && !lured.has(w.id));
}

export function equipWeapon(state, creatureId, weaponId) {
  const c = getCreature(state, creatureId);
  if (!c) throw new Error('No such fighter.');
  if (isBusy(state, creatureId)) throw new Error('That fighter is away on an expedition.');
  if (weaponId == null) { c.weaponId = null; return; }
  const w = freeWeapons(state).find((x) => x.id === weaponId);
  if (!w) throw new Error('That weapon is not available.');
  if (WEAPONS[w.type].cls !== c.cls) throw new Error(`Only ${CLASSES[WEAPONS[w.type].cls].plural} can use that.`);
  c.weaponId = w.id;
}

// ---------- Luring new recruits ----------

export function canLure(state, weaponId) {
  if (state.creatures.length + state.lures.length >= MAX_ROSTER) return 'Your camp is full.';
  if (!freeWeapons(state).some((w) => w.id === weaponId)) return 'That weapon is not available.';
  return null;
}

/** Leave a weapon at the Lure Post; a creature of its class arrives to claim it. */
export function startLure(state, weaponId, now = Date.now()) {
  const err = canLure(state, weaponId);
  if (err) throw new Error(err);
  const w = getWeapon(state, weaponId);
  const cls = WEAPONS[w.type].cls;
  state.lures.push({ id: newId(state, 'l'), weaponId, cls, quality: weaponProfile(w).quality, startedAt: now, endsAt: now + minutesToMs(LURE_MINUTES) });
  addLog(state, `Left ${withArticle(weaponName(w))} at the Lure Post. Something is watching...`, now);
}

// ---------- Ticking timers ----------

/** Completes any finished workshop jobs and lures. Returns true if anything changed. */
export function tick(state, now = Date.now()) {
  let changed = false;
  const finished = state.jobs.filter((j) => j.endsAt <= now);
  if (finished.length) {
    state.jobs = state.jobs.filter((j) => j.endsAt > now);
    for (const j of finished.sort((a, b) => a.endsAt - b.endsAt)) {
      state.inventory[j.result] = (state.inventory[j.result] || 0) + 1;
      const mat = MATERIALS[j.result];
      addLog(state, `${WORKSHOPS[j.workshop].name} turned ${j.count} ${ITEMS[j.input].name}${j.count > 1 ? 's' : ''} into ${mat.name} (tier ${mat.tier})!`, now);
      state.recent = [{ material: j.result, t: now }, ...(state.recent || [])].slice(0, 5);
      if (!state.discovered.includes(j.result)) state.discovered.push(j.result);
    }
    changed = true;
  }
  const arrived = state.lures.filter((l) => l.endsAt <= now);
  if (arrived.length) {
    state.lures = state.lures.filter((l) => l.endsAt > now);
    for (const l of arrived) {
      const c = addCreature(state, l.cls, l.weaponId, l.quality ?? weaponProfile(getWeapon(state, l.weaponId)).quality);
      const r = RARITIES[c.traits.rarity].name;
      addLog(state, `${withArticle(r)} ${CLASSES[l.cls].name}, ${c.name}, wandered in and claimed the ${weaponName(getWeapon(state, l.weaponId))}!`, now);
    }
    changed = true;
  }
  return changed;
}

// ---------- Save / load ----------

const SAVE_KEY = 'underbrush-kingdom-save';

export function serialize(state) { return JSON.stringify(state); }

/** Upgrades older saves. v1 had generic wood/metal/gem and weapon tiers 1-3; v2 had one weapon type per class; v3 weapons had one material; v4 expeditions were zones, now type + region; v5 creatures had no traits; v6 creatures had no perks. */
export function migrate(s) {
  if (s.version === 1) {
    const map = { wood: 'wood', metal: 'metal', gem: 'crystal' };
    for (const [old, fam] of Object.entries(map)) {
      if (s.inventory[old]) s.inventory[materialAt(fam, 1)] = (s.inventory[materialAt(fam, 1)] || 0) + s.inventory[old];
      delete s.inventory[old];
    }
    const oldFamily = { bow: 'wood', sword: 'metal', staff: 'crystal' };
    for (const w of s.weapons) {
      w.material = materialAt(oldFamily[w.type], Math.min(10, w.tier || 1));
      delete w.tier;
    }
    s.jobs = s.jobs.map((j) => {
      const ws = WORKSHOPS[j.workshop];
      return { ...j, input: ws.input, count: 3, result: materialAt(ws.family, 1) };
    });
    s.version = 2;
  }
  if (s.version === 2) {
    // v2 had one weapon per class; bows became Longbows (Recurve Bows are new).
    for (const w of s.weapons) if (w.type === 'bow') w.type = 'longbow';
    s.version = 3;
  }
  if (s.version === 3) {
    // v3 weapons were one material; they get basic (tier 1) fittings.
    for (const w of s.weapons) if (!w.accent) w.accent = materialAt(WEAPONS[w.type].accentFamily, 1);
    s.version = 4;
  }
  if (s.version === 4) {
    // v4 expeditions were one of four zones; each became a type plus a region.
    const map = { thicket: 'scouting', gutter: 'skirmish', creek: 'research', meadow: 'excursion' };
    for (const e of s.expeditions) if (!e.region) { e.region = e.type; e.type = map[e.type] || 'excursion'; }
    s.version = 5;
  }
  if (s.version === 5) {
    // v5 creatures all looked and grew alike; each gets its own traits.
    for (const c of s.creatures) if (!c.traits) c.traits = rollTraits(mulberry32(hashString(c.id + s.seed)));
    s.version = 6;
  }
  if (s.version === 6) {
    // v6 creatures had no perks; each becomes Common with one minor perk.
    for (const c of s.creatures) {
      if (c.traits.perks) continue;
      const rng = mulberry32(hashString(`perks:${c.id}:${s.seed}`));
      c.traits.rarity = 'common';
      c.traits.perks = PK.rollPerks(rng, c.cls, 'common');
    }
    s.version = 7;
  }
  return s;
}

export function deserialize(json) {
  let s = JSON.parse(json);
  if (!s) return null;
  s = migrate(s);
  if (s.version !== SAVE_VERSION) return null;
  // Make sure new item types added later exist in older saves.
  for (const k of Object.keys(ITEMS)) if (!(k in s.inventory)) s.inventory[k] = 0;
  if (!s.discovered) s.discovered = Object.keys(MATERIALS).filter((k) => s.inventory[k] > 0);
  return s;
}

export function saveToStorage(state, storage = globalThis.localStorage) {
  try { storage.setItem(SAVE_KEY, serialize(state)); } catch { /* storage unavailable */ }
}

export function loadFromStorage(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw ? deserialize(raw) : null;
  } catch { return null; }
}

export function clearStorage(storage = globalThis.localStorage) {
  try { storage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
