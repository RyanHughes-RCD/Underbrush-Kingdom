"""Builds assets/sprites/sprites.json from Sprite Workshop documents, then
regenerates the PNG previews and app icons.

Usage:
  python3 tools/sync_sprites.py <dir>
where <dir> holds bodies/<id>.json, weapons/<type>.json and pieces/<id>.json
(one document each,
as the workshop's database stores them). With no <dir>, only the PNGs are
regenerated from the existing sprites.json.
"""
from PIL import Image
import json, os, sys, subprocess

CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
PAD = 8
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, 'assets/sprites/sprites.json')
FILES = {'archer': 'archer-lizard', 'knight': 'beetle-knight', 'mage': 'wizard-mouse'}
KEEP = ('name', 'w', 'h', 'palette', 'pixels', 'anchors', 'slot', 'anchor', 'pivot', 'layer', 'wornBy', 'swaps', 'variants', 'accentSwaps', 'accents', 'tints')


def validate(kind, id_, s):
    assert len(s['pixels']) == s['w'] * s['h'], f'{kind}/{id_}: pixel count does not match size'
    assert len(s['palette']) <= len(CHARS), f'{kind}/{id_}: too many colours'
    if kind == 'pieces':
        for k in ('slot', 'anchor', 'pivot'):
            assert k in s, f'{kind}/{id_}: missing {k}'
    if kind == 'bodies':
        for i in s.get('tints', []):
            assert 0 <= i < len(s['palette']), f'{kind}/{id_}: varying colour {i} not in palette'
    if kind == 'weapons':
        for k in ('anchor', 'pivot'):
            assert k in s, f'{kind}/{id_}: missing {k}'
        for i in s.get('swaps', []):
            assert 0 <= i < len(s['palette']), f'{kind}/{id_}: swap colour {i} not in palette'
        def check_accents(holder, where):
            for i in holder.get('accentSwaps', []):
                assert 0 <= i < len(holder['palette']), f'{where}: fittings colour {i} not in palette'
            for acc, a in (holder.get('accents') or {}).items():
                for i in (a.get('colors') or {}):
                    assert int(i) < len(holder['palette']), f'{where}/fittings {acc}: colour {i} not in palette'
        check_accents(s, f'{kind}/{id_}')
        for mat, v in (s.get('variants') or {}).items():
            if 'pixels' in v:
                check_accents(v, f'{kind}/{id_}/{mat}')
            if 'pixels' in v:
                assert len(v['pixels']) == v['w'] * v['h'], f'{kind}/{id_}/{mat}: pixel count does not match size'
            for i in (v.get('colors') or {}):
                assert int(i) < len(s['palette']), f'{kind}/{id_}/{mat}: colour {i} not in palette'


def load_docs(d):
    sheet = {'version': 2, 'bodies': {}, 'weapons': {}, 'pieces': {}}
    for kind in ('bodies', 'weapons', 'pieces'):
        folder = os.path.join(d, kind)
        for f in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
            if not f.endswith('.json'):
                continue
            id_ = f[:-5]
            doc = json.load(open(os.path.join(folder, f)))
            doc = {k: doc[k] for k in KEEP if k in doc}
            validate(kind, id_, doc)
            sheet[kind][id_] = doc
    for cls in FILES:
        assert cls in sheet['bodies'], f'missing body for {cls}'
    assert os.path.isdir(os.path.join(d, 'weapons')), 'no weapons/ folder: fetch the weapons collection too'
    for t in ('longbow', 'recurve', 'sword', 'mace', 'staff', 'tome'):
        assert t in sheet['weapons'], f'missing weapon design {t}'
    return sheet


def sprite_image(s):
    im = Image.new('RGBA', (s['w'], s['h']), (0, 0, 0, 0))
    pal = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in s['palette']]
    for i, ch in enumerate(s['pixels']):
        if ch != '.':
            im.putpixel((i % s['w'], i // s['w']), pal[CHARS.index(ch)] + (255,))
    return im


def composite(sheet, cls):
    """Body plus its always-worn pieces, same rules as js/sprites.js layout()."""
    body = sheet['bodies'][cls]
    worn = [p for p in sheet['pieces'].values() if cls in (p.get('wornBy') or [])]
    canvas = Image.new('RGBA', (body['w'] + PAD * 2, body['h'] + PAD * 2), (0, 0, 0, 0))
    def put(p):
        a = body.get('anchors', {}).get(p['anchor'], {'x': body['w'] // 2, 'y': body['h'] // 2})
        canvas.alpha_composite(sprite_image(p), (PAD + a['x'] - p['pivot']['x'], PAD + a['y'] - p['pivot']['y']))
    for p in worn:
        if p.get('layer') == 'back': put(p)
    canvas.alpha_composite(sprite_image(body), (PAD, PAD))
    for p in worn:
        if p.get('layer') != 'back': put(p)
    # Crop back to the body's frame so the PNG keeps its size and feet position.
    return canvas.crop((PAD, PAD, PAD + body['w'], PAD + body['h']))


def main():
    if len(sys.argv) > 1:
        sheet = load_docs(sys.argv[1])
        with open(SHEET, 'w') as f:
            json.dump(sheet, f, indent=1, sort_keys=False)
        print(f"wrote sprites.json: {len(sheet['bodies'])} bodies, {len(sheet['pieces'])} pieces")
    sheet = json.load(open(SHEET))
    for cls, name in FILES.items():
        composite(sheet, cls).save(os.path.join(ROOT, 'assets/sprites', name + '.png'))
    subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools/make_item_icons.py')], check=True)
    subprocess.run(['node', os.path.join(ROOT, 'tools/make_app_icon.mjs')], check=True)
    print('regenerated sprite PNGs and app icons')


main()
