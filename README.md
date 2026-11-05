# Underbrush Kingdom

A phone-first web game about a band of tiny heroes living in the underbrush. Collect **Archer Lizards**, **Beetle Knights** and **Wizard Mice**, send them on expeditions, and turn the junk they bring home into weapons.

<p>
  <img src="assets/sprites/archer-lizard.png" width="128" alt="Archer Lizard">
  <img src="assets/sprites/beetle-knight.png" width="128" alt="Beetle Knight">
  <img src="assets/sprites/wizard-mouse.png" width="128" alt="Wizard Mouse">
</p>

## How it plays

1. **Start small.** You begin with three fighters: one of each class.
2. **Expeditions.** Pick an expedition type. Each one has its own *demands*, meaning which classes its encounters favour:
   | Expedition | Favours | Mostly finds |
   |---|---|---|
   | Tangled Thicket | Archer Lizards | Stray twigs |
   | Old Gutter Drain | Beetle Knights | Bottle caps |
   | Glimmer Creek | Wizard Mice | Pebbles |
   | Windy Meadow | A mixed party | A bit of everything |
3. **Duration = encounters.** Choose 1–12 encounters, 10 minutes each (6 encounters = 1 hour). Results are revealed one encounter at a time. Later encounters are harder but give more. You can recall a party early and keep what they've already found.
4. **Workshops.** Take scrap to be processed:
   - Woodworker's Cabin: twigs → **wood**
   - The Forge: bottle caps → **metal**
   - Enchanter's Hut: pebbles → **gemstones**
5. **Craft weapons.** Bows (wood), swords (metal) and staffs (gems) come in three tiers. Equip one to raise a fighter's power…
6. **…or lure a recruit.** Leave a weapon at the **Lure Post** and, after a while, a new fighter of that class wanders in to claim it.

Fighters gain XP for every encounter their party wins, and level up over time.

## Project layout

```
index.html            App shell
css/style.css         Styles (mobile-first, pixel-art friendly)
js/data.js            All game data and balance numbers
js/game.js            Pure game logic (no DOM), unit tested
js/main.js            UI rendering and input
sw.js                 Service worker for offline play / install
manifest.webmanifest  PWA manifest ("Add to Home Screen")
assets/sprites/       64×64 character sprites at native pixel resolution
assets/items/         16×16 item icons
assets/source/        Original high-res sprite art (not deployed)
tools/                Scripts used to make the art assets
tests/                Node tests for js/game.js
```

There's no build step. It's plain HTML, CSS and ES modules.

## Running locally

```bash
npm start
```

Then open http://localhost:8000. Add `?speed=60` to the URL to make all timers 60× faster while testing.

```bash
npm test
```

## Deploying to GitHub Pages

`.github/workflows/pages.yml` runs the tests and deploys the site on every push to `main`. To turn it on once, go to **Settings → Pages → Build and deployment → Source** and pick **GitHub Actions**.

## Art pipeline

- `tools/downscale_sprite.py` turns the upscaled sprite art in `assets/source/` back into true 1:1 pixel sprites. Each 7×7 block becomes one pixel, and the white background is made transparent.
  `python3 tools/downscale_sprite.py <in.png> <out.png> <grid-x-offset> <grid-y-offset>`
- `tools/make_item_icons.py` regenerates the item icons and app icons.

When you ship changes, bump `CACHE` in `sw.js` so installed copies update.
