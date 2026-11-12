#!/usr/bin/env python3
"""64x64 samples: integer-upscale official dots, then light refine.

BASE  = exact nearest-neighbor integer upscale onto 64x64
        (official 16-grid x4 from DMC/DPC 48, or our 32x32 x2).
        Silhouette, pose, proportions, placement and baseline are
        unchanged from the device sprite.
REFINE = only where needed, using the finer 64 pixels:
        smooth stair-step corners, sharpen eyes/face, and carve small
        details only on complex monsters/parts. Never change silhouette.
"""
from __future__ import annotations

import re
import sys
from collections import Counter, deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rebuild_sprites as R  # noqa: E402

ROOT = Path("/workspace/digivice")
REF = ROOT / "ref" / "wikimon"
OUT = ROOT / "ref" / "samples64"
SHEET = ROOT / "style-sample-64.png"
INGAME = ROOT / "style-sample-ingame.png"
SPRITES_JS = ROOT / "js" / "sprites.js"
DIGITS = "0123456789abcdefghijklmnopqrstuv"
PAPER = (245, 243, 235, 255)
FONT_TTC = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

# sid, zh, en, official gif (or None), atlas 32 id, complexity
# source: "dmc48" = official 48 (16-grid x3) → extract 16 x4
#         "32"    = our 32x32 recreation x2 (no integer official 48→64)
SAMPLES = [
    ("agumon", "亞古獸", "Agumon", "Agumon_vpet_dmc.gif", "agumon", "simple"),
    ("greymon", "暴龍獸", "Greymon", "Greymon_vpet_dmc.gif", "greymon", "simple"),
    ("metalgreymon_va", "機械暴龍獸 (疫苗種)", "MetalGreymon (Vaccine)",
     "Metalgreymonva_vpet_dpc.gif", "metalgreymon_va", "complex"),
    ("wargreymon", "戰鬥暴龍獸", "WarGreymon", "Wargreymon_vpet_dpc.gif", "wargreymon", "complex"),
    ("gabumon", "加布獸", "Gabumon", "Gabumon_vpet_dmc.gif", "gabumon", "simple"),
    ("garurumon", "加魯魯獸", "Garurumon", "Garurumon_vpet_dmc.gif", "garurumon", "simple"),
    ("patamon", "巴達獸", "Patamon", "Patamon_vpet_dmc.gif", "patamon", "simple"),
    ("angemon", "天使獸", "Angemon", "Angemon_vpet_dmc.gif", "angemon", "simple"),
    ("piyomon", "比丘獸", "Biyomon", "Piyomon_vpet_dmc.gif", "piyomon", "simple"),
    ("palmon", "巴魯獸", "Palmon", "Palmon_vpet_dmc.gif", "palmon", "simple"),
    ("lunamon", "露娜獸", "Lunamon", "Lunamon_vpet_dm.gif", "lunamon", "simple"),
    ("egg_v1", "數碼蛋 Ver.1", "Digitama Ver.1", "Digitama_ver1_vpet_dmc.gif", "egg_v1", "simple"),
    ("omegamon", "奧米加獸", "Omegamon", "Omegamon_vpet_dpc.gif", "omegamon", "complex"),
]


def luma(c):
    if c[3] < 128:
        return 999
    return (c[0] * 3 + c[1] * 5 + c[2] * 2) // 10


def opaque(c):
    return len(c) < 4 or c[3] >= 128


def rgb_of(c):
    return (c[0], c[1], c[2], 255)


def hsl(c):
    r, g, b = c[0] / 255, c[1] / 255, c[2] / 255
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx == mn:
        return 0.0, 0.0, l
    d = mx - mn
    s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == r:
        h = (g - b) / d + (6 if g < b else 0)
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    return h * 60, s, l


def knock(im):
    return R.knock_bg(im.convert("RGBA"))


def is_ink(c, thresh=40):
    return opaque(c) and luma(c) <= thresh


# ---------- official source → 64 base (integer NN only) ----------

