// Day-night cycle for the camp, following the player's local clock.
// Pure functions only; js/scene.js draws with them.

// Keyframes through the day (hour 0-24). `tint` is multiplied over the scene
// (white = no change); `fire` is how strongly the campfire lights its
// surroundings; `fireflies` is how many come out.
export const KEYS = [
  { h: 0,    tint: [58, 70, 128],   fire: 1,    fireflies: 14 },  // night
  { h: 4.5,  tint: [58, 70, 128],   fire: 1,    fireflies: 14 },
  { h: 5.75, tint: [190, 140, 165], fire: 0.6,  fireflies: 4 },   // dawn: pink
  { h: 6.5,  tint: [255, 196, 160], fire: 0.35, fireflies: 0 },   // sunrise: warm
  { h: 7.5,  tint: [255, 255, 255], fire: 0.2,  fireflies: 0 },   // day
  { h: 16.5, tint: [255, 255, 255], fire: 0.2,  fireflies: 0 },
  { h: 17.75, tint: [255, 186, 128], fire: 0.35, fireflies: 0 },  // dusk: golden
  { h: 18.75, tint: [190, 120, 150], fire: 0.6,  fireflies: 4 },  // dusk: purple
  { h: 19.5, tint: [118, 92, 142],  fire: 0.85, fireflies: 9 },  // twilight
  { h: 20.25, tint: [58, 70, 128],   fire: 1,    fireflies: 14 }, // night
  { h: 24,   tint: [58, 70, 128],   fire: 1,    fireflies: 14 },
];

export const PHASES = [
  { id: 'night', name: 'Night', from: 20.25, to: 4.5 },
  { id: 'dawn',  name: 'Dawn',  from: 4.5,   to: 7.5 },
  { id: 'day',   name: 'Day',   from: 7.5,   to: 16.5 },
  { id: 'dusk',  name: 'Dusk',  from: 16.5,  to: 20.25 },
];

const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);

/** Lighting at an hour of the day (0-24, fractional). */
export function lightAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const k = smooth(b.h === a.h ? 0 : (h - a.h) / (b.h - a.h));
  return {
    tint: a.tint.map((c, j) => Math.round(lerp(c, b.tint[j], k))),
    fire: lerp(a.fire, b.fire, k),
    fireflies: Math.round(lerp(a.fireflies, b.fireflies, k)),
    phase: phaseAt(h),
  };
}

export function phaseAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  for (const p of PHASES) {
    const inside = p.from < p.to ? h >= p.from && h < p.to : h >= p.from || h < p.to;
    if (inside) return p;
  }
  return PHASES[0];
}

/**
 * The hour to show. Normally the local clock; `?hour=21` fixes it and
 * `?daylength=60` runs a whole day in 60 seconds (for testing).
 */
export function hourNow(now = new Date(), params = new URLSearchParams(globalThis.location?.search || '')) {
  if (params.has('hour')) return Number(params.get('hour')) || 0;
  if (params.has('daylength')) {
    const len = Math.max(5, Number(params.get('daylength')) || 60);
    return ((now.getTime() / 1000) % len) / len * 24;
  }
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

/** "6:42 pm"-style clock text for an hour. */
export function clockText(hour) {
  const h = ((hour % 24) + 24) % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
}
