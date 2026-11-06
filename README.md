# Underbrush Kingdom

A phone-first web game about a band of tiny heroes living in the underbrush. Collect **Archer Lizards**, **Beetle Knights** and **Wizard Mice**, send them on expeditions, and turn the junk they bring home into weapons.

<p>
  <img src="assets/sprites/archer-lizard.png" width="128" alt="Archer Lizard">
  <img src="assets/sprites/beetle-knight.png" width="128" alt="Beetle Knight">
  <img src="assets/sprites/wizard-mouse.png" width="128" alt="Wizard Mouse">
</p>

## How it plays

1. **Start small.** You begin with three fighters: one of each class.
2. **Expeditions.** Every expedition is a **party**, a **type**, a **duration** and a **region**.
   - The **type** decides which skills are in demand (fighters of that class count for more):

     | Type | In demand |
     |---|---|
     | Scouting | Archer Lizards |
     | Skirmish | Beetle Knights |
     | Field Research | Wizard Mice |
     | Excursion | A mixed party |
   - The **region** decides how hard it is and how much you bring back. Harder regions find more scrap per win and give more XP:

     | Region | Difficulty | Mostly finds | Rarest scrap | Uncommon or better | Extra finds per win | XP per win |
     |---|---|---|---|---|---|---|
     | Windy Meadow | 1 | A bit of everything | Rare | 20% | — | 1 |
     | Tangled Thicket | 2 | Wood | Epic | 40% | +1 | 1 |
     | Glimmer Creek | 3 | Crystal | Legendary | 58% | +2 | 2 |
     | Old Gutter Drain | 4 | Metal | Divine | 72% | +3 | 3 |
3. **Duration = encounters.** Choose 1–12 encounters, 10 minutes each (6 encounters = 1 hour). Results are revealed one encounter at a time. Later encounters are harder but give more. You can recall a party early and keep what they've already found.
4. **Scrap and workshops.** Expeditions bring home scrap in seven rarities per family:

   | Rarity | Metal | Wood | Crystal | Value | Best tier |
   |---|---|---|---|---|---|
   | Common | Bottle Cap | Stray Twig | Broken Glass | 1 | 4 |
   | Uncommon | Screw | Acorn Cap | Sea Glass | 2 | 5 |
   | Rare | Old Key | Birch Bark | Quartz Fragment | 3 | 6 |
   | Epic | Clockwork Gear | Carved Wooden Bead | Polished Gemstone | 4 | 7 |
   | Legendary | Silver Charm | Ancient Root | Opal Shard | 5 | 8 |
   | Mythic | Meteorite Fragment | Moonwood Branch | Meteoric Crystal | 6 | 9 |
   | Divine | Ancient Crown Fragment | Worldtree Fragment | Starheart Fragment | 7 | 10 |

   Put up to 3 pieces of a family's scrap (mixed freely) into its workshop to smelt one material: the Woodworker's Cabin makes **woods** (Pine … Godwood), the Forge **metals** (Iron … Godsbane), the Enchanter's Hut **crystals** (Quartz … Prismheart). The batch's average value moves the likeliest tier up, and its best piece sets the highest tier it can reach. A full batch of each rarity centres on roughly: Common tier 1 (3 bottle caps: ~50% Iron, 35% Copper, 12% Bronze, 2% Steel), Uncommon 2, Rare 3–4, Epic 5, Legendary 6, Mythic 7, Divine 8–9 (16% tier 10). The workshop shows the odds before you commit; the result is revealed when the batch finishes; materials you haven't found yet show as "?".
5. **Craft weapons.** Each class has two weapon types: Archer Lizards use the **Longbow** or **Recurve Bow**, Beetle Knights the **Sword** or **Mace**, and Wizard Mice the **Staff** or **Tome**. Each weapon is made of two materials, a **main material** (2 needed) and **fittings** (1 needed) from a second family:

   | Class | Main material | Fittings | Example |
   |---|---|---|---|
   | Archer Lizard | Wood | Metal | Iron-bound Oak Longbow |
   | Beetle Knight | Metal | Crystal | Garnet-set Steel Mace |
   | Wizard Mouse | Crystal | Wood | Oak-handled Amethyst Tome |

   You need two workshops' output for every weapon. Its attack and scaling come from the weapon type and both materials (see Stats below). Equip one to raise a fighter's power…
