"""Makes the 8-bit (NES-style) game sprites from the 64x64 sprites in assets/source/.

Each 2x2 block becomes one pixel and each sprite is reduced to its own small
palette (10 colours + transparency), like NES-era sprites. The beetle is mirrored so it
faces right like the others.

Run: python3 tools/make_8bit_sprites.py
"""
from PIL import Image
from collections import Counter
import os

MAX_COLORS = 10  # per sprite, plus transparency

def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

def to_8bit(src, flip=False):
    im = Image.open(src).convert('RGBA')
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = im.size
    px = im.load()
    out = Image.new('RGBA', (w // 2, h // 2), (0, 0, 0, 0))
    op = out.load()
    for y in range(h // 2):
        for x in range(w // 2):
            block = [px[x * 2 + dx, y * 2 + dy] for dy in (0, 1) for dx in (0, 1)]
            solid = [p[:3] for p in block if p[3] > 128]
            if len(solid) < 2:
                continue
            # Keep outlines: if any pixel in the block is near-black, use it.
            dark = [p for p in solid if lum(p) < 40]
            if len(dark) >= 2:
                op[x, y] = dark[0] + (255,)
            else:
                op[x, y] = Counter(solid).most_common(1)[0][0] + (255,)
    # Reduce to a small palette chosen from this sprite's own colours.
    alpha = out.getchannel('A')
    rgb = out.convert('RGB').quantize(colors=MAX_COLORS, method=Image.Quantize.MEDIANCUT, kmeans=4, dither=Image.Dither.NONE)
    out = rgb.convert('RGBA')
    out.putalpha(alpha.point(lambda a: 255 if a > 128 else 0))
    return out

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
for name, flip in (('archer-lizard', False), ('beetle-knight', True), ('wizard-mouse', False)):
    img = to_8bit(os.path.join(root, 'assets/source', f'{name}-64.png'), flip)
    img.save(os.path.join(root, 'assets/sprites', f'{name}.png'))
    print(name, img.size, len(img.getcolors()) - 1, 'colours')
