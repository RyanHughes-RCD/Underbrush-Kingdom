import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightAt, phaseAt, hourNow, clockText, KEYS } from '../js/daylight.js';

test('the day has dawn, day, dusk and night in order', () => {
  assert.equal(phaseAt(3).id, 'night');
  assert.equal(phaseAt(6).id, 'dawn');
  assert.equal(phaseAt(12).id, 'day');
  assert.equal(phaseAt(18).id, 'dusk');
  assert.equal(phaseAt(22).id, 'night');
  assert.equal(phaseAt(24.5).id, 'night'); // wraps
});

test('midday is untinted, midnight is dark and blue, and the fire matters most at night', () => {
  assert.deepEqual(lightAt(12).tint, [255, 255, 255]);
  const night = lightAt(0).tint;
  assert.ok(night[2] > night[0] && night[0] < 100);
  assert.ok(lightAt(0).fire > lightAt(12).fire);
  assert.ok(lightAt(0).fireflies > 0 && lightAt(12).fireflies === 0);
});

test('dawn and dusk are warm transitions, and the light changes smoothly', () => {
  const dawn = lightAt(6.5).tint, dusk = lightAt(17.75).tint;
  for (const t of [dawn, dusk]) assert.ok(t[0] > t[2], 'warm: more red than blue');
  for (let h = 0; h < 24; h += 0.25) {
    const a = lightAt(h).tint, b = lightAt(h + 0.25).tint;
    assert.ok(a.every((c, i) => Math.abs(c - b[i]) <= 40), `jump at ${h}`);
  }
  assert.equal(KEYS[0].tint.join(), KEYS[KEYS.length - 1].tint.join()); // midnight joins up
});

test('test switches and clock text', () => {
  assert.equal(hourNow(new Date(), new URLSearchParams('hour=21')), 21);
  const h = hourNow(new Date(30000), new URLSearchParams('daylength=60'));
  assert.equal(h, 12);
  assert.equal(clockText(18.7), '6:42 pm');
  assert.equal(clockText(0.5), '12:30 am');
  assert.equal(clockText(12), '12:00 pm');
});
