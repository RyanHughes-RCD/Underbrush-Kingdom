"""Generates the 16x16 pixel-art item icons in assets/items/ (app icons: tools/make_app_icon.mjs).

Run: python3 tools/make_item_icons.py
"""
from PIL import Image
import os

PAL = {
    '.': None,
    'k': (24, 20, 28),      # outline
    'b': (120, 78, 44),     # brown
    'B': (166, 112, 62),    # light brown
    'd': (78, 50, 30),      # dark brown
    'r': (178, 52, 40),     # red cap
    'R': (222, 92, 70),     # red highlight
    's': (150, 150, 165),   # steel
    'S': (205, 208, 220),   # steel light
    'g': (110, 110, 118),   # stone
    'G': (156, 154, 160),   # stone light
    'p': (120, 70, 190),    # gem purple
    'P': (190, 140, 240),   # gem light
    'w': (245, 245, 250),   # white
    'y': (214, 170, 60),    # gold
    'l': (90, 140, 60),     # leaf
}

ICONS = {
 'twig': [
  "................",
  "................",
  "............kk..",
  "...........kBk..",
  "..........kBk.kk",
  ".........kBk.klk",
  "....kk..kBdk.kk.",
  "...klk.kBdk.....",
  "....kkkBdk......",
  ".....kBdk.......",
  "....kBdk........",
  "...kBdk.........",
  "..kBdk..........",
  "..kdk...........",
  "...k............",
  "................"],
 'bottlecap': [
  "................",
  "................",
  "....kkkkkkkk....",
  "...kRkRkRkRkk...",
  "..kRRRRRRRRRRk..",
  "..krRRRRRRRRrk..",
  "..krrRRRRRRrrk..",
  "..krrrrrrrrrrk..",
  "..kkrkrkrkrkkk..",
  "...kkkkkkkkkk...",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................"],
 'pebble': [
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  "....kkGGGGkk....",
  "...kGGwGGGggk...",
  "..kGGGGGGGgggk..",
  "..kgGGGGGgggggk.",
  "..kggggggggggk..",
  "...kkggggggkk...",
  ".....kkkkkk.....",
  "................",
  "................",
  "................",
  "................"],
 'wood': [
  "................",
  "................",
  "................",
  "....kkkkkkkkkk..",
  "...kBBBBBBBBBkk.",
  "..kBbBBBBbBBkbk.",
  ".kkkkkkkkkkkbbk.",
  ".kBBBBBBBBBkbk..",
  ".kBbBBBdBBBkk...",
  ".kBBBBBBBbBk....",
  ".kbbbbbbbbbk....",
  ".kkkkkkkkkkk....",
  "................",
  "................",
  "................",
  "................"],
 'metal': [
  "................",
  "................",
  "................",
  "................",
  ".....kkkkkkkk...",
  "....kSSSSSSSkk..",
  "...kSwSSSSSksk..",
  "..kkkkkkkkkssk..",
  "..kSSSSSSSkssk..",
  "..ksSSSSSSksk...",
  "..kssssssskk....",
  "..kkkkkkkkk.....",
  "................",
  "................",
  "................",
  "................"],
 'gem': [
  "................",
  "................",
  "................",
  ".....kkkkkk.....",
  "....kPPwPPpk....",
  "...kPPwPPPppk...",
  "..kkkkkkkkkkkk..",
  "...kPPPPPppppk..",
  "....kPPPPpppk...",
  ".....kPPpppk....",
  "......kPppk.....",
  ".......kpk......",
  "........k.......",
  "................",
  "................",
  "................"],
 'bow': [
  "................",
  "......kkk.......",
  ".....kBBdk......",
  "......kkBdk.....",
  "......w.kBdk....",
  "......w..kBk....",
  "......w...kBk...",
  "......w...kyk...",
  "......w...kyk...",
  "......w...kBk...",
  "......w..kBk....",
  "......w.kBdk....",
  "......kkBdk.....",
  ".....kBBdk......",
  "......kkk.......",
  "................"],
 'sword': [
  "................",
  "............kk..",
  "...........kSk..",
  "..........kSsk..",
  ".........kSsk...",
  "........kSsk....",
  ".......kSsk.....",
  "..kk..kSsk......",
  "..kyk.kSk.......",
  "...kykSk........",
  "....kyk.........",
  "...kbkyk........",
  "..kbk.kyk.......",
  ".kyk...kk.......",
  "..k.............",
  "................"],
 'staff': [
  "................",
  "..........kkk...",
  ".........kPPpk..",
  "........kPwPppk.",
  "........kPPppk..",
  ".........kpdk...",
  "........kdbk....",
  ".......kdbk.....",
  "......kdbk......",
  ".....kdbk.......",
  "....kdbk........",
  "...kdbk.........",
  "..kdbk..........",
  "..kbk...........",
  "...k............",
  "................"],
}

import sys as _sys, os as _os
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from scrap_icons import SCRAP_ICONS, EXTRA_PAL
PAL.update(EXTRA_PAL)
ICONS.update(SCRAP_ICONS)

def render(rows, scale=1):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            c = PAL[ch]
            if c:
                im.putpixel((x, y), c + (255,))
    return im

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
os.makedirs(os.path.join(root, 'assets/items'), exist_ok=True)
for name, rows in ICONS.items():
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), name
    render(rows).save(os.path.join(root, 'assets/items', name + '.png'))

# Material icons: each family's base icon, tinted with the material's
# [dark, mid, light] palette from js/data.js.
import re
data_js = open(os.path.join(root, 'js/data.js')).read()
fam_base = {'metal': 'metal', 'wood': 'wood', 'crystal': 'gem'}
os.makedirs(os.path.join(root, 'assets/items/materials'), exist_ok=True)
for fam_block in re.finditer(r"(\w+): \{\s*id: '(\w+)', name: '[^']+', base: '(\w+)',\s*list: \[(.*?)\n    \],", data_js, re.S):
    base_name = fam_block.group(3)
    base = render(ICONS[base_name])
    # Rank the base icon's non-outline colours from dark to light.
    cols = sorted({base.getpixel((x, y))[:3] for x in range(16) for y in range(16)
                   if base.getpixel((x, y))[3] and base.getpixel((x, y))[:3] != PAL['k']},
                  key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])
    for mm in re.finditer(r"m\('(\w+)', '[^']+', \"?.*?\"?, \['(#\w+)', '(#\w+)', '(#\w+)'\]\)", fam_block.group(4)):
        mid_ = mm.group(1)
        pal = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in mm.groups()[1:]]
        # Map dark→dark, the middle shades→mid, lightest→light.
        mapping = {c: pal[0 if i == 0 else 2 if i == len(cols) - 1 else 1] for i, c in enumerate(cols)}
        im = base.copy()
        for x in range(16):
            for y in range(16):
                px = im.getpixel((x, y))
                if px[3] and px[:3] in mapping:
                    im.putpixel((x, y), mapping[px[:3]] + (255,))
        im.save(os.path.join(root, 'assets/items/materials', mid_ + '.png'))

# App icons are drawn by tools/make_app_icon.mjs from the sprite data.
print('ok')
