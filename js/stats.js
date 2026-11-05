// Stat maths: class stats by level, weapon profiles by type and material,
// damage, and the overall power used on expeditions. Pure functions only.

import { CLASS_STATS, STAT_IDS, WEAPONS, MATERIALS, GRADES } from './data.js';

// Each creature rolls its own multipliers on its class's base stats and
// growth when it joins, so no two fighters of a class are quite alike.
export const BASE_SPREAD = 0.2;    // base stats vary by up to ±20%
export const GROWTH_SPREAD = 0.25; // growth per level varies by up to ±25%

/** Rolls a creature's stat multipliers with `rng` (a function returning 0-1). */
export function rollStatTraits(rng) {
  const roll = (spread) => Math.round((1 - spread + rng() * spread * 2) * 100) / 100;
  return {
    base: Object.fromEntries(STAT_IDS.map((s) => [s, roll(BASE_SPREAD)])),
    growth: Object.fromEntries(STAT_IDS.map((s) => [s, roll(GROWTH_SPREAD)])),
  };
}

/**
 * A creature's stats at a level: floor(base * baseMult + growth * growthMult
 * * (level - 1)). Without traits this is the class average.
 */
export function statsAt(cls, level, traits = null) {
  const { base, growth } = CLASS_STATS[cls];
  const bm = traits?.base || {}, gm = traits?.growth || {};
  return Object.fromEntries(STAT_IDS.map((s) => [s, Math.floor(base[s] * (bm[s] ?? 1) + growth[s] * (gm[s] ?? 1) * (level - 1))]));
}

/** Stats gained on the next level up. */
export function nextLevelGain(cls, level, traits = null) {
  const now = statsAt(cls, level, traits), next = statsAt(cls, level + 1, traits);
  return Object.fromEntries(STAT_IDS.map((s) => [s, next[s] - now[s]]));
}

/**
 * How a creature compares with its class on one stat: 'high', 'low' or ''
 * for its starting value and for its growth.
 */
export function talent(traits, stat) {
  const mark = (m, spread) => (m >= 1 + spread / 2 ? 'high' : m <= 1 - spread / 2 ? 'low' : '');
  return { base: mark(traits?.base?.[stat] ?? 1, BASE_SPREAD), growth: mark(traits?.growth?.[stat] ?? 1, GROWTH_SPREAD) };
}

export function gradeOf(coef) {
  for (const [min, g] of GRADES) if (coef >= min && coef > 0) return g;
  return '-';
}

/** A weapon's quality: its main material counts double, its fittings once. */
export function weaponQuality(materialId, accentId) {
  const qm = MATERIALS[materialId].quality;
  if (!accentId) return qm;
  return Math.round(((2 * qm + MATERIALS[accentId].quality) / 3) * 100) / 100;
}

/**
 * A weapon type made from a main material and a fittings material: attack
 * and scaling both multiplied by the weapon's quality. Scaling is listed
 * strongest first.
 */
export function weaponProfile(type, materialId, accentId) {
  const wt = WEAPONS[type], q = weaponQuality(materialId, accentId);
  const scaling = Object.entries(wt.scaling)
    .map(([stat, c]) => ({ stat, coef: c * q, grade: gradeOf(c * q) }))
    .sort((a, b) => b.coef - a.coef);
  return { type, material: materialId, accent: accentId, quality: q, attack: Math.round(wt.attack * q), baseAttack: wt.attack * q, scaling };
}

/** Damage of a weapon profile in the hands of a fighter with these stats. */
export function weaponDamage(profile, stats) {
  return Math.round(profile.baseAttack + profile.scaling.reduce((sum, s) => sum + s.coef * stats[s.stat], 0));
}

const MAIN_STAT = { archer: 'dex', knight: 'str', mage: 'int' };
/** Without a weapon a fighter still lands a blow with half its main stat. */
export function unarmedDamage(cls, stats) { return Math.floor(stats[MAIN_STAT[cls]] * 0.5); }

/**
 * Overall power, used for expedition odds: damage, plus half the defensive
 * stats, plus a quarter of HP, scaled down by 5. A new level-1 fighter with
 * no weapon is about 3.
 */
export function powerOf(stats, damage) {
  return (damage + (stats.mig + stats.spi + stats.lck) / 2 + stats.hp / 4) / 5;
}
