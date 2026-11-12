#!/usr/bin/env python3
"""Build official-pose 32x32 atlas + coverage from TSR sheets and Bandai DMC/PenC dumps."""
from __future__ import annotations

import json, re, sys, math, os, urllib.request
from collections import defaultdict, Counter
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path("/workspace/digivice")
TSR = ROOT / "ref/tsr"
CACHE = Path("/tmp/pass7")
CACHE.mkdir(parents=True, exist_ok=True)
TERO_DIR = CACHE / "tero"
TERO_DIR.mkdir(exist_ok=True)
OUT_FRAMES = CACHE / "frames"
OUT_FRAMES.mkdir(exist_ok=True)

# Extended alphabet (JS single-quoted string safe: no ' or \)
DIGITS = (
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "!#$%&*+,-./:;=?@^_`|~"
    "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ"
)
MAX_PAL = len(DIGITS)  # includes transparent slot 0

AB_SLOTS = ["idle0","idle1","eat0","eat1","sleep0","sleep1","refuse","happy","angry","hurt0","hurt1","attack"]
DMC_SLOTS = ["idle0","idle1","happy","angry","train0","train1","attack0","attack","eat0","eat1","refuse","sleep0","sleep1","sick","hurt"]
PENC_SLOTS = ["idle0","idle1","eat0","eat1","sleep0","sleep1","refuse","happy","angry","sick","hurt","attack"]

# Our keys used in game
GAME_KEYS = ["idle0","idle1","eat0","eat1","happy","angry","refuse","sleep0","sleep1","attack","hurt","hurt0","hurt1"]
# aliases written into atlas for compatibility
ALIASES = {"eat":"eat1","sleep":"sleep0","hurt":"hurt1"}

ALIAS_NORM = {
    "vegimon":"vegiemon",
    "skullmammon":"skullmammothmon",
    "centalmon":"centarumon",
    "piyomon":"biyomon",
    "darktyranomon":"darktyrannomon",
    "tyranomon":"tyrannomon",
    "cyclomon":"cyclonemon",
    "metaltyranomon":"metaltyrannomon",
    "mugendramon":"machinedramon",
    "metalgreymon_va":"metalgreymonvirus",
    "omegamon_alters":"omnimonalters",
    "omegamon":"omnimon",
    "yukidarumon":"frigimon",
    "scumon":"sukamon",
    "piccolomon":"piximon",
    "nanomon":"datamon",
    "extyranomon":"extyrannomon",
    "cockatrimon":"kokatorimon",
    "orgemon":"ogremon",
    "whamon":"whamon",
    "lasttyranomon":"rusttyranomon",
    "baohackmon":"baohuckmon",
    "hackmon":"huckmon",
}

def norm(s: str) -> str:
    s = s.lower().replace("grey", "gray")
    s = re.sub(r"[^a-z0-9]+", "", s)
    s = s.replace("gray", "grey")
    return s

def to32(im16: Image.Image) -> Image.Image:
    return im16.resize((32, 32), Image.Resampling.NEAREST)

