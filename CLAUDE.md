# Underbrush Kingdom: notes for Claude

Static web game with no build step (HTML, CSS and ES modules). `npm test` runs the Node tests. GitHub Pages deploys from `main` through `.github/workflows/pages.yml`.

## Expeditions

- An expedition is a party, a type (`EXPEDITION_TYPES` in `js/data.js`: scouting, skirmish, research, excursion; each has its own encounter list with a `demand` class) and a region (`REGIONS`: meadow, thicket, creek, gutter, easiest first; each sets `baseDifficulty`, `bonusFinds`, `xpPerWin`, `loot` family weights and `rarity` weights), plus a number of encounters (10 minutes each).
- Encounter difficulty = region base + 1.5 × index. Odds and rewards are in `previewExpedition()` / `startExpedition()` in `js/game.js`. Saved expeditions store `type` and `region`.

## Stats

- `STATS`, `CLASS_STATS` (base + growth per level), weapon `attack` and `scaling` in `WEAPONS`, `TIER_QUALITY` and `GRADES` all live in `js/data.js`. The formulas are in `js/stats.js`: stat = floor(base + growth × (level − 1)); quality = (2 × main + fittings) / 3; damage = quality × (attack + Σ scaling × stat); power = (damage + (MIG + SPI + LCK) / 2 + HP / 4) / 5.
- Each creature has `traits` (rolled in `rollTraits()` in `js/game.js` when it's created): `base` and `growth` multipliers per stat (±20% / ±25%, see `rollStatTraits()` in `js/stats.js`) and a `tint` {h, s, l} for its colouring. Stats are derived from class, level and traits: stat = floor(base × baseMult + growth × growthMult × (level − 1)). Bodies list the palette indices that a tint recolours in `tints` (see `tintPalette()` in `js/sprites.js`).
- Stats themselves aren't stored in saves, only the traits. In each class, one weapon has the higher base attack and the other scales better; `tests/stats.test.js` checks that they cross over.

## Rarity and perks

- `RARITIES`, `RARITY_WEIGHTS` and `PERKS` live in `js/data.js`; rolling and combining them is in `js/perks.js`. Creatures store `traits.rarity` and `traits.perks` (perk ids). A minor perk costs 1 point and a mid perk 2; a rarity's `sets` must each add up to its `points` (tested).
- A perk has `self` (stat or `xp` bonuses for the creature), `allies` (the same for the rest of its party) and/or `party` (`win`, `demand.<cls>`, `finds`). Self bonuses are part of `creatureStats()`; ally and party effects apply only on expeditions via `partyPerks()` in `js/game.js`.

## Materials and smelting

- `js/data.js` holds `FAMILIES` (metal, wood, crystal; 10 material tiers each), `SCRAP_RARITIES` (common … divine: `value` 1-7, `maxTier` 4-10) and `SCRAPS` (7 per family, built from `SCRAP_LIST`; `scrapAt(family, rarity)` and `scrapsOf(family)` look them up), and the odds constants `SMELT_FALLOFF`, `SMELT_SHIFT` and `MAX_BATCH` (3 pieces per batch).
- A smelting batch is `{scrapId: count}` (one family, mixed). `smeltOdds()` in `js/game.js`: the weight of tier t (up to the batch's best maxTier) is exp(-((t-1) - centre)² / 2σ²), with centre = (average value − 1) × SMELT_SHIFT and σ = √pieces / SMELT_FALLOFF. Jobs store `inputs`.
- Regions roll each scrap's family from `loot` and its rarity from `rarity` weights.
- Material icons are generated into `assets/items/materials/` by `tools/make_item_icons.py`, using each material's palette in `data.js`. Scrap icons are pixel maps in `tools/scrap_icons.py` (common scrap and weapon icons are in `make_item_icons.py`).
- Saves are versioned; `migrate()` in `js/game.js` upgrades old ones. Bump `SAVE_VERSION` and add a migration step whenever the save shape changes.

## Character art

- `assets/sprites/sprites.json` is the source of truth for character art. It holds `bodies` (one per class), `weapons` (one design per weapon type), `pieces` (armour and other worn gear) and `props` (animated scenery: `{w, h, palette, frames: [pixels…], fps, sceneScale, overlay}`, all frames sharing one palette and size; the optional `overlay` is a still layer drawn on top of every frame, e.g. the needle plunged into the campfire). Weapons and pieces attach to a body by naming an anchor (`hand`, `offhand`, `head`, `chest`, `back`, …); their `pivot` lands on that anchor. The format is documented at the top of `js/sprites.js`.
- Weapon types live in `WEAPONS` in `js/data.js`, two per class (longbow/recurve, sword/mace, staff/tome), each with its own `attack` and `scaling` (see Stats). A crafted weapon is `{type, material, accent}`: 2 of a main material from `family` plus 1 fittings material from `accentFamily` (archer wood+metal, knight metal+crystal, mage crystal+wood). Quality = (2·main + fittings) / 3.
- A weapon design has `swaps` (palette indices that follow the main material), `accentSwaps` and `accents.<material>.colors` (palette indices and saved colours for the fittings), and `variants.<material>`, which is either `{colors}` (a recolour) or `{w, h, pixels, palette, pivot, accentSwaps, accents}` (its own design). A material with no variant is recoloured automatically from its palette in `data.js`; see `weaponSprite()` in `js/sprites.js`. The Sprite Workshop copies these weapon types and material palettes, so keep the two in step. A piece with `wornBy: [class]` is always drawn on that class. An equipped weapon replaces worn pieces in the same `slot`.
- The camp is a castle courtyard drawn procedurally by `buildCourtyard()` in `js/courtyard.js`: background (walls, towers, gate, banners, floor), a `front` wall layer drawn over everything, depth-sorted `objects` (hedge planters), wall `torches` (animated, lit at night) and the `walk` ellipse fighters wander.
- The camp scene (`js/scene.js`) draws the `campfire` prop in the middle of the courtyard, animated at its `fps`, with a flickering glow; fighters pick spots and paths that keep clear of it. `sceneScale` 0.5 draws each prop pixel at half a camp pixel.
- Day and night: `js/daylight.js` holds the lighting keyframes (`KEYS`: a multiply `tint`, campfire light strength and firefly count per hour) and `PHASES` (dawn 4:30-7:30, day to 4:30 pm, dusk to 8:15 pm, night). The scene multiplies the tint over everything, then adds the fire's light and fireflies. `?hour=` and `?daylength=` override the clock for testing.
- `assets/sprites/*.png` are generated previews (used for tab icons and the README). Don't edit them by hand.
- App icons in `assets/icons/` are drawn by `tools/make_app_icon.mjs` (run by `sync_sprites.py`); the manifest lists both `any` and `maskable` icons.

## Syncing from the Sprite Workshop

The user edits sprites in the Sprite Workshop artifact: https://claude.ai/artifact/SGtaz1YMDs5cTKcVrUjBFR (source: `tools/sprite-workshop.html`). Its database has collections `bodies`, `weapons`, `pieces` and `props` (one document per sprite or weapon design, id = its key in sprites.json), plus `meta/release`, which the page writes when the user presses "Send to game".

When asked to sync the sprites:
1. Read all four collections with ArtifactData `list` and `out_dir` set to one scratch folder, so you get `<dir>/bodies/`, `<dir>/weapons/`, `<dir>/pieces/` and `<dir>/props/`. Page with the cursor if `next_cursor` comes back.
2. Run `python3 tools/sync_sprites.py <dir>`. It validates the documents, writes `sprites.json`, and regenerates the PNGs and app icons.
3. Run `npm test`. Look at the regenerated PNGs, and bump `CACHE` in `sw.js`.
4. Commit and push.

To republish the workshop page, publish `tools/sprite-workshop.html` with the Artifact tool and that `url`. Omit `capabilities` so the stored ones carry over.