def extract_16_from_dmc48(im48):
    """DMC/DPC 48 is a uniform 3x3 of a 16x16 design. Return 16x16 RGBA."""
    im48 = knock(im48)
    if im48.size != (48, 48):
        raise ValueError(f"expected 48x48, got {im48.size}")
    out = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    sp, dp = im48.load(), out.load()
    for cy in range(16):
        for cx in range(16):
            c = sp[cx * 3, cy * 3]
            if opaque(c):
                dp[cx, cy] = rgb_of(c)
    return out


def integer_upscale(im, factor):
    w, h = im.size
    return im.resize((w * factor, h * factor), Image.NEAREST)


def to_64_canvas(im):
    """Center a 64-high (or already 64) sprite on a 64x64 canvas, feet planted
    if the source is already footed; if smaller than 64, paste at (0, 64-h)
    only when width is also 64. Official 16x4 and 32x2 already fill 64.
    """
    if im.size == (64, 64):
        return im.convert("RGBA")
    canvas = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    w, h = im.size
    if w > 64 or h > 64:
        raise ValueError(f"cannot place {im.size} on 64x64 without a non-integer shrink")
    # plant feet: bottom-align, horizontally as in the source (left = 0 if w==64)
    x = (64 - w) // 2
    y = 64 - h
    canvas.paste(im, (x, y), im)
    return canvas


def make_base(sid, gif, atlas32):
    """Return (original_rgba, base64, source_label)."""
    if sid == "lunamon":
        # no official 48; 36 is not an integer factor of 64.
        # Base = our good 32x32 x2. Original column shows official DM 36.
        orig = knock(R.gif_frames(REF / gif)[0])
        base = to_64_canvas(integer_upscale(atlas32, 2))
        return orig, base, "official DM 36 (orig) / our 32×2 (base)"
    im48 = knock(R.gif_frames(REF / gif)[0])
    if im48.size != (48, 48):
        raise ValueError(f"{gif} is {im48.size}, expected official 48")
    grid16 = extract_16_from_dmc48(im48)
    base = integer_upscale(grid16, 4)  # 64x64, official 16-grid
    return im48, base, f"official {gif} 16-grid ×4"


# ---------- refine (does not change silhouette / proportions) ----------

def chamfer_silhouette_corners(im):
    """Cut a single convex corner pixel when both edges run at least 3 px.

    Softens official 4 px stairs. Does not thin the outline wall.
    """
    w, h = im.size
    src = im.copy()
    sp, px = src.load(), im.load()

    def op(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return False
        return opaque(sp[x, y])

    def run(x, y, dx, dy, n=3):
        for i in range(1, n + 1):
            if not op(x + dx * i, y + dy * i):
                return False
        return True

    cuts = []
    for y in range(h):
        for x in range(w):
            if not op(x, y):
                continue
            n, e, s, west = not op(x, y - 1), not op(x + 1, y), not op(x, y + 1), not op(x - 1, y)
            if n and west and not op(x - 1, y - 1) and run(x, y, 1, 0) and run(x, y, 0, 1):
                cuts.append((x, y))
            elif n and e and not op(x + 1, y - 1) and run(x, y, -1, 0) and run(x, y, 0, 1):
                cuts.append((x, y))
            elif s and west and not op(x - 1, y + 1) and run(x, y, 1, 0) and run(x, y, 0, -1):
                cuts.append((x, y))
            elif s and e and not op(x + 1, y + 1) and run(x, y, -1, 0) and run(x, y, 0, -1):
                cuts.append((x, y))
    for x, y in cuts:
        px[x, y] = (0, 0, 0, 0)
    return im


def as_grid16(im16):
    """Accept a 16x16 Image or a 16x16 list of tuples."""
    if isinstance(im16, Image.Image):
        px = im16.load()
        return [[px[x, y] for x in range(16)] for y in range(16)]
    return im16


def detect_eye_cells(grid16):
    """2x2-ish clusters of rare colors that include a dark pupil."""
    grid16 = as_grid16(grid16)
    n = 16
    freq = Counter(rgb_of(grid16[cy][cx]) for cy in range(n) for cx in range(n)
                   if opaque(grid16[cy][cx]))

    def is_eye_cell(cx, cy):
        c = grid16[cy][cx]
        if not opaque(c):
            return False
        rc = rgb_of(c)
        return freq[rc] <= 4

    seen, groups = set(), []
    for cy in range(n):
        for cx in range(n):
            if (cx, cy) in seen or not is_eye_cell(cx, cy):
                continue
            q = deque([(cx, cy)])
            seen.add((cx, cy))
            cells = []
            while q:
                x, y = q.popleft()
                cells.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < n and 0 <= ny < n and (nx, ny) not in seen and is_eye_cell(nx, ny):
                            seen.add((nx, ny))
                            q.append((nx, ny))
            if not (1 <= len(cells) <= 6):
                continue
            colors = [rgb_of(grid16[yy][xx]) for xx, yy in cells]
            if not (any(luma(c) <= 40 for c in colors) and any(luma(c) > 40 for c in colors)):
                continue
            xs, ys = [p[0] for p in cells], [p[1] for p in cells]
            if (max(xs) - min(xs) > 3) or (max(ys) - min(ys) > 3):
                continue
            groups.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, cells))
    return groups