def down_scale(im: Image.Image, factor: int) -> Image.Image:
    w, h = im.size
    assert w % factor == 0 and h % factor == 0
    out = Image.new("RGBA", (w // factor, h // factor), (0, 0, 0, 0))
    p, q = im.load(), out.load()
    nw, nh = out.size
    for y in range(nh):
        for x in range(nw):
            q[x, y] = p[x * factor, y * factor]
    return out

def is_transparent(c) -> bool:
    if len(c) == 4 and c[3] < 128:
        return True
    # chroma keys used in dumps
    if c[0] == 0 and c[1] >= 250 and c[2] == 0:
        return True
    if c[0] >= 250 and c[1] == 0 and c[2] >= 250:
        return True
    return False

def knock_bg_flood(im: Image.Image, bg_pred) -> Image.Image:
    """Flood from corners only; do not eat interior dark pixels."""
    im = im.convert("RGBA")
    w, h = im.size
    p = im.load()
    seen = [[False] * w for _ in range(h)]
    stack = []
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if bg_pred(p[x, y]):
            stack.append((x, y))
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        if not bg_pred(p[x, y]):
            continue
        seen[y][x] = True
        p[x, y] = (0, 0, 0, 0)
        stack.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    return im

def cell_empty(im: Image.Image, ink_min=24) -> bool:
    p = im.convert("RGBA").load()
    w, h = im.size
    n = 0
    for y in range(h):
        for x in range(w):
            c = p[x, y]
            if is_transparent(c):
                continue
            if c[0] <= 10 and c[1] <= 10 and c[2] <= 10:
                continue
            n += 1
    return n < ink_min

def ink_mask(im: Image.Image, treat_black_bg=False) -> set:
    p = im.convert("RGBA").load()
    w, h = im.size
    s = set()
    for y in range(h):
        for x in range(w):
            c = p[x, y]
            if is_transparent(c):
                continue
            if treat_black_bg and c[0] <= 10 and c[1] <= 10 and c[2] <= 10:
                continue
            s.add((x, y))
    return s

def mask_iou(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)

def rgba_copy(im: Image.Image) -> Image.Image:
    return im.convert("RGBA")

# ---------------- tero0x official DMC/PenC ----------------
def load_tero_index():
    p = Path("/tmp/posehunt/sprites.json")
    return json.loads(p.read_text())

def download(url: str, dest: Path):
    if dest.exists() and dest.stat().st_size > 50:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "DigiviceResearch/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        dest.write_bytes(r.read())
    return dest

def tero_to_32(png: Path) -> Image.Image:
    im = Image.open(png).convert("RGBA")
    # transparent green
    p = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            c = p[x, y]
            if c[3] < 128 or (c[0] == 0 and c[1] >= 250 and c[2] == 0):
                p[x, y] = (0, 0, 0, 0)
    if (w, h) == (48, 48):
        return to32(down_scale(im, 3))
    if (w, h) == (16, 16):
        return to32(im)
    if (w, h) == (32, 32):
        return im
    # unexpected; try integer factors
    for f in (2, 3, 4):
        if w % f == 0 and h % f == 0 and w // f <= 16:
            return to32(down_scale(im, f))
    raise ValueError(f"unexpected tero size {w}x{h} {png}")

# ---------------- colorize mono official ink with idle palette ----------------
def classify_palette(idle: Image.Image):
    p = idle.load()
    w, h = idle.size
    colors = []
    counts = Counter()
    for y in range(h):
        for x in range(w):
            c = p[x, y]
            if c[3] < 128:
                continue
            rgb = c[:3]
            counts[rgb] += 1
            colors.append(rgb)
    if not counts:
        return {"outline": (10, 10, 10), "deep": (40, 30, 20), "base": (180, 140, 80), "hi": (230, 210, 160), "eye": (20, 20, 20)}
    def luma(c):
        return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    def sat(c):
        mx, mn = max(c), min(c)
        return 0 if mx == 0 else (mx - mn) / mx
    uniq = list(counts)
    uniq.sort(key=luma)
    outline = uniq[0]
    # eye: very dark but not the most used outline, or high-contrast small
    eye = outline
    darks = [c for c in uniq if luma(c) < 50]
    if len(darks) > 1:
        eye = darks[1] if counts[darks[1]] < counts[outline] else darks[0]
    chromas = [c for c in uniq if sat(c) >= 0.25 and luma(c) > 30]
    chromas.sort(key=luma)
    if len(chromas) >= 3:
        deep, base, hi = chromas[0], chromas[len(chromas)//2], chromas[-1]
    elif len(chromas) == 2:
        deep, base, hi = chromas[0], chromas[1], chromas[1]
    elif len(chromas) == 1:
        deep, base, hi = chromas[0], chromas[0], chromas[0]
    else:
        mids = [c for c in uniq if luma(c) > 40]
        deep = mids[0] if mids else uniq[min(1, len(uniq)-1)]
        base = mids[len(mids)//2] if mids else deep
        hi = mids[-1] if mids else base
    return {"outline": outline, "deep": deep, "base": base, "hi": hi, "eye": eye}

def neighbors4(x, y, w, h):
    for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
        if 0 <= nx < w and 0 <= ny < h:
            yield nx, ny

def colorize_mono_pose(mono32: Image.Image, idle32: Image.Image) -> Image.Image:
    """Keep official ink arrangement; paint with idle's official-style palette."""
    pal = classify_palette(idle32)
    src = mono32.convert("RGBA")
    w, h = src.size
    p = src.load()
    # ink = nontransparent dark-ish or any opaque if already mono
    ink = [[False]*w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            c = p[x, y]
            if c[3] < 128:
                continue
            # mono sources are typically black ink; color artbook shouldn't go through here
            ink[y][x] = True
    # enclosed holes (transparent or near-white, not reaching border)
    hole = [[False]*w for _ in range(h)]
    visited = [[False]*w for _ in range(h)]
    # flood exterior transparency
    ext = [[False]*w for _ in range(h)]
    st = []
    for x in range(w):
        for y in (0, h-1):
            c = p[x, y]
            if c[3] < 128 or not ink[y][x]:
                st.append((x, y))
    for y in range(h):
        for x in (0, w-1):
            c = p[x, y]
            if c[3] < 128 or not ink[y][x]:
                st.append((x, y))
    while st:
        x, y = st.pop()
        if x<0 or y<0 or x>=w or y>=h or ext[y][x] or ink[y][x]:
            continue
        ext[y][x] = True
        st.extend(neighbors4(x,y,w,h))
    for y in range(h):
        for x in range(w):
            if not ink[y][x] and not ext[y][x]:
                hole[y][x] = True
    # outline = ink with a transparent or exterior neighbor
    outline = [[False]*w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if not ink[y][x]:
                continue
            for nx, ny in neighbors4(x,y,w,h):
                if not ink[ny][nx] and not hole[ny][nx]:
                    outline[y][x] = True
                    break
            else:
                # border pixels
                if x==0 or y==0 or x==w-1 or y==h-1:
                    outline[y][x] = True
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    q = out.load()
    # hole components for highlight
    seen = [[False]*w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if not hole[y][x] or seen[y][x]:
                continue
            comp = []
            st = [(x,y)]
            seen[y][x] = True
            while st:
                cx, cy = st.pop()
                comp.append((cx,cy))
                for nx,ny in neighbors4(cx,cy,w,h):
                    if hole[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        st.append((nx,ny))
            comps.append(comp)
    hi_set = set()
    eye_set = set()
    for comp in comps:
        ys = [c[1] for c in comp]
        y0, y1 = min(ys), max(ys)
        if len(comp) <= 8 and y0 < h * 0.55:
            for pt in comp:
                eye_set.add(pt)
            continue
        cut = y0 + max(1, int((y1 - y0 + 1) * 0.28))
        for pt in comp:
            if pt[1] <= cut:
                hi_set.add(pt)
    for y in range(h):
        for x in range(w):
            if outline[y][x]:
                q[x,y] = pal["outline"] + (255,)
            elif ink[y][x]:
                q[x,y] = pal["deep"] + (255,)
            elif (x,y) in eye_set:
                q[x,y] = pal["eye"] + (255,)
            elif (x,y) in hi_set:
                q[x,y] = pal["hi"] + (255,)
            elif hole[y][x]:
                q[x,y] = pal["base"] + (255,)
    return out

# ---------------- designed poses (real conventions, 16-grid then x2) ----------------
def to16(im32: Image.Image) -> Image.Image:
    # assume 2x2 uniform official
    return down_scale(im32, 2)

def bbox_ink(im, p=None):
    if p is None:
        p = im.load()
    w,h=im.size
    xs,ys=[],[]
    for y in range(h):
        for x in range(w):
            c=p[x,y]
            if not is_transparent(c):
                xs.append(x); ys.append(y)
    if not xs:
        return (0,0,w-1,h-1)
    return min(xs),min(ys),max(xs),max(ys)

def open_mouth(im32: Image.Image) -> Image.Image:
    """Eat/happy: open a mouth cavity on the front of the head (left-facing)."""
    im16 = to16(im32)
    p = im16.load()
    w,h=im16.size
    x0,y0,x1,y1=bbox_ink(im16,p)
    # head is upper 55% of bbox
    hy1 = y0 + int((y1-y0)*0.62)
    # leftmost ink in head = snout
    snout = None
    for x in range(x0, x1+1):
        for y in range(y0, hy1+1):
            if not is_transparent(p[x,y]):
                snout = (x,y)
                break
        if snout:
            break
    out = im16.copy()
    q = out.load()
    if not snout:
        return to32(out)
    sx, sy = snout
    # mouth center a few px inside snout
    mx = min(w-2, sx + 2)
    my = min(h-2, max(1, sy + 2))
    # find outline color and a dark fill
    pal = classify_palette(im32)
    # carve 2x2 / 3x2 cavity if interior
    cells = [(mx,my),(mx+1,my),(mx,my+1),(mx+1,my+1),(mx+2,my)]
    for x,y in cells:
        if 0<=x<w and 0<=y<h and not is_transparent(q[x,y]):
            q[x,y] = pal["outline"]+(255,)
    # inner darker
    if 0<=mx+1<w and 0<=my<h:
        q[mx+1, my] = (max(0,pal["deep"][0]//3), max(0,pal["deep"][1]//3), max(0,pal["deep"][2]//3), 255)
    return to32(out)

def bow_head(im32: Image.Image) -> Image.Image:
    """Refuse: drop the head cluster (upper part of bbox) by 2px — hunched/turned."""
    im16 = to16(im32)
    p = im16.load()
    w,h=im16.size
    x0,y0,x1,y1=bbox_ink(im16,p)
    split = y0 + int((y1-y0)*0.48)
    out = Image.new("RGBA",(w,h),(0,0,0,0))
    q=out.load()
    # body
    for y in range(split,h):
        for x in range(w):
            q[x,y]=p[x,y]
    # head shifted down 2 and slightly back (right, since facing left)
    for y in range(y0, split):
        for x in range(w):
            if is_transparent(p[x,y]):
                continue
            nx, ny = min(w-1, x+1), min(h-1, y+2)
            q[nx,ny]=p[x,y]
    return to32(out)

def frown(im32: Image.Image) -> Image.Image:
    """Angry: add a brow over the upper-head and flatten the snout line."""
    im16 = to16(im32)
    pal = classify_palette(im32)
    p=im16.load(); w,h=im16.size
    x0,y0,x1,y1=bbox_ink(im16,p)
    out=im16.copy(); q=out.load()
    brow_y = y0 + max(1, int((y1-y0)*0.28))
    # dark brow across upper head ink
    for x in range(x0, x1+1):
        if 0<=brow_y<h and not is_transparent(q[x,brow_y]):
            if 0<=brow_y-1<h and not is_transparent(q[x, brow_y]):
                q[x, brow_y-1] = pal["outline"]+(255,)
    return to32(out)

def lie_down(im32: Image.Image) -> Image.Image:
    """Sleep: lie on the side (90° rotate), bottom-aligned. Official convention, not a shift."""
    im16 = to16(im32)
    rot = im16.rotate(90, resample=Image.Resampling.NEAREST, expand=True)
    # fit back to 16x16, bottom-center
    rot = rot.crop(rot.getbbox() or (0,0,16,16))
    canvas = Image.new("RGBA",(16,16),(0,0,0,0))
    rw,rh=rot.size
    scale = 1
    if rw>16 or rh>16:
        # shouldn't happen often; nearest shrink
        f=max(rw/16, rh/16)
        rot=rot.resize((max(1,int(rw/f)), max(1,int(rh/f))), Image.Resampling.NEAREST)
        rw,rh=rot.size
    x=(16-rw)//2
    y=16-rh  # bottom align
    canvas.paste(rot, (x,y), rot)
    return to32(canvas)

def sleep_breath(im32_lying: Image.Image) -> Image.Image:
    """Sleep frame 2: nudge 1px (breath) on the lying designed/official sleep."""
    im16=to16(im32_lying)
    p=im16.load(); w,h=im16.size
    out=Image.new("RGBA",(16,16),(0,0,0,0)); q=out.load()
    for y in range(h):
        for x in range(w):
            if not is_transparent(p[x,y]):
                q[x, max(0,y-1)] = p[x,y]
    return to32(out)

def strike(im32: Image.Image) -> Image.Image:
    """Attack: lean forward (left) + open mouth."""
    opened = open_mouth(im32)
    im16=to16(opened)
    p=im16.load(); w,h=im16.size
    out=Image.new("RGBA",(16,16),(0,0,0,0)); q=out.load()
    x0,y0,x1,y1=bbox_ink(im16,p)
    for y in range(h):
        # shear: upper body shifts left more
        shift = 1 if y < (y0+y1)//2 else 0
        for x in range(w):
            if not is_transparent(p[x,y]):
                nx=max(0,x-1-shift)
                q[nx,y]=p[x,y]
    return to32(out)

def slump(im32: Image.Image) -> Image.Image:
    """Hurt/sick: squat — compress lower and drop head."""
    im16=to16(im32)
    p=im16.load(); w,h=im16.size
    x0,y0,x1,y1=bbox_ink(im16,p)
    out=Image.new("RGBA",(16,16),(0,0,0,0)); q=out.load()
    mid=(y0+y1)//2
    for y in range(h):
        for x in range(w):
            if is_transparent(p[x,y]):
                continue
            ny = y+1 if y < mid else min(h-1, y)  # drop upper
            q[x,ny]=p[x,y]
    return to32(out)

def crack_egg(im32: Image.Image) -> Image.Image:
    im=im32.copy()
    p=im.load(); w,h=im.size
    x0,y0,x1,y1=bbox_ink(im,p)
    cx=(x0+x1)//2
    # jagged crack
    pal=classify_palette(im32)
    y = y0+1
    x = cx
    while y<=y1-1:
        for dx in (0,1,-1):
            xx=x+dx
            if 0<=xx<w and not is_transparent(p[xx,y]):
                p[xx,y]=pal["hi"]+(255,)
        x += 1 if (y//2)%2==0 else -1
        y += 1
    return im

def encode_sprite(frames: dict) -> dict:
    pal = ["#00000000"]
    index = {}
    for fr in frames.values():
        px = fr.load()
        w, h = fr.size
        for y in range(h):
            for x in range(w):
                p = px[x, y]
                if p[3] < 128:
                    continue
                hexc = "#{:02x}{:02x}{:02x}".format(p[0], p[1], p[2])
                if hexc not in index:
                    if len(pal) >= MAX_PAL:
                        continue
                    index[hexc] = len(pal)
                    pal.append(hexc)
                index.setdefault(hexc, pal.index(hexc) if hexc in pal else 1)
    def nearest_hex(hx):
        if hx in index:
            return index[hx]
        r,g,b=int(hx[1:3],16),int(hx[3:5],16),int(hx[5:7],16)
        best,bid=1e9,1
        for i,pv in enumerate(pal):
            if pv=="#00000000":
                continue
            pr,pg,pb=int(pv[1:3],16),int(pv[3:5],16),int(pv[5:7],16)
            d=(pr-r)**2+(pg-g)**2+(pb-b)**2
            if d<best:
                best,bid=d,i
        return bid
    encoded={}
    for name,fr in frames.items():
        px=fr.load(); w,h=fr.size
        rows=[]
        for y in range(h):
            row=[]
            for x in range(w):
                p=px[x,y]
                if p[3]<128:
                    row.append("0")
                else:
                    hx="#{:02x}{:02x}{:02x}".format(p[0],p[1],p[2])
                    row.append(DIGITS[nearest_hex(hx)])
            rows.append("".join(row))
        encoded[name]=rows
    return {"w":32,"h":32,"pal":pal,"frames":encoded}

def format_entry(mid, obj):
    pal=", ".join("'"+c+"'" for c in obj["pal"])
    parts=[f"    {mid}: {{ w: 32, h: 32, pal: [{pal}], frames: {{\n"]
    items=list(obj["frames"].items())
    for i,(name,rows) in enumerate(items):
        rowtxt=", ".join("'"+r+"'" for r in rows)
        comma="," if i<len(items)-1 else ""
        parts.append(f"      {name}: [{rowtxt}]{comma}\n")
    parts.append("    } }")
    return "".join(parts)

print("library ok, DIGITS", len(DIGITS), "MAX_PAL", MAX_PAL)


def parse_existing_sprites(js_text):
    body = js_text[js_text.find("var SPRITES = {"):js_text.find("  function decodeIndex")]
    sprites = {}
    parts = re.split(r"\n    (?=[A-Za-z_]\w*: \{ w: )", body)
    for part in parts[1:]:
        mid = part.split(":", 1)[0].strip()
        pal_m = re.search(r"pal: \[([^\]]+)\]", part)
        if not pal_m:
            continue
        pal = [s.strip().strip("'") for s in pal_m.group(1).split(",")]
        frames = {}
        for fm in re.finditer(r"(\w+): \[([^\]]+)\]", part):
            name, rows = fm.group(1), fm.group(2)
            if name in ("w", "h", "pal"):
                continue
            frames[name] = re.findall(r"'([^']*)'", rows)
        sprites[mid] = {"pal": pal, "frames": frames, "w": 32, "h": 32}
    return sprites

def decode_entry(entry, name="idle0"):
    pal = entry["pal"]
    rows = entry["frames"][name]
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()
    # old sprites used 32-char digits; new may be longer — use DIGITS which is a superset
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            i = DIGITS.find(ch)
            if i < 0:
                # fallback old only 0-v
                i = "0123456789abcdefghijklmnopqrstuv".find(ch)
            if i <= 0:
                continue
            hx = pal[i] if i < len(pal) else "#00000000"
            if hx in ("#00000000", "transparent"):
                continue
            raw = hx.lstrip("#")
            if len(raw) >= 6:
                px[x, y] = (int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16), 255)
    return im


def official_name_keys(name):
    n = norm(name)
    keys = {n, norm(name.replace("(Virus)", "virus")), norm(name.replace("(Vaccine)", "vaccine"))}
    # MetalGreymon (Virus) -> metalgreymonvirus
    keys.add(re.sub(r"\([^)]*\)", "", n))
    return keys


def build_tero_map():
    data = load_tero_index()
    official = [
        x
        for x in data["sprites"]
        if x.get("author") == "Bandai"
        and x.get("source", "").startswith(("Digimon Color", "Pendulum Color"))
        and x.get("style") != "Hi-res"
    ]
    by = defaultdict(list)
    for x in official:
        for k in official_name_keys(x["name"]):
            by[k].append(x)
    return official, by


def prefer_source_rank(src: str) -> int:
    # lower is better when we want DMC first for ver1-5
    if src.startswith("Digimon Color Ver."):
        return 0
    if src.startswith("Pendulum Color"):
        return 1
    return 9


def pick_tero_for(mid, by):
    keys = {norm(mid), norm(mid.replace("_", ""))}
    if mid in ALIAS_NORM:
        keys.add(norm(ALIAS_NORM[mid]))
        keys.add(ALIAS_NORM[mid])
    # extra
    if mid == "metalgreymon":
        keys.update({"metalgreymonvirus", "metalgreymonvaccine"})
    if mid == "metalgreymon_va":
        keys.add("metalgreymonvirus")
    if mid == "omegamon_alters":
        keys.add("omnimonalters")
    hits = []
    for k in keys:
        hits += by.get(k, [])
        hits += by.get(k.replace("grey", "gray"), [])
        hits += by.get(k.replace("gray", "grey"), [])
    # unique
    seen = set()
    uniq = []
    for h in hits:
        t = (h["source"], h["name"])
        if t not in seen:
            seen.add(t)
            uniq.append(h)
    if not uniq:
        return None
    uniq.sort(key=lambda h: (prefer_source_rank(h["source"]), -len(h["images"])))
    return uniq[0]


def load_tero_frames(entry):
    fmt = entry.get("format")
    n = len(entry["images"])
    if n == 15:
        slots = DMC_SLOTS
    elif n == 12:
        slots = PENC_SLOTS
    else:
        slots = DMC_SLOTS[:n]
    frames = {}
    src_meta = {}
    url_base = f"https://tero0x.github.io/dmc-sprites (Bandai {entry['source']})"
    for i, url in enumerate(entry["images"]):
        slot = slots[i] if i < len(slots) else f"extra{i}"
        dest = TERO_DIR / entry["source"].replace(" ", "_") / f"{norm(entry['name'])}_{i:02d}.png"
        try:
            download(url, dest)
            fr = tero_to_32(dest)
        except Exception as e:
            print("tero fail", url, e)
            continue
        frames[slot] = fr
        src_meta[slot] = {
            "kind": "official_color",
            "url": url,
            "source": entry["source"],
            "name": entry["name"],
        }
    # aliases
    if "eat1" in frames:
        frames["eat"] = frames["eat1"]
        src_meta["eat"] = src_meta["eat1"]
    if "sleep0" in frames:
        frames["sleep"] = frames["sleep0"]
        src_meta["sleep"] = src_meta["sleep0"]
    if "hurt" in frames and "hurt1" not in frames:
        frames["hurt1"] = frames["hurt"]
        src_meta["hurt1"] = src_meta["hurt"]
    return frames, src_meta


# ---------------- DM20 / Pen20 artbook (12-col, often only first few filled) ----------------
def iter_artbook_rows(path, first_x=94, step=20, nslots=12, cs=16):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    WHITE = lambda c: all(v >= 250 for v in c)
    y = 0
    rows = []
    while y < h - cs:
        # start of a tile row if x=first_x 16px has content and y-1 is white
        ink = 0
        for yy in range(y, min(y + cs, h)):
            for xx in range(first_x, first_x + cs):
                if not WHITE(px[xx, yy]):
                    ink += 1
        if ink >= 20 and (y == 0 or all(WHITE(px[first_x + k, y - 1]) for k in range(cs))):
            cells = []
            for i in range(nslots):
                x0 = first_x + i * step
                cells.append(im.crop((x0, y, x0 + cs, y + cs)))
            # label region to the left
            label = im.crop((0, y, first_x - 2, y + cs))
            rows.append({"y": y, "cells": cells, "label": label})
            y += cs
        y += 1
    # also second column grids (right page)
    # detect other first_x by looking at y of first row
    return im, rows


def artbook_cell_to_32(cell: Image.Image) -> Image.Image | None:
    im = cell.convert("RGBA")
    def bg(c):
        return c[0] <= 8 and c[1] <= 8 and c[2] <= 8
    im = knock_bg_flood(im, bg)
    # require real colored ink, not a black tile with a few leftover pixels
    p=im.load(); w,h=im.size
    ink=0; chroma=0
    for y in range(h):
        for x in range(w):
            c=p[x,y]
            if c[3]<128: continue
            if c[0]<=12 and c[1]<=12 and c[2]<=12: continue
            ink+=1
            if max(c[:3])-min(c[:3])>=20 or max(c[:3])>=40:
                chroma+=1
    if ink < 40 or chroma < 20:
        return None
    return to32(im)


def match_artbook_to_idle(cell16, idle32_mask, threshold=0.72):
    # cell is 16x16
    a = ink_mask(cell16, treat_black_bg=True)
    b = ink_mask(to16(idle32_mask) if idle32_mask.size == (32, 32) else idle32_mask, treat_black_bg=True)
    return mask_iou(a, b) >= threshold, mask_iou(a, b)


# ---------------- overlays from DM20 UI / hand official-style ----------------
def extract_dm20_ui():
    im = Image.open(TSR / "dm20_ver20th.png").convert("RGBA")
    w, h = im.size
    # UI is in the bottom-left; save a crop for debug
    crop = im.crop((0, h - 260, 400, h))
    crop.save(CACHE / "dm20_ui_native.png")
    return crop


def make_icon_zz() -> Image.Image:
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # two staggered Zs, official-style chunky
    def z(x, y, s, col, ol):
        # 5x5-ish Z at scale s (2x blocks)
        for dx in range(3):
            d.rectangle((x+dx*s, y, x+dx*s+s-1, y+s-1), fill=ol)
            d.rectangle((x+dx*s, y+2*s, x+dx*s+s-1, y+3*s-1), fill=ol)
        # diagonal
        d.rectangle((x+2*s, y+s, x+3*s-1, y+2*s-1), fill=ol)
        d.rectangle((x+s, y+s, x+2*s-1, y+2*s-1), fill=ol)
        # inner white/cream
        for dx in range(3):
            d.point((x+dx*s+s//2, y+s//2), fill=col)
    # big Z
    cols = [(12, 12, 16, 255), (230, 230, 240, 255)]
    # draw scale-2 Z
    def drawz(ox, oy, s=2):
        ol = (16, 16, 20, 255)
        fg = (240, 240, 248, 255)
        # outline then fill
        coords = []
        # top bar, bottom bar, diagonal
        for i in range(5):
            coords.append((ox+i*s, oy))
            coords.append((ox+i*s, oy+4*s))
        for i in range(5):
            coords.append((ox+(4-i)*s, oy+i*s))
        for cx,cy in coords:
            d.rectangle((cx-1,cy-1,cx+s,cy+s), fill=ol)
        for cx,cy in coords:
            d.rectangle((cx,cy,cx+s-1,cy+s-1), fill=fg)
    drawz(4, 4, 2)
    drawz(14, 14, 2)
    return im


def make_icon_skull() -> Image.Image:
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ol, bone, hole = (16,16,18,255), (236,236,240,255), (16,16,18,255)
    # 16-grid skull then x2 — draw at 16 then scale
    s = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    q = s.load()
    def put(x,y,c):
        if 0<=x<16 and 0<=y<16:
            q[x,y]=c
    # cranium
    for y,xs in {2:range(5,11),3:range(4,12),4:range(3,13),5:range(3,13),6:range(3,13),7:range(4,12),8:range(5,11)}.items():
        for x in xs:
            put(x,y,bone)
    # outline
    for x,y in [(5,2),(6,2),(7,2),(8,2),(9,2),(10,2),(4,3),(11,3),(3,4),(12,4),(3,5),(12,5),(3,6),(12,6),(4,7),(11,7),(5,8),(10,8)]:
        put(x,y,ol)
    # eyes
    for x,y in [(5,5),(6,5),(9,5),(10,5),(5,6),(6,6),(9,6),(10,6)]:
        put(x,y,hole)
    # nose
    put(7,7,ol); put(8,7,ol)
    # jaw
    for x in range(5,11):
        put(x,9,bone); put(x,10,bone)
        put(x,9,ol if x in (5,10) else bone)
    put(5,9,ol); put(10,9,ol); put(5,10,ol); put(10,10,ol)
    # teeth
    put(6,10,ol); put(8,10,ol)
    return to32(s)


def make_icon_shot() -> Image.Image:
    s = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    q = s.load()
    # left-flying bolt
    cols = [(16,16,20,255),(255,230,80,255),(255,255,200,255)]
    for x,y in [(2,7),(3,7),(4,7),(5,7),(6,7),(7,7),(8,7),(9,6),(9,8),(10,7),(11,7)]:
        q[x,y]=cols[0]
    for x in range(3,9):
        q[x,7]=cols[1]
    q[6,7]=cols[2]; q[10,7]=cols[1]
    return to32(s)


def make_icon_hit() -> Image.Image:
    s = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    q = s.load()
    ol,fg=(16,16,20,255),(255,240,80,255)
    # 4-point spark
    for x,y in [(8,2),(8,3),(8,4),(8,5),(8,6),(8,7),(8,8),(8,9),(8,10),(8,11),(8,12),(8,13),
                (2,8),(3,8),(4,8),(5,8),(6,8),(7,8),(9,8),(10,8),(11,8),(12,8),(13,8),
                (5,5),(6,6),(10,6),(11,5),(5,11),(6,10),(10,10),(11,11)]:
        q[x,y]=ol
    for x,y in [(8,4),(8,5),(8,6),(8,7),(8,9),(8,10),(8,11),(4,8),(5,8),(6,8),(7,8),(9,8),(10,8),(11,8),(8,8)]:
        q[x,y]=fg
    return to32(s)


def make_icon_wall() -> Image.Image:
    s = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    q = s.load()
    ol,br,hi=(40,28,16,255),(160,110,50,255),(200,150,80,255)
    for y in range(2,15):
        for x in range(4,13):
            q[x,y]=br if (x+y)%2==0 else hi
        q[4,y]=ol; q[12,y]=ol
    for x in range(4,13):
        q[x,2]=ol; q[x,14]=ol
    return to32(s)


def maybe_food_icon(existing, name):
    # reuse existing 32 icon if present
    return existing


def assemble_monster(mid, idle32, official: dict, official_meta: dict, is_egg=False):
    """official: name -> 32 RGBA; fill gaps with designed poses. Returns frames, meta."""
    frames = {}
    meta = {}
    # start with official
    for k, im in official.items():
        frames[k] = im
        meta[k] = official_meta.get(k, {"kind": "official_color"})
    # ensure idle
    if "idle0" not in frames:
        frames["idle0"] = idle32
        meta["idle0"] = {"kind": "kept_existing_idle"}
    if "idle1" not in frames:
        # if official only has idle0, keep existing idle1 if later passed via official
        frames["idle1"] = official.get("idle1") or idle32
        meta["idle1"] = meta.get("idle0", {"kind": "designed"}).copy()
        if "idle1" not in official:
            meta["idle1"] = {"kind": "designed", "note": "copied idle0 (no official idle1)"}
    base = frames["idle0"]

    def need(key, fn, note):
        if key not in frames:
            frames[key] = fn(base)
            meta[key] = {"kind": "designed", "note": note}

    if is_egg:
        need("eat0", lambda b: b, "egg uses idle")
        need("eat1", lambda b: frames.get("idle1", b), "egg uses idle1")
        need("happy", lambda b: b, "egg")
        need("angry", lambda b: b, "egg")
        need("refuse", lambda b: b, "egg")
        need("sleep0", lambda b: b, "egg")
        need("sleep1", lambda b: frames.get("idle1", b), "egg")
        need("attack", lambda b: b, "egg")
        need("hurt", lambda b: b, "egg")
        need("hatch", crack_egg, "crack lines on official/designed egg")
    else:
        # promote official hurt/sick slots before designing
        if "hurt" not in frames and "hurt1" in frames:
            frames["hurt"] = frames["hurt1"]
            meta["hurt"] = meta["hurt1"]
        if "hurt" not in frames and "hurt0" in frames:
            frames["hurt"] = frames["hurt0"]
            meta["hurt"] = meta["hurt0"]
        if "eat0" not in frames and "idle0" in frames:
            # only used if no official eat0
            pass
        need("eat0", lambda b: b, "mouth-closed standing (idle as eat0 when official eat missing)")
        need("eat1", open_mouth, "mouth-open eat variant, official silhouette")
        need("happy", open_mouth, "mouth-open happy variant, official silhouette")
        need("angry", frown, "brow/frown on official silhouette")
        need("refuse", bow_head, "head-down refuse, official silhouette")
        need("sleep0", lie_down, "lying-down sleep (90°), official pixels")
        if "sleep1" not in frames:
            frames["sleep1"] = sleep_breath(frames["sleep0"])
            meta["sleep1"] = {"kind": "designed", "note": "sleep breath of sleep0"}
        need("attack", strike, "forward strike + open mouth")
        need("hurt", slump, "slumped/squat hurt")
        if "hurt0" not in frames:
            frames["hurt0"] = frames.get("sick") or frames["hurt"]
            meta["hurt0"] = meta.get("sick") or meta["hurt"]
        if "hurt1" not in frames:
            frames["hurt1"] = frames["hurt"]
            meta["hurt1"] = meta["hurt"]
    # aliases
    frames["eat"] = frames.get("eat1") or frames["eat0"]
    meta["eat"] = meta.get("eat1") or meta.get("eat0")
    frames["sleep"] = frames.get("sleep0")
    meta["sleep"] = meta.get("sleep0")
    if "hurt" not in frames:
        frames["hurt"] = frames.get("hurt1") or frames["hurt0"]
        meta["hurt"] = meta.get("hurt1") or meta.get("hurt0")
    return frames, meta


def main():
    js_path = ROOT / "js/sprites.js"
    js_text = js_path.read_text()
    existing = parse_existing_sprites(js_text)
    mapping = json.loads((ROOT / "ref/mapping.json").read_text())
    ids = list(mapping["primary"].keys())
    print("roster", len(ids), "existing sprites", len(existing))

    official_list, tero_by = build_tero_map()
    print("tero official", len(official_list))

    # Preload DM20 artbook rows (both columns)
    ab_im = Image.open(TSR / "dm20_ver20th.png").convert("RGB")
    # left grid x=94, right grid x=504 (from earlier run)
    def collect_ab(first_x):
        im, rows = iter_artbook_rows(TSR / "dm20_ver20th.png", first_x=first_x)
        # filter rows with at least 1 real cell
        out=[]
        for r in rows:
            cells32=[]
            for c in r["cells"]:
                cells32.append(artbook_cell_to_32(c))
            if any(c is not None for c in cells32):
                r["cells32"]=cells32
                out.append(r)
        return out
    ab_rows = []
    for path, xs, url, src in (
        (TSR / "dm20_ver20th.png", (94, 504),
         "https://www.spriters-resource.com/lcd_handhelds/digimondigitalmonsterver20th/asset/148724/",
         "Digital Monster Ver.20th Artbook (TSR dm20_ver20th.png)"),
        (TSR / "pen20th.png", (94, 430, 504),
         "https://www.spriters-resource.com/lcd_handhelds/digimonpendulumver20th/",
         "Digimon Pendulum Ver.20th Artbook (TSR pen20th.png)"),
    ):
        if not path.exists():
            continue
        # temporarily point collect to this path
        def collect_on(path, first_x):
            im, rows = iter_artbook_rows(path, first_x=first_x)
            out=[]
            for r in rows:
                cells32=[artbook_cell_to_32(c) for c in r["cells"]]
                if any(c is not None for c in cells32):
                    r=dict(r)
                    r["cells32"]=cells32
                    r["url"]=url
                    r["source"]=src
                    out.append(r)
            return out
        for x in xs:
            ab_rows.extend(collect_on(path, x))
    print("artbook filled rows", len(ab_rows))

    # 1-to-1 assignment: each row to at most one unmatched mon (no tero later — use all for now, tero branch skips)
    # Precompute idle masks for all ids
    idle_of = {}
    for mid0 in ids:
        if mid0 in existing:
            idle_of[mid0] = decode_entry(existing[mid0], "idle0")
    # scores[row_idx][mid]=iou
    used_mons=set()
    ab_assign={}  # mid -> (sc, row, src)
    # For each row, pick best mon not yet used
    row_best=[]
    for ri,r in enumerate(ab_rows):
        first=next((c for c in r["cells32"] if c is not None), None)
        if first is None:
            continue
        cands=[]
        for mid0, idle0 in idle_of.items():
            ok, sc = match_artbook_to_idle(to16(first), idle0, threshold=0.0)
            cands.append((sc, mid0))
        cands.sort(reverse=True)
        row_best.append((cands, r))
    # greedy by best score
    taken_rows=set()
    taken_mons=set()
    flat=[]
    for ri,(cands,r) in enumerate(row_best):
        if cands:
            flat.append((cands[0][0], ri, cands))
    flat.sort(reverse=True)
    for sc, ri, cands in flat:
        if ri in taken_rows:
            continue
        chosen=None
        second=cands[1][0] if len(cands)>1 else 0
        for s, mid0 in cands:
            if mid0 in taken_mons:
                continue
            margin = s - (cands[1][0] if len(cands)>1 and cands[1][1]!=mid0 else (cands[2][0] if len(cands)>2 else 0))
            # unique strong match
            if s >= 0.84 and margin >= 0.06:
                chosen=(s, mid0)
                break
        if not chosen:
            continue
        s, mid0 = chosen
        taken_rows.add(ri)
        taken_mons.add(mid0)
        r=row_best[ri][1]
        ab_assign[mid0]=(s, r, {"url": r.get("url",""), "source": r.get("source","")})
    print("artbook 1-to-1 assigned", len(ab_assign), sorted(ab_assign))

    # index artbook by ink of first filled cell
    coverage = {}
    new_sprites = {}
    counts = Counter()

    # icons first
    icon_ids = [k for k in existing if k.startswith("icon_")]
    for k in icon_ids:
        # keep as-is: re-encode from decoded pixels (lossless if pal ok)
        frs = {fn: decode_entry(existing[k], fn) for fn in existing[k]["frames"]}
        # skip re-encode later — copy raw JS for icons
        new_sprites[k] = existing[k]  # raw; special-cased on write

    # extra overlay icons
    overlays = {
        "overlay_zz": make_icon_zz(),
        "overlay_skull": make_icon_skull(),
        "overlay_shot": make_icon_shot(),
        "overlay_hit": make_icon_hit(),
        "overlay_wall": make_icon_wall(),
    }
    # try to steal meat/protein from existing icons
    if "icon_food" in existing:
        overlays["overlay_meat"] = decode_entry(existing["icon_food"], "idle0")
    if "icon_protein" in existing:
        overlays["overlay_protein"] = decode_entry(existing["icon_protein"], "idle0")

    tero_hits = 0
    ab_hits = 0

    for mid in ids:
        is_egg = mid.startswith("egg_")
        idle = decode_entry(existing[mid], "idle0") if mid in existing else Image.new("RGBA",(32,32),(0,0,0,0))
        official = {}
        official_meta = {}
        if mid == "meicoomon":
            srcp = ROOT / "ref/wikimon/Meicoomon_vpet_dm.gif"
            if srcp.exists():
                g = Image.open(srcp).convert("RGBA")
                if g.size[0] >= 34:
                    crop = g.crop((2, 2, 34, 34)).convert("RGBA")
                    official["idle0"] = crop
                    official_meta["idle0"] = {
                        "kind": "official_color",
                        "url": "https://wikimon.net/File:Meicoomon_vpet_dm.gif",
                        "source": "Meicoomon vpet dm.gif 36 crop (2,2,34,34) lossless",
                    }

        hit = pick_tero_for(mid, tero_by)
        if hit:
            fr, meta = load_tero_frames(hit)
            official.update(fr)
            official_meta.update(meta)
            tero_hits += 1
            # prefer official color idle (upgrade)
            idle = official.get("idle0", idle)
        else:
            if mid in ab_assign:
                sc, r, src_label = ab_assign[mid]
                for i, c in enumerate(r["cells32"]):
                    if c is None or i >= len(AB_SLOTS):
                        continue
                    slot = AB_SLOTS[i]
                    official[slot] = c
                    official_meta[slot] = {
                        "kind": "official_color",
                        "url": src_label["url"],
                        "source": src_label["source"],
                        "slot": slot,
                        "iou": round(sc, 3),
                    }
                ab_hits += 1
                # keep our established idle colors unless the artbook idle
                # is clearly the same 16-grid (do not replace if IoU vs current idle is weak)
                if "idle0" in official:
                    ok, iou_idle = match_artbook_to_idle(to16(official["idle0"]), idle, threshold=0.0)
                    if iou_idle >= 0.88:
                        idle = official["idle0"]
                    else:
                        # official dots exist but colors may be artbook-printed;
                        # if it's the same ink, using artbook color is official color-as-is.
                        # Require strong ink agreement:
                        if iou_idle >= 0.80:
                            idle = official["idle0"]
                        else:
                            # mismatch — drop this assignment
                            official.clear(); official_meta.clear()
                            ab_hits -= 1

        # If we have official mono-only additional frames... (wikimon idle already in `idle`)
        frames, meta = assemble_monster(mid, idle, official, official_meta, is_egg=is_egg)

        # If official color provided idle, don't colorize. If we used kept mono-colorized idle
        # and added official mono poses — those went through official color path only when
        # artbook/DMC provided color. Designed frames use colorize via painting on idle colors.
        enc = encode_sprite(frames)
        enc["_id"] = mid
        new_sprites[mid] = enc
        coverage[mid] = {k: meta[k] for k in meta}
        for k, m in meta.items():
            counts[m.get("kind", "?")] += 1

        if mid in ("agumon", "lunamon", "titamon", "meicoomon", "dorumon", "egg_v1"):
            # save preview strip
            keys = ["idle0","idle1","eat0","eat1","happy","angry","refuse","sleep0","sleep1","attack","hurt"]
            strip = Image.new("RGB", (len(keys)*32*3, 32*3+2), (200,200,200))
            for i,k in enumerate(keys):
                if k in frames:
                    strip.paste(frames[k].resize((96,96), Image.Resampling.NEAREST), (i*96,0), frames[k].resize((96,96), Image.Resampling.NEAREST))
            strip.save(CACHE / f"preview_{mid}.png")
            print("preview", mid, "tero" if hit else "no-tero", "frames", list(frames), "pal", len(enc["pal"]))

    print("tero_hits", tero_hits, "artbook_hits", ab_hits, "kind counts", dict(counts))

    # encode overlays
    overlay_encoded = {}
    for name, im in overlays.items():
        overlay_encoded[name] = encode_sprite({"idle0": im})
        overlay_encoded[name]["_id"] = name

    # Write sprites.js
    head = js_text[: js_text.find("  var SPRITES = {") + len("  var SPRITES = {\n")]
    tail = js_text[js_text.find("  function decodeIndex"):]
    # replace decodeIndex alphabet
    tail = re.sub(
        r"function decodeIndex\(ch\) \{ var d='[^']*'; return d\.indexOf\(ch\); \}",
        "function decodeIndex(ch) { var d='" + DIGITS + "'; return d.indexOf(ch); }",
        tail,
        count=1,
    )

    entries = []
    # monsters first (same order as mapping)
    for mid in ids:
        entries.append(format_entry(mid, new_sprites[mid]))
    # keep raw icon JS
    icon_block = None
    i = js_text.find("    icon_food:")
    j = js_text.find("  };\n  function decodeIndex")
    if i >= 0 and j >= 0:
        icon_block = js_text[i:j].rstrip()
        if icon_block.endswith(","):
            pass
    # append overlays after icons
    ov_parts = []
    for name, obj in overlay_encoded.items():
        ov_parts.append(format_entry(name, obj))
    body = ",\n".join(entries)
    if icon_block:
        body += ",\n" + icon_block
        if not icon_block.endswith(","):
            body += ","
        body += "\n" + ",\n".join(ov_parts)
    else:
        body += ",\n" + ",\n".join(ov_parts)
    out = head + body + "\n  };\n  " + tail
    # comment header
    out = re.sub(
        r"^/\*\*.*?\*/\n",
        "/** 32x32 V-pet atlas: official color cells as-is; official mono colorized; designed only when no official cell. */\n",
        out,
        count=1,
        flags=re.S,
    )
    js_path.write_text(out)
    print("wrote", js_path, "bytes", js_path.stat().st_size)

    cov_path = CACHE / "coverage.json"
    cov_path.write_text(json.dumps({"counts": dict(counts), "tero_hits": tero_hits, "artbook_hits": ab_hits, "monsters": coverage}, indent=2, ensure_ascii=False))
    print("coverage", cov_path)


if __name__ == "__main__":
    main()