6. **…or lure a recruit.** Leave a weapon at the **Lure Post** and, after a while, a new fighter of that class wanders in to claim it.

Fighters gain XP for every encounter their party wins, and level up over time.

### Rarity and perks

Every creature rolls a **rarity** and random **perks** that help it and its party in battle (expedition encounters). Minor perks cost 1 point and mid perks 2:

| Rarity | Points | Perk sets |
|---|---|---|
| Common | 1 | 1 minor |
| Uncommon | 2 | 2 minors (60%) or 1 mid (40%) |
| Rare | 3 | 3 minors (40%) or 1 mid + 1 minor (60%) |
| Epic | 4 | 4 minors (30%), 1 mid + 2 minors (35%) or 2 mids (35%) |

Starters are Common. Recruits from the Lure Post roll a rarity based on the quality of the weapon left there: a basic weapon gives about 57% Common and 3% Epic, a top-tier one about 14% Common and 29% Epic. Perks that suit a class are three times as likely to roll for it. The full perk list is `PERKS` in `js/data.js`.

### Stats

Every fighter has **HP**, three offensive stats (**Strength**, **Dexterity**, **Intelligence**) and three defensive stats (**Might**, **Spirit**, **Luck**). Each class has its own leanings: archers favour Dexterity and Luck, knights Strength, Might and HP, and mice Intelligence and Spirit.

**No two creatures are alike.** Every creature that joins, starters included, rolls its own multipliers on its class's numbers: up to ±20% on each starting stat and ±25% on how fast each stat grows per level. A fighter's sheet marks stats that started above (▲) or below (▼) their class average, and shows fast growers in bold green. Each creature also gets its own colouring: the body colours marked "varies per creature" in the Sprite Workshop are shifted in hue and lightly in saturation and brightness. About a third keep close to their class's usual colours.

Weapons have a base **attack** and **scaling** grades (S to E) for the stats they draw on:

| Class | Weapon | Base attack | Scales with | Character |
|---|---|---|---|---|
| Archer Lizard | Longbow | 7 | DEX, STR | Strong from the start |
| Archer Lizard | Recurve Bow | 5 | DEX, LCK | Catches up by level 5 |
| Beetle Knight | Sword | 9 | STR, DEX | Strong from the start |
| Beetle Knight | Mace | 6 | STR, MIG | Overtakes by level 3–4 |
| Wizard Mouse | Staff | 7 | INT, SPI | Strong from the start |
| Wizard Mouse | Tome | 5 | INT, SPI (heavily) | Catches up by level 5 |

Each material has a **quality**, from ×1.0 at tier 1 to ×3.5 at tier 10. A weapon's quality is (2 × main + fittings) ÷ 3, and it multiplies both attack and scaling. Damage = quality × (attack + Σ scaling × the wielder's stat), so the same weapon hits harder as its fighter levels up. A fighter's **power** on expeditions combines damage, defensive stats and HP. All the numbers live in `js/data.js`, and the formulas are in `js/stats.js`.

At the top of the Camp tab, any fighter not away on an expedition wanders a castle courtyard around a flickering campfire. The courtyard has battlemented walls, corner towers, a portcullis gate between needle-emblem banners, wall torches, hedge planters and a flagstone floor. The clearing follows your local time through **dawn**, **day**, **dusk** and **night**: warm pink light at dawn, golden then purple light at dusk, and at night a deep blue darkness lit by the campfire, with fireflies. A label in the corner shows the time of day. To test it, add `?hour=21` to the address to set the hour, or `?daylength=60` to run a whole day in 60 seconds. They squish and stretch as they go. Tap one to open their details. The courtyard is drawn in code (`js/courtyard.js`), so there are no image files for it.

