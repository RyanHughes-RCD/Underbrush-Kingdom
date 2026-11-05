# Underbrush Kingdom: notes for Claude

Static web game with no build step (HTML, CSS and ES modules). `npm test` runs the Node tests. GitHub Pages deploys from `main` through `.github/workflows/pages.yml`.

## Stats

- `STATS`, `CLASS_STATS` (base + growth per level), weapon `attack` and `scaling` in `WEAPONS`, `TIER_QUALITY` and `GRADES` all live in `js/data.js`. The formulas are in `js/stats.js`: stat = floor(base + growth × (level − 1)); quality = (2 × main + fittings) / 3; damage = quality × (attack + Σ scaling × stat); power = (damage + (MIG + SPI + LCK) / 2 + HP / 4) / 5.
- Stats are derived from class and level, so they aren't stored in saves. In each class, one weapon has the higher base attack and the other scales better; `tests/stats.test.js` checks that they cross over.

## Materials and smelting

- `js/data.js` holds `FAMILIES` (metal, wood, crystal; 10 tiers each), `SCRAPS` (each with `value` and `maxTier`), and the odds constants `SMELT_FALLOFF` and `MAX_BATCH` (3 pieces per batch). `smeltOdds()` in `js/game.js` computes the odds: the weight of tier t is exp(-(t-1)² / 2σ²), where σ = √(total value) / SMELT_FALLOFF.
- Material icons are generated into `assets/items/materials/` by `tools/make_item_icons.py`, using each material's palette in `data.js`.
- Saves are versioned; `migrate()` in `js/game.js` upgrades old ones. Bump `SAVE_VERSION` and add a migration step whenever the save shape changes.

## Character art

- `assets/sprites/sprites.json` is the source of truth for character art. It holds `bodies` (one per class), `weapons` (one design per weapon type) and `pieces` (armour and other worn gear). Weapons and pieces attach to a body by naming an anchor (`hand`, `offhand`, `head`, `chest`, `back`, …); their `pivot` lands on that anchor. The format is documented at the top of `js/sprites.js`.
- Weapon types live in `WEAPONS` in `js/data.js`, two per class (longbow/recurve, sword/mace, staff/tome), each with its own `attack` and `scaling` (see Stats). A crafted weapon is `{type, material, accent}`: 2 of a main material from `family` plus 1 fittings material from `accentFamily` (archer wood+metal, knight metal+crystal, mage crystal+wood). Quality = (2·main + fittings) / 3.
- A weapon design has `swaps` (palette indices that follow the main material), `accentSwaps` and `accents.<material>.colors` (palette indices and saved colours for the fittings), and `variants.<material>`, which is either `{colors}` (a recolour) or `{w, h, pixels, palette, pivot, accentSwaps, accents}` (its own design). A material with no variant is recoloured automatically from its palette in `data.js`; see `weaponSprite()` in `js/sprites.js`. The Sprite Workshop copies these weapon types and material palettes, so keep the two in step. A piece with `wornBy: [class]` is always drawn on that class. An equipped weapon replaces worn pieces in the same `slot`.
- `assets/sprites/*.png` are generated previews (used for tab icons and the README). Don't edit them by hand.

## Syncing from the Sprite Workshop

The user edits sprites in the Sprite Workshop artifact: https://claude.ai/artifact/SGtaz1YMDs5cTKcVrUjBFR (source: `tools/sprite-workshop.html`). Its database has collections `bodies`, `weapons` and `pieces` (one document per sprite or weapon design, id = its key in sprites.json), plus `meta/release`, which the page writes when the user presses "Send to game".

When asked to sync the sprites:
1. Read all three collections with ArtifactData `list` and `out_dir` set to one scratch folder, so you get `<dir>/bodies/`, `<dir>/weapons/` and `<dir>/pieces/`. Page with the cursor if `next_cursor` comes back.
2. Run `python3 tools/sync_sprites.py <dir>`. It validates the documents, writes `sprites.json`, and regenerates the PNGs and app icons.
3. Run `npm test`. Look at the regenerated PNGs, and bump `CACHE` in `sw.js`.
4. Commit and push.

To republish the workshop page, publish `tools/sprite-workshop.html` with the Artifact tool and that `url`. Omit `capabilities` so the stored ones carry over.
