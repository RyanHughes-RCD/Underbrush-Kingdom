// Offline cache. Bump CACHE when shipping changes so players get the update.
const CACHE = 'underbrush-v29';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/main.js', 'js/game.js', 'js/data.js', 'js/scene.js', 'js/sprites.js', 'js/stats.js', 'js/perks.js', 'js/daylight.js', 'js/courtyard.js', 'assets/sprites/sprites.json',
  'assets/sprites/archer-lizard.png', 'assets/sprites/beetle-knight.png', 'assets/sprites/wizard-mouse.png',
  'assets/items/twig.png', 'assets/items/bottlecap.png', 'assets/items/pebble.png',
  'assets/items/wood.png', 'assets/items/metal.png', 'assets/items/gem.png',
  'assets/items/coin.png', 'assets/items/bow.png', 'assets/items/sword.png', 'assets/items/staff.png',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png',
  'assets/icons/apple-touch-icon.png', 'assets/icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates land quickly; fall back to cache when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
