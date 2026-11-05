import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statsAt, nextLevelGain, rollStatTraits, talent, BASE_SPREAD, GROWTH_SPREAD, weaponProfile, weaponDamage, unarmedDamage, powerOf, gradeOf } from '../js/stats.js';
import { CLASS_IDS, CLASSES, STAT_IDS, WEAPONS, FAMILIES, CLASS_STATS } from '../js/data.js';
import { mulberry32 } from '../js/game.js';

test('every class has all seven stats, and they never drop as level rises', () => {
  for (const cls of CLASS_IDS) {
    let prev = statsAt(cls, 1);
    assert.deepEqual(Object.keys(prev), STAT_IDS);
    for (let lv = 2; lv <= 30; lv++) {
      const st = statsAt(cls, lv);
      for (const s of STAT_IDS) assert.ok(st[s] >= prev[s], `${cls} ${s} at ${lv}`);
      prev = st;
    }
    assert.ok(statsAt(cls, 10).hp > statsAt(cls, 1).hp);
  }
});

test('classes lean on different stats', () => {
  assert.ok(statsAt('archer', 5).dex > statsAt('knight', 5).dex);
  assert.ok(statsAt('knight', 5).str > statsAt('mage', 5).str);
  assert.ok(statsAt('mage', 5).int > statsAt('archer', 5).int);
  assert.ok(statsAt('knight', 5).hp > statsAt('mage', 5).hp);
});

test('next level gain matches the difference between levels', () => {
  const g = nextLevelGain('knight', 3);
  assert.equal(g.hp, statsAt('knight', 4).hp - statsAt('knight', 3).hp);
});

test('better materials raise attack and scaling grades', () => {
  for (const [type, wt] of Object.entries(WEAPONS)) {
    const list = FAMILIES[wt.family].list;
    const lo = weaponProfile(type, list[0].id), hi = weaponProfile(type, list[9].id);
    assert.ok(hi.attack > lo.attack, type);
    assert.ok(hi.scaling[0].coef > lo.scaling[0].coef, type);
    assert.equal(hi.scaling[0].grade, 'S', `${type} at tier 10 should scale S`);
  }
});

test('the two weapon types in a class scale differently and cross over', () => {
  for (const cls of CLASS_IDS) {
    const [a, b] = CLASSES[cls].weapons;
    assert.notDeepEqual(WEAPONS[a].scaling, WEAPONS[b].scaling);
    assert.notEqual(WEAPONS[a].attack, WEAPONS[b].attack);
    const mat = FAMILIES[WEAPONS[a].family].list[0].id;
    const dmg = (t, lv) => weaponDamage(weaponProfile(t, mat), statsAt(cls, lv));
    // The first type leads at level 1, the second has caught up by level 10.
    assert.ok(dmg(a, 1) >= dmg(b, 1), `${cls} early`);
    assert.ok(dmg(b, 10) > dmg(a, 10), `${cls} late`);
  }
});

test('weapon damage grows as the wielder levels up', () => {
  const p = weaponProfile('mace', 'iron');
  assert.ok(weaponDamage(p, statsAt('knight', 10)) > weaponDamage(p, statsAt('knight', 1)));
});

test('a new fighter is about 3 power bare-handed and stronger armed', () => {
  for (const cls of CLASS_IDS) {
    const st = statsAt(cls, 1);
    const bare = powerOf(st, unarmedDamage(cls, st));
    assert.ok(bare > 2.5 && bare < 4, `${cls} ${bare}`);
    const t = CLASSES[cls].weapons[0];
    assert.ok(powerOf(st, weaponDamage(weaponProfile(t, FAMILIES[WEAPONS[t].family].list[0].id), st)) > bare);
  }
});

test('weapon quality: main material counts double, fittings once', () => {
  const p = weaponProfile('sword', 'godsbane', 'quartz');
  assert.equal(p.quality, Math.round(((2 * 3.5 + 1.0) / 3) * 100) / 100);
  assert.ok(weaponProfile('sword', 'iron', 'prismheart').quality < weaponProfile('sword', 'godsbane', 'quartz').quality);
  assert.ok(weaponProfile('sword', 'iron', 'garnet').attack >= weaponProfile('sword', 'iron', 'quartz').attack);
});

test('grades', () => {
  assert.equal(gradeOf(1.2), 'S');
  assert.equal(gradeOf(0.45), 'C');
  assert.equal(gradeOf(0.16), 'D');
  assert.equal(gradeOf(0.05), 'E');
  assert.equal(gradeOf(0), '-');
});

test('rolled traits stay within the spread and keep class identity', () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 200; i++) {
    const t = rollStatTraits(rng);
    for (const s of STAT_IDS) {
      assert.ok(Math.abs(t.base[s] - 1) <= BASE_SPREAD + 1e-9);
      assert.ok(Math.abs(t.growth[s] - 1) <= GROWTH_SPREAD + 1e-9);
    }
    // Even an unlucky archer out-dexes a lucky knight.
    assert.ok(statsAt('archer', 5, t).dex > CLASS_STATS.knight.base.dex * 1.2 + CLASS_STATS.knight.growth.dex * 1.25 * 4);
  }
});

test('two creatures of a class end up with different stats', () => {
  const rng = mulberry32(7);
  const a = statsAt('mage', 10, rollStatTraits(rng)), b = statsAt('mage', 10, rollStatTraits(rng));
  assert.notDeepEqual(a, b);
});

test('talent marks strong and weak stats', () => {
  const t = { base: { str: 1.18, dex: 0.82, int: 1 }, growth: { str: 0.76, dex: 1.2, int: 1 } };
  assert.deepEqual(talent(t, 'str'), { base: 'high', growth: 'low' });
  assert.deepEqual(talent(t, 'dex'), { base: 'low', growth: 'high' });
  assert.deepEqual(talent(t, 'int'), { base: '', growth: '' });
});
