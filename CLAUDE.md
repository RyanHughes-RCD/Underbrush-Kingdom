# Underbrush Kingdom: notes for Claude

Static web game with no build step (HTML, CSS and ES modules). `npm test` runs the Node tests. GitHub Pages deploys from `main` through `.github/workflows/pages.yml`.

## Character art

- `assets/sprites/sprites.json` is the source of truth for character art. It holds `bodies` (one per class: archer, knight, mage) and `pieces` (weapons, armour). Pieces attach to a body by naming an anchor (`hand`, `offhand`, `head`, `chest`, `back`, …); a piece's `pivot` lands on that anchor. The format is described in `tools/png_to_sprites_json.py`, and the rendering is `layout()` in `js/sprites.js`.
- Weapon tiers map to piece ids: `bow-1..3`, `sword-1..3`, `staff-1..3`. A piece with `wornBy: [class]` is always drawn on that class. An equipped weapon replaces worn pieces in the same `slot`.
- `assets/sprites/*.png` are generated previews (used for tab icons and the README). Don't edit them by hand.

## Syncing from the Sprite Workshop

The user edits sprites in the Sprite Workshop artifact: https://claude.ai/artifact/SGtaz1YMDs5cTKcVrUjBFR (source: `tools/sprite-workshop.html`). Its database has collections `bodies` and `pieces` (one document per sprite, id = sprite id), plus `meta/release`, which the page writes when the user presses "Send to game".

When asked to sync the sprites:
1. Read both collections with ArtifactData `list` and `out_dir` set to one scratch folder, so you get `<dir>/bodies/*.json` and `<dir>/pieces/*.json`. Page with the cursor if `next_cursor` comes back.
2. Run `python3 tools/sync_sprites.py <dir>`. It validates the documents, writes `sprites.json`, and regenerates the PNGs and app icons.
3. Run `npm test`. Look at the regenerated PNGs, and bump `CACHE` in `sw.js`.
4. Commit and push.

To republish the workshop page, publish `tools/sprite-workshop.html` with the Artifact tool and that `url`. Omit `capabilities` so the stored ones carry over.
