"""Downscales upscaled pixel art (7px per art pixel) to native resolution with a transparent background.

Usage: python3 tools/downscale_sprite.py <in.png> <out.png> <grid-x-offset> <grid-y-offset>
"""
from PIL import Image
from collections import Counter
import sys
src,out,ox,oy=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4])
S=7
im=Image.open(src).convert('RGBA'); w,h=im.size; px=im.load()
cw=(w-ox)//S; ch=(h-oy)//S
small=Image.new('RGBA',(cw,ch)); sp=small.load()
for cy in range(ch):
    for cx in range(cw):
        c=Counter(px[ox+cx*S+dx,oy+cy*S+dy] for dx in range(1,S-1) for dy in range(1,S-1))
        r,g,b,a=c.most_common(1)[0][0]
        sp[cx,cy]=(r,g,b,255 if a>128 else 0)
# flood fill background from edges
def bg(p): return p[3]==0 or (p[0]>225 and p[1]>225 and p[2]>225)
stack=[(x,y) for x in range(cw) for y in (0,ch-1)]+[(x,y) for y in range(ch) for x in (0,cw-1)]
seen=set()
while stack:
    x,y=stack.pop()
    if (x,y) in seen or not(0<=x<cw and 0<=y<ch): continue
    seen.add((x,y))
    if not bg(sp[x,y]): continue
    sp[x,y]=(0,0,0,0)
    stack+= [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
# clear enclosed white pockets (e.g. inside the bow) larger than a few pixels
for sy in range(ch):
    for sx in range(cw):
        if (sx,sy) in seen or not bg(sp[sx,sy]) or sp[sx,sy][3]==0: continue
        comp=[];st=[(sx,sy)]
        while st:
            x,y=st.pop()
            if (x,y) in seen or not(0<=x<cw and 0<=y<ch) or not bg(sp[x,y]): continue
            seen.add((x,y)); comp.append((x,y)); st+=[(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
        if len(comp)>6:
            for p in comp: sp[p]=(0,0,0,0)
bb=small.getbbox(); small=small.crop(bb)
W,H=small.size; N=max(64,W,H)
canvas=Image.new('RGBA',(N,N),(0,0,0,0))
canvas.paste(small,((N-W)//2,N-H-1))
canvas.save(out)

print(out, (W, H), N)