def sharpen_eyes_from_16(im, grid16, cell=4):
    """Sharpen official eye blocks in place: 1 px highlight, tighter pupil.

    Only paints inside the official eye cells. Does not expand the eye
    or touch the silhouette.
    """
    grid16 = as_grid16(grid16)
    px = im.load()
    for x0, y0, x1, y1, cells in detect_eye_cells(grid16):
        colors = [rgb_of(grid16[cy][cx]) for cx, cy in cells]
        colors.sort(key=luma)
        pupil = colors[0]
        highlight = colors[-1]
        mids = [c for c in colors if luma(c) > 40 and c != highlight]
        iris = mids[len(mids) // 2] if mids else highlight
        iris_d = min(mids, key=luma) if mids else iris
        # work in the official rectangle, inset 1 px from the 4x4 edge
        # so we don't nibble the surrounding outline cell
        ex0, ey0, ex1, ey1 = x0 * cell, y0 * cell, x1 * cell, y1 * cell
        # only rewrite pixels that were already an official eye color
        eye_cols = set(colors)
        # pupil 2x2 toward the left, highlight 1 px upper-right of pupil
        # First flatten iris inside the eye cells (already official colors)
        for y in range(ey0, ey1):
            for x in range(ex0, ex1):
                if not opaque(px[x, y]):
                    continue
                if rgb_of(px[x, y]) not in eye_cols and not is_ink(px[x, y]):
                    continue
                if rgb_of(px[x, y]) not in eye_cols:
                    continue
                px[x, y] = iris_d if y >= ey0 + (ey1 - ey0) // 2 else iris
        pw, ph = (2, 2) if (ex1 - ex0) <= 8 else (3, 2)
        p_x = ex0 + max(1, (ex1 - ex0) // 5)
        p_y = ey0 + max(1, (ey1 - ey0 - ph) // 2)
        for y in range(p_y, min(ey1 - 1, p_y + ph)):
            for x in range(p_x, min(ex1 - 1, p_x + pw)):
                if opaque(px[x, y]) and rgb_of(px[x, y]) in eye_cols or (
                    opaque(px[x, y]) and luma(px[x, y]) < 200
                ):
                    if ex0 <= x < ex1 and ey0 <= y < ey1:
                        # stay inside original opaque eye area
                        if opaque(im.copy().load()[x, y]):
                            px[x, y] = pupil if is_ink(pupil) else (0, 0, 0, 255)
        hx = min(ex1 - 2, p_x + pw)
        hy = ey0 + 1
        if ex0 <= hx < ex1 and ey0 <= hy < ey1 and opaque(px[hx, hy]):
            px[hx, hy] = highlight if luma(highlight) > 160 else (248, 248, 236, 255)
    return im


def sharpen_eyes_generic(im):
    """Fallback for 32x2 bases without a 16-grid: find small rare-color blobs
    that look like eyes and put a 1 px highlight in the lightest pixel.
    """
    w, h = im.size
    px = im.load()
    freq = Counter(rgb_of(px[x, y]) for y in range(h) for x in range(w) if opaque(px[x, y]))
    # skip — Lunamon 32 already has readable eyes; don't invent structure
    return im


def inside_opaque(im, x, y):
    w, h = im.size
    if x < 0 or y < 0 or x >= w or y >= h:
        return False
    return opaque(im.getpixel((x, y)))


def draw_in(im, x, y, c):
    """Paint only if the pixel is already opaque (never grow the silhouette)."""
    if inside_opaque(im, x, y):
        im.putpixel((x, y), c)


def hline_in(im, x0, x1, y, c):
    for x in range(min(x0, x1), max(x0, x1) + 1):
        draw_in(im, x, y, c)


def vline_in(im, x, y0, y1, c):
    for y in range(min(y0, y1), max(y0, y1) + 1):
        draw_in(im, x, y, c)


def refine_omegamon(im):
    """Carve official-appearance details inside the official DPC silhouette.

    White cape + red lining (recolor official purple), cannon muzzle in the
    left arm mass, gauntlet / blade edge in the gold right arm, a few armor
    plate lines. No new pixels outside the official mass.
    """
    px = im.load()
    w, h = 64, 64
    CAPE = (232, 236, 244, 255)
    CAPE_D = (176, 192, 216, 255)
    RED = (196, 36, 48, 255)
    RED_D = (128, 16, 28, 255)
    CAN = (168, 184, 204, 255)
    CAN_M = (96, 120, 152, 255)
    CAN_D = (52, 68, 96, 255)
    GOLD = (228, 184, 0, 255)
    GOLD_D = (152, 112, 0, 255)
    GOLD_H = (250, 232, 80, 255)
    INK = (16, 12, 18, 255)
    ARMOR_L = (200, 206, 218, 255)

    def is_purple(c):
        if not opaque(c):
            return False
        h, s, l = hsl(c)
        return 220 <= h <= 290 and s > 0.25

    # 1) recolor official purple mass: light → white cape, dark → red lining
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if not is_purple(c):
                continue
            if luma(c) >= 140:
                px[x, y] = CAPE
            elif luma(c) <= 95:
                px[x, y] = RED
            else:
                px[x, y] = CAPE_D

    # a stronger red lining fold along the body-facing (right) edge of the
    # left-side cape, only on existing cape pixels
    for y in range(24, 48):
        for x in range(16, 24):
            c = px[x, y]
            if opaque(c) and rgb_of(c) in (CAPE, CAPE_D) and x >= 18:
                # only if there's armor/body to the right (fold against body)
                right = px[x + 1, y] if x + 1 < w else (0, 0, 0, 0)
                if opaque(right) and not is_purple(right) and rgb_of(right) not in (CAPE, CAPE_D, RED, RED_D):
                    px[x, y] = RED if x >= 19 else RED_D

    # 2) cannon muzzle carved into the LOWER-LEFT official mass (not growing it)
    # Official left arm/cape occupies roughly x 0–20, y 36–52
    # Paint a barrel highlight + bore only on already-opaque pixels
    for y in range(40, 52):
        for x in range(0, 18):
            if not opaque(px[x, y]):
                continue
            # don't recolor gold feet / white armor far right of this region
            h_, s_, _ = hsl(px[x, y])
            is_gold = 30 <= h_ <= 60 and s_ > 0.4
            if is_gold:
                continue
            if x <= 3:
                px[x, y] = CAN_D if not (42 <= y <= 48 and x <= 2) else INK  # muzzle + bore
            elif x <= 6:
                px[x, y] = CAN_D if x == 5 else CAN_M  # ring
            elif y <= 43:
                # only retint leftover cape in the barrel zone
                if rgb_of(px[x, y]) in (CAPE, CAPE_D, RED, RED_D) or luma(px[x, y]) < 180:
                    px[x, y] = CAN
            elif y >= 49:
                if rgb_of(px[x, y]) in (CAPE, CAPE_D, RED, RED_D):
                    px[x, y] = CAN_D

    # seam between cape (above) and cannon (below), 1 px, only on opaque
    for x in range(4, 16):
        if opaque(px[x, 39]) and rgb_of(px[x, 39]) in (CAPE, CAPE_D, CAN, CAN_M, CAN_D):
            px[x, 39] = INK

    # 3) gold right arm: blade-edge + gauntlet plate lines inside official gold
    def is_gold_px(c):
        if not opaque(c):
            return False
        h_, s_, _ = hsl(c)
        return 35 <= h_ <= 65 and s_ > 0.35 and luma(c) > 80

    for y in range(4, 52):
        for x in range(48, 64):
            if not is_gold_px(px[x, y]):
                continue
            # darker back edge of a blade along the left of the gold column
            if x == 50 or x == 51:
                if 8 <= y <= 36:
                    px[x, y] = GOLD_D
            # highlight along the outer edge
            if x >= 61 and 8 <= y <= 34:
                px[x, y] = GOLD_H
    # gauntlet plates (horizontal 1 px) around the hand
    for y in (34, 40, 46):
        for x in range(52, 64):
            if is_gold_px(px[x, y]):
                px[x, y] = GOLD_D

    # 4) a couple of chest plate lines in the silver armor (flat, 1 px)
    def is_armor(c):
        if not opaque(c):
            return False
        h_, s_, _ = hsl(c)
        return s_ < 0.2 and luma(c) > 140

    for x in range(24, 44):
        if is_armor(px[x, 28]):
            px[x, 28] = (164, 172, 184, 255)
        if is_armor(px[x, 36]):
            px[x, 36] = (164, 172, 184, 255)
    return im


def refine_wargreymon(im):
    """Helmet visor line, braid hints, chest-plate and gauntlet seams."""
    px = im.load()
    GOLD_D = (152, 112, 0, 255)
    ARMOR_D = (140, 144, 152, 255)

    def is_gold(c):
        if not opaque(c):
            return False
        h_, s_, _ = hsl(c)
        return 35 <= h_ <= 65 and s_ > 0.35 and luma(c) > 80

    def is_grey(c):
        if not opaque(c):
            return False
        h_, s_, _ = hsl(c)
        return s_ < 0.2 and 100 < luma(c) < 230

    # visor slit across the helmet (official already has a dark band; sharpen 1 px)
    for x in range(16, 44):
        if is_grey(px[x, 18]):
            px[x, 18] = (40, 40, 48, 255)
    # chest horizontal plate
    for x in range(20, 44):
        if is_grey(px[x, 32]):
            px[x, 32] = ARMOR_D
    # gold gauntlet / braid seams
    for y in (24, 36, 48):
        for x in range(4, 16):
            if is_gold(px[x, y]):
                px[x, y] = GOLD_D
        for x in range(48, 64):
            if is_gold(px[x, y]):
                px[x, y] = GOLD_D
    # brave-shield hint: a small crest in the official cream/gold shoulder if present
    SHIELD = (200, 190, 150, 255)
    for y in range(20, 28):
        for x in range(48, 58):
            c = px[x, y]
            if opaque(c) and luma(c) > 180 and hsl(c)[1] < 0.35:
                # leave fill, just a 1 px darker V mark
                pass
    # V-mark on the right cream plate
    for (x, y) in ((52, 22), (53, 23), (54, 24), (55, 23), (56, 22)):
        if opaque(px[x, y]) and not is_ink(px[x, y]):
            px[x, y] = GOLD_D
    return im


def refine_metalgreymon(im):
    """Metal chest panel seams, arm banding — inside official silhouette."""
    px = im.load()
    METAL_D = (100, 108, 116, 255)

    def is_metal(c):
        if not opaque(c):
            return False
        h_, s_, _ = hsl(c)
        return s_ < 0.2 and 90 < luma(c) < 210

    # chest panel horizontals and one vertical
    for x in range(16, 40):
        if is_metal(px[x, 28]):
            px[x, 28] = METAL_D
        if is_metal(px[x, 36]):
            px[x, 36] = METAL_D
    for y in range(24, 44):
        if is_metal(px[20, y]):
            px[20, y] = METAL_D
    # metal arm banding (left/front claw-arm region)
    for y in (44, 52):
        for x in range(8, 28):
            if is_metal(px[x, y]):
                px[x, y] = METAL_D
    return im


def refine(sid, base, grid16, complexity):
    im = base.copy()
    # All sprites: 1 px chamfer of official stair-step corners only.
    # Simple monsters stop here — they stay the clean integer upscale.
    im = chamfer_silhouette_corners(im)
    if complexity != "complex":
        return im
    if grid16 is not None:
        im = sharpen_eyes_from_16(im, grid16, 4)
    # complex only: carve extra detail inside the official mass
    if complexity == "complex":
        if sid == "omegamon":
            im = refine_omegamon(im)
            # chamfer already done; don't re-chamfer (would eat new 1px lines)
        elif sid == "wargreymon":
            im = refine_wargreymon(im)
        elif sid == "metalgreymon_va":
            im = refine_metalgreymon(im)
    return im


# ---------- atlas / sheet / ingame (display only) ----------

def parse_atlas_32():
    js = SPRITES_JS.read_text()
    sprites = {}
    mid = frame = None
    rows, pal = [], []
    for line in js.splitlines():
        m = re.match(r"    ([a-z0-9_]+): \{ w: 32, h: 32, pal: \[([^\]]+)\], frames: \{", line)
        if m:
            mid = m.group(1)
            pal = [c.strip().strip("'\"") for c in m.group(2).split(",") if c.strip()]
            sprites[mid] = {"pal": pal, "frames": {}}
            continue
        m = re.match(r"      (idle0|idle1|happy|angry): \[", line)
        if m and mid:
            frame = m.group(1)
            rest = line.split("[", 1)[1]
            if "]" in rest:
                body = rest.rsplit("]", 1)[0]
                rows = [s.strip().strip("'\"") for s in body.split(",") if s.strip()]
                sprites[mid]["frames"][frame] = rows
                frame = None
            else:
                rows = []
            continue
        if frame and mid:
            if "]" in line:
                body = line.split("]", 1)[0]
                rows += [s.strip().strip("'\"") for s in body.split(",") if s.strip()]
                sprites[mid]["frames"][frame] = rows
                frame = None
            else:
                rows += [s.strip().strip("'\"") for s in line.split(",") if s.strip()]
    return sprites


def render_32(sp, frame="idle0"):
    pal, rows = sp["pal"], sp["frames"][frame]
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            i = DIGITS.find(ch)
            if i <= 0 or i >= len(pal):
                continue
            hx = pal[i].lstrip("#")
            if len(hx) == 8:
                r, g, b, a = int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), int(hx[6:8], 16)
            else:
                r, g, b = int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16)
                a = 255
            if a >= 128:
                px[x, y] = (r, g, b, a)
    return im


def on_paper(im, size):
    big = im.resize((size, size), Image.NEAREST)
    bg = Image.new("RGBA", (size, size), PAPER)
    bg.alpha_composite(big)
    return bg.convert("RGB")


def font(size):
    return ImageFont.truetype(FONT_TTC, size, index=3)


def make_samples():
    OUT.mkdir(parents=True, exist_ok=True)
    atlas = parse_atlas_32()
    results = []
    for sid, zh, en, gif, atlas_id, complexity in SAMPLES:
        a32 = render_32(atlas[atlas_id])
        orig, base, src = make_base(sid, gif, a32)
        grid16 = None
        if sid != "lunamon":
            grid16 = extract_16_from_dmc48(knock(R.gif_frames(REF / gif)[0]))
        refined = refine(sid, base, grid16, complexity)
        # sanity: bbox should match base (silhouette / placement)
        bb, br = base.getbbox(), refined.getbbox()
        results.append((sid, zh, en, orig, base, refined, src, complexity, bb, br))
        orig.save(OUT / f"{sid}_orig.png")
        base.save(OUT / f"{sid}_base.png")
        refined.save(OUT / f"{sid}.png")
        on_paper(orig, 192).save(OUT / f"{sid}_orig_x.png")
        on_paper(base, 192).save(OUT / f"{sid}_base_x.png")
        on_paper(refined, 192).save(OUT / f"{sid}_x3.png")
        print(f"{sid:18} {complexity:8} base={bb}  ref={br}  {src}")
    return results


def make_sheet(results):
    """One row per monster: original dot | clean upscale base | refined 64."""
    cols = 3
    tile, label_h, pair_gap = 192, 28, 12
    name_w = 200
    margin, title_h, footer_h = 28, 80, 40
    col_w = tile + pair_gap
    row_h = label_h + tile + 8
    W = margin * 2 + name_w + cols * col_w
    H = title_h + len(results) * row_h + footer_h + margin
    im = Image.new("RGB", (W, H), (236, 233, 224))
    dr = ImageDraw.Draw(im)
    f1, f2, f3, f4 = font(22), font(13), font(12), font(11)
    title = "64×64 畫法：官方點陣整數放大為底，再只在需要處精修"
    sub = "三欄皆以 192 px 顯示。左：原始官方點陣　中：整數放大底稿（剪影與比例完全相同）　右：64 精修（簡單角色幾乎只修眼與轉角；複雜角色才加甲、武器等小細節）"
    dr.text((margin, 16), title, fill=(32, 28, 24), font=f1)
    dr.text((margin, 46), sub, fill=(80, 72, 64), font=f2)
    caps = ("原始點陣", "整數放大底稿", "64 精修")
    for i, (sid, zh, en, orig, base, refined, src, complexity, bb, br) in enumerate(results):
        y0 = title_h + i * row_h
        tag = "複雜・可加細節" if complexity == "complex" else "簡單・最少改動"
        dr.text((margin, y0 + 8), f"{zh}", fill=(28, 24, 20), font=f2)
        dr.text((margin, y0 + 28), f"{en}", fill=(90, 82, 74), font=f4)
        dr.text((margin, y0 + 46), tag, fill=(120, 90, 50) if complexity == "complex" else (90, 110, 90), font=f4)
        imgs = (on_paper(orig, 192), on_paper(base, 192), on_paper(refined, 192))
        for k, (pic, cap) in enumerate(zip(imgs, caps)):
            x = margin + name_w + k * col_w
            im.paste(pic, (x, y0))
            dr.rectangle((x, y0, x + tile - 1, y0 + tile - 1), outline=(200, 196, 186))
            dr.text((x, y0 + tile + 2), cap, fill=(110, 100, 90), font=f4)
    foot = "尚未轉換全名冊。底稿必須是官方點陣的整數倍放大（16×4 或 32×2）；精修不得改剪影或比例。"
    dr.text((margin, H - footer_h), foot, fill=(90, 82, 74), font=f3)
    im.save(SHEET)
    print("wrote", SHEET, im.size)
    return im


def parse_icon(atlas, mid):
    return render_32(atlas[mid]).crop((0, 0, 16, 16))


def draw_playfield(pet64, atlas, name_zh, name_en, logical=(512, 320), scale=3):
    W, H = logical
    sx, sy = W / 256, H / 160
    im = Image.new("RGB", (W, H), (27, 74, 66))
    dr = ImageDraw.Draw(im, "RGBA")
    for y in range(H):
        t = y / (H - 1)
        if t < 0.55:
            u = t / 0.55
            c = (int(36 + (27 - 36) * u), int(92 + (74 - 92) * u), int(82 + (66 - 82) * u))
        else:
            u = (t - 0.55) / 0.45
            c = (int(27 + (18 - 27) * u), int(74 + (56 - 74) * u), int(66 + (48 - 66) * u))
        dr.line((0, y, W, y), fill=c)
    d = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(d)
    for y in range(0, H, 2):
        dd.line((0, y, W, y), fill=(0, 0, 0, 20))
    im = Image.alpha_composite(im.convert("RGBA"), d)
    dr = ImageDraw.Draw(im, "RGBA")
    fy = int(124 * sy)
    dr.rectangle((0, fy, W, H), fill=(14, 42, 36, 255))
    dr.rectangle((0, fy, W, fy + max(2, int(2 * sy))), fill=(46, 122, 104, 255))
    mh = int(22 * sy)
    dr.rectangle((0, 0, W, mh), fill=(12, 32, 28, 255))
    icons = [
        "icon_status", "icon_food", "icon_train", "icon_battle",
        "icon_flush", "icon_lights", "icon_medicine", "icon_settings",
    ]
    x = int(4 * sx)
    iscale = max(1, round(sx))
    for i, iid in enumerate(icons):
        icon = parse_icon(atlas, iid).resize((16 * iscale, 16 * iscale), Image.NEAREST)
        if i == 0:
            dr.rectangle((x - iscale, int(1 * sy), x + 16 * iscale + iscale,
                          int(1 * sy) + 16 * iscale + 2 * iscale), fill=(232, 196, 92, 255))
        im.paste(icon, (x, int(3 * sy)), icon)
        x += int(20 * sx)
    f = font(max(10, int(10 * sy)))
    dr.text((W - int(6 * sx), int(3 * sy)), "00:12", fill=(215, 240, 200, 255), font=f, anchor="ra")
    dr.text((int(166 * sx), int(3 * sy)), "×60", fill=(232, 196, 92, 255), font=f)
    sw = 64 * scale
    mx, my = (W - sw) // 2, int(28 * sy)
    pet = pet64.resize((sw, sw), Image.NEAREST)
    im.alpha_composite(pet, (mx, my))
    ny = int(142 * sy)
    dr.rectangle((0, ny, W, H), fill=(8, 20, 16, 180))
    fn = font(max(12, int(11 * sy)))
    dr.text((int(8 * sx), ny + int(4 * sy)), f"{name_zh}    {name_en}", fill=(232, 224, 208, 255), font=fn)
    return im.convert("RGB")


def make_ingame(results):
    atlas = parse_atlas_32()
    pet = next(r[5] for r in results if r[0] == "agumon")
    play = draw_playfield(pet, atlas, "亞古獸", "Agumon", (512, 320), 3)
    play.save(OUT / "playfield-512x320.png")
    PW, PH = 844, 390
    canvas = Image.new("RGB", (PW, PH), (12, 21, 32))
    dr = ImageDraw.Draw(canvas)
    pad_x, pad_y = 18, 8
    dr.rounded_rectangle((pad_x, pad_y, PW - pad_x, PH - pad_y), radius=26, fill=(28, 48, 72))
    dr.rounded_rectangle((pad_x + 3, pad_y + 3, PW - pad_x - 3, PH - pad_y - 3), radius=24, fill=(22, 40, 62))
    ft = font(11)
    title_y = pad_y + 8
    dr.text((PW // 2, title_y), "DIGITAL MONSTER", fill=(232, 196, 92), font=ft, anchor="mt")
    btn_d, btn_cy = 40, PH - pad_y - 10 - 20
    colors = [(196, 76, 60), (212, 164, 48), (58, 136, 196)]
    bx0, gap_b, fb = PW // 2 - 64, 64, font(13)
    for i, (col, lab) in enumerate(zip(colors, "ABC")):
        cx = bx0 + i * gap_b
        dr.ellipse((cx - btn_d // 2, btn_cy - btn_d // 2, cx + btn_d // 2, btn_cy + btn_d // 2), fill=col)
        dr.text((cx, btn_cy), lab, fill=(30, 18, 16), font=fb, anchor="mm")
    bezel = 6
    top, bot = title_y + 16, btn_cy - btn_d // 2 - 8
    left, right = pad_x + 22, PW - pad_x - 22
    avail_w, avail_h = right - left, bot - top
    ar = 512 / 320
    if avail_w / avail_h > ar:
        sh, sw = avail_h, int(avail_h * ar)
    else:
        sw, sh = avail_w, int(avail_w / ar)
    sx0 = (left + right - sw) // 2
    sy0 = top + (avail_h - sh) // 2
    dr.rounded_rectangle((sx0 - bezel, sy0 - bezel, sx0 + sw + bezel, sy0 + sh + bezel),
                         radius=6, fill=(14, 28, 26))
    canvas.paste(play.resize((sw, sh), Image.NEAREST), (sx0, sy0))
    cap = font(10)
    dr.text((PW // 2, PH - 7),
            "844×390 視窗  ·  邏輯 512×320  ·  精靈 64×64 @3×（官方點陣整數放大＋少量精修）",
            fill=(138, 154, 170), font=cap, anchor="mb")
    canvas.save(INGAME)
    print("wrote", INGAME, canvas.size)
    return canvas


def main():
    results = make_samples()
    make_sheet(results)
    make_ingame(results)
    print("done")


if __name__ == "__main__":
    main()
