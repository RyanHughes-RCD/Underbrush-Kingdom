"""One-off: builds assets/sprites/sprites.json from the current PNG sprites and item icons.

sprites.json is the source of truth for character art. It's edited with the
Sprite Workshop artifact and read by the game at startup.

Format (see js/sprites.js for how it's drawn):
  bodies.<class>  = {name, w, h, palette[], pixels, anchors{name: {x, y}}}
  pieces.<id>     = {name, w, h, palette[], pixels, slot, anchor, pivot{x, y},
                     layer: "front"|"back", wornBy: [classes]}
  pixels is one character per pixel, row by row: "." is transparent,
  otherwise an index into palette using 0-9a-zA-Z.
"""
from PIL import Image
import json, os

CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def encode(path):
    im = Image.open(path).convert('RGBA')
    pal, out = [], []
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = im.getpixel((x, y))
            if a < 128:
                out.append('.'); continue
            hx = '#%02x%02x%02x' % (r, g, b)
            if hx not in pal: pal.append(hx)
            out.append(CHARS[pal.index(hx)])
    return {'w': im.width, 'h': im.height, 'palette': pal, 'pixels': ''.join(out)}

bodies = {
    'archer': ('Archer Lizard', 'archer-lizard', {'hand': (27, 18), 'offhand': (12, 18), 'head': (17, 5), 'chest': (16, 16), 'back': (11, 14)}),
    'knight': ('Beetle Knight', 'beetle-knight', {'hand': (25, 23), 'offhand': (21, 25), 'head': (19, 15), 'chest': (17, 20), 'back': (10, 15)}),
    'mage':   ('Wizard Mouse',  'wizard-mouse',  {'hand': (17, 24), 'offhand': (20, 20), 'head': (14, 7), 'chest': (14, 18), 'back': (10, 18)}),
}
weapons = {'bow': ((11, 8), 'Bow'), 'sword': ((4, 12), 'Sword'), 'staff': ((7, 10), 'Staff')}
groups = ['1-3', '4-6', '7-10']

data = {'version': 1, 'bodies': {}, 'pieces': {}}
for cls, (name, file, anchors) in bodies.items():
    b = encode(os.path.join(root, 'assets/sprites', file + '.png'))
    b = {'name': name, **b, 'anchors': {k: {'x': x, 'y': y} for k, (x, y) in anchors.items()}}
    data['bodies'][cls] = b
for wid, (pivot, wname) in weapons.items():
    art = encode(os.path.join(root, 'assets/items', wid + '.png'))
    for t, rng in enumerate(groups, 1):
        data['pieces'][f'{wid}-{t}'] = {
            'name': f'{wname} (tiers {rng})', **art, 'slot': 'weapon', 'anchor': 'hand',
            'pivot': {'x': pivot[0], 'y': pivot[1]}, 'layer': 'front', 'wornBy': [],
        }
with open(os.path.join(root, 'assets/sprites/sprites.json'), 'w') as f:
    json.dump(data, f, indent=1)
print('pieces', list(data['pieces']), 'bytes', os.path.getsize(os.path.join(root, 'assets/sprites/sprites.json')))