## Project layout

```
index.html            App shell
css/style.css         Styles (mobile-first, pixel-art friendly)
js/data.js            All game data and balance numbers
js/game.js            Pure game logic (no DOM), unit tested
js/main.js            UI rendering and input
js/scene.js           Camp scene: idle fighters wander the courtyard around the campfire
js/courtyard.js       Draws the castle courtyard (walls, gate, banners, torches, floor)
js/daylight.js        Day-night lighting by local time
js/sprites.js         Draws fighters: body + gear pieces joined at anchor points
sw.js                 Service worker for offline play / install
manifest.webmanifest  PWA manifest ("Add to Home Screen")
assets/sprites/       sprites.json (all character art) + generated PNG previews
assets/items/         16×16 item icons
assets/source/        Original art: high-res and 64×64 16-bit versions (not deployed)
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

## Sprite Workshop

Character art is edited in the **[Sprite Workshop](https://claude.ai/artifact/SGtaz1YMDs5cTKcVrUjBFR)**, a pixel editor that saves to shared storage. Its source is `tools/sprite-workshop.html`.

- **Bodies** (one per class) have named **anchor points**: `hand`, `offhand`, `head`, `chest`, `back`, or any name you add.
- **Weapons** have one design per type (six in all). A design is a shared shape whose palette colours are each **fixed**, follow the **main material** (round dot) or follow the **fittings** (square dot). Pick any main material and fittings to see and edit that combination. Fittings colours you set are saved per fittings material. Each main material is one of:
  - **automatic:** the shared shape, recoloured from the material's palette.
  - **colours:** the shared shape with colours you picked for that material, like the Pine, Oak and Ashwood Longbows.
  - **design:** the material has its own drawing, for tiers that need more than a palette swap.

  Drawing on a material that uses the shared shape changes the shape for every material that doesn't have its own design.
- **Props** are animated scenery, starting with the **campfire**. A prop has several frames that share one palette. You can step through them (`,` and `.`), duplicate, reorder or delete frames, turn on onion skin to see the previous frame faintly, and set the speed and size in camp. A prop can also have an **overlay**: a still layer drawn on top of every frame, like the sewing needle plunged into the campfire. Edit it on the Overlay tab. The fitting room plays the animation with the overlay on top.
- **Gear pieces** (armour, hats) and weapons say which anchor they attach to and which pixel is their **pivot**. The game draws each one so its pivot sits on the anchor, in front of or behind the body. Tick **Always worn by** to make a piece part of a class's default look, such as the beetle's armour. An equipped weapon replaces an always-worn piece in the weapon slot.
- When you're happy with the art, press **Send to game**, then ask Claude to sync the sprites. You can also download `sprites.json` from the workshop and replace `assets/sprites/sprites.json` yourself.

## Art pipeline

- `tools/downscale_sprite.py` turns the upscaled sprite art in `assets/source/` back into true 1:1, 64×64 pixel sprites. Each 7×7 block becomes one pixel, and the white background is made transparent.
  `python3 tools/downscale_sprite.py <in.png> <out.png> <grid-x-offset> <grid-y-offset>`
- `tools/make_8bit_sprites.py` makes the 32×32 8-bit game sprites from the 64×64 versions. It halves the resolution, cuts each sprite to a 10-colour palette, and mirrors the beetle so all three face right.
- `tools/sync_sprites.py` builds `sprites.json` from the workshop's saved data and regenerates the PNG previews and app icons.
- `tools/make_app_icon.mjs` draws the app icons (home screen, maskable, Apple touch icon and favicon) from the sprite data: a portrait headshot of the Wizard Mouse against a full moon. Change `CROP` in the script to reframe it. `tools/sync_sprites.py` runs it, so the icon follows your art.
- `tools/make_item_icons.py` regenerates the item and scrap icons.

When you ship changes, bump `CACHE` in `sw.js` so installed copies update.
