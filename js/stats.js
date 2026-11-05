// Stat maths: class stats by level, weapon profiles by type and material,
// damage, and the overall power used on expeditions. Pure functions only.

import { CLASS_STATS, STAT_IDS, WEAPONS, MATERIALS, GRADES } from './data.js';

/** A class's stats at a level: floor(base + growth * (level - 1)). */
export function statsAt(cls, level) {
  const { base, growth } = CLASS_STATS[cls];
  return Object.fromEntries(STAT_IDS.map((s) => [s, Math.floor(base[s] + growth[s] * (level - 1))]));
}

/** Stats gained on the next level up. */
export function nextLevelGain(cls, level) {
  const now = statsAt(cls, level), next = statsAt(cls, level + 1);
  return Object.fromEntries(STAT_IDS.map((s) => [s, next[s] - now[s]]));
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
