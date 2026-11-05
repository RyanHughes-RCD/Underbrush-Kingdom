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

     | Region | Difficulty | Mostly finds | Extra finds per win | XP per win |
     |---|---|---|---|---|
     | Windy Meadow | 1 | A bit of everything | — | 1 |
     | Tangled Thicket | 2 | Twigs | +1 | 1 |
     | Glimmer Creek | 3 | Pebbles | +2 | 2 |
     | Old Gutter Drain | 4 | Bottle caps | +3 | 3 |
3. **Duration = encounters.** Choose 1–12 encounters, 10 minutes each (6 encounters = 1 hour). Results are revealed one encounter at a time. Later encounters are harder but give more. You can recall a party early and keep what they've already found.
4. **Workshops.** Put scrap into a workshop to smelt it into one material. Each family has 10 tiers:
   - Woodworker's Cabin: twigs → **woods** (Pine, Oak, Ashwood … Godwood)
   - The Forge: bottle caps → **metals** (Iron, Copper, Bronze … Godsbane)
   - Enchanter's Hut: pebbles → **crystals** (Quartz, Amethyst, Garnet … Prismheart)

   A batch holds up to 3 pieces of scrap. Each scrap has a **value**, and the batch's total value sets the odds. Tier 1 is always the likeliest, and more value makes rarer tiers likelier. Each scrap also has a highest tier it can ever reach; bottle caps, twigs and pebbles top out at tier 4. With 3 bottle caps the odds are about 50% Iron, 35% Copper, 12% Bronze and 2% Steel. The workshop shows the odds before you commit, and the result is revealed when the batch finishes. Materials you haven't found yet show as "?".
5. **Craft weapons.** Each class has two weapon types: Archer Lizards use the **Longbow** or **Recurve Bow**, Beetle Knights the **Sword** or **Mace**, and Wizard Mice the **Staff** or **Tome**. Each weapon is made of two materials, a **main material** (2 needed) and **fittings** (1 needed) from a second family:

   | Class | Main material | Fittings | Example |
   |---|---|---|---|
   | Archer Lizard | Wood | Metal | Iron-bound Oak Longbow |
   | Beetle Knight | Metal | Crystal | Garnet-set Steel Mace |
   | Wizard Mouse | Crystal | Wood | Oak-handled Amethyst Tome |

   You need two workshops' output for every weapon. Its attack and scaling come from the weapon type and both materials (see Stats below). Equip one to raise a fighter's power…
6. **…or lure a recruit.** Leave a weapon at the **Lure Post** and, after a while, a new fighter of that class wanders in to claim it.

Fighters gain XP for every encounter their party wins, and level up over time.

### Stats

Every fighter has **HP**, three offensive stats (**Strength**, **Dexterity**, **Intelligence**) and three defensive stats (**Might**, **Spirit**, **Luck**). They're set by class and grow each level: archers lean on Dexterity and Luck, knights on Strength, Might and HP, and mice on Intelligence and Spirit.

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

At the top of the Camp tab, any fighter not away on an expedition wanders a grassy clearing ringed by trees. They squish and stretch as they go. Tap one to open their details. The trees and grass are drawn in code, so there are no image files for them.

## Project layout

```
index.html            App shell
css/style.css         Styles (mobile-first, pixel-art friendly)
js/data.js            All game data and balance numbers
js/game.js            Pure game logic (no DOM), unit tested
js/main.js            UI rendering and input
js/scene.js           Camp scene: forest clearing where idle fighters wander
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
- **Gear pieces** (armour, hats) and weapons say which anchor they attach to and which pixel is their **pivot**. The game draws each one so its pivot sits on the anchor, in front of or behind the body. Tick **Always worn by** to make a piece part of a class's default look, such as the beetle's armour. An equipped weapon replaces an always-worn piece in the weapon slot.
- When you're happy with the art, press **Send to game**, then ask Claude to sync the sprites. You can also download `sprites.json` from the workshop and replace `assets/sprites/sprites.json` yourself.

## Art pipeline

- `tools/downscale_sprite.py` turns the upscaled sprite art in `assets/source/` back into true 1:1, 64×64 pixel sprites. Each 7×7 block becomes one pixel, and the white background is made transparent.
  `python3 tools/downscale_sprite.py <in.png> <out.png> <grid-x-offset> <grid-y-offset>`
- `tools/make_8bit_sprites.py` makes the 32×32 8-bit game sprites from the 64×64 versions. It halves the resolution, cuts each sprite to a 10-colour palette, and mirrors the beetle so all three face right.
- `tools/sync_sprites.py` builds `sprites.json` from the workshop's saved data and regenerates the PNG previews and app icons.
- `tools/make_item_icons.py` regenerates the item icons and app icons.

When you ship changes, bump `CACHE` in `sw.js` so installed copies update.
