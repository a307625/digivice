#!/usr/bin/env python3
"""Redo designed pose frames: ingest official DM20 artbook color cells, then
hand-style 16-grid redraws of remaining poses using official DMC/PenC templates.
Official color cells are used as-is. Existing official color idles (e.g. Meicoomon
wiki extract) are kept. Colorized mono idles are replaced when an official color
artbook cell exists.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_official_poses as B

ROOT = Path("/workspace/digivice")
JS_PATH = ROOT / "js" / "sprites.js"
ARTBOOK = ROOT / "ref" / "tsr" / "dm20_ver20th.png"
ART_DIR = ROOT / "ref" / "art"
CACHE = Path("/tmp/pass8")
CACHE.mkdir(parents=True, exist_ok=True)
MAP = json.loads((ROOT / "ref" / "mapping.json").read_text())
WIKI = ROOT / "ref" / "wikimon"

GAME_KEYS = [
    "idle0", "idle1", "eat0", "eat1", "happy", "angry", "refuse",
    "sleep0", "sleep1", "attack", "hurt", "hurt0", "hurt1", "hatch",
]
ALIAS = {"eat": "eat1", "sleep": "sleep0", "hurt": "hurt0"}
POSES_FOR_SHEET = [
    "idle0", "idle1", "eat0", "eat1", "happy", "angry", "refuse",
    "sleep0", "sleep1", "attack", "hurt",
]

# Right-column filtered rows of the DM20 artbook sheet (visual confirmation).
ARTBOOK_RIGHT = {
    3: "pinochimon", 12: "plotmon", 18: "kingetemon", 20: "titamon",
    21: "sakumon", 22: "sakuttomon", 23: "zubamon", 24: "zubaeagermon",
    25: "duramon", 26: "durandamon", 27: "hackmon", 28: "baohackmon",
    29: "saviorhackmon", 30: "jesmon", 31: "petitmon", 32: "babydmon",
    33: "dracomon", 34: "coredramon_blue", 35: "wingdramon",
    36: "slayerdramon", 37: "coredramon_green", 38: "groundramon",
    39: "breakdramon", 40: "coronamon", 41: "firamon", 42: "flaremon",
    43: "apollomon", 44: "lunamon", 45: "lekismon", 46: "crescemon",
    47: "dianamon", 48: "dodomon", 49: "dorimon", 50: "dorumon",
    51: "dorugamon", 52: "doruguremon", 53: "alphamon", 54: "meicoomon",
    55: "meicrackmon", 56: "rasielmon", 59: "examon", 60: "gracenovamon",
}

# Body plans for designed poses (official artbook cells still win when present).
EGGS = {
    "egg_v1", "egg_v2", "egg_v3", "egg_v4", "egg_v5",
    "egg_zuba", "egg_hack", "egg_dra_blue", "egg_dra_green", "egg_doru",
    "egg_anime_agumon", "egg_anime_gabumon", "egg_corona", "egg_luna", "egg_meicoo",
}
BABIES = {
    "sakumon", "petitmon", "babydmon", "dodomon", "dorimon", "pukamon",
    "plotmon", "sakuttomon",
}
QUADS = {
    "dorumon", "dorugamon", "firamon", "meicoomon",
}
# Everyone else among the 59 is a biped and uses the official DMC crib + head.


def body_plan(mid: str) -> str:
    if mid in EGGS:
        return "egg"
    if mid in BABIES:
        return "baby"
    if mid in QUADS:
        return "quad"
    return "biped"


def rgba(im: Image.Image) -> Image.Image:
    return im.convert("RGBA")


def ink_mask(im: Image.Image) -> np.ndarray:
    a = np.array(rgba(im))
    return a[:, :, 3] > 20


def tight_bbox(mask: np.ndarray):
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return (0, 0, mask.shape[1], mask.shape[0])
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def shift_im(im: Image.Image, dx: int, dy: int) -> Image.Image:
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (dx, dy), im)
    return out


def clear_box(im: Image.Image, box, pad=0) -> Image.Image:
    out = rgba(im).copy()
    px = out.load()
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.size[0], x1 + pad), min(im.size[1], y1 + pad)
    for y in range(y0, y1):
        for x in range(x0, x1):
            px[x, y] = (0, 0, 0, 0)
    return out


def blit(dst: Image.Image, src: Image.Image, xy) -> Image.Image:
    dst.paste(src, xy, src)
    return dst


def pal_colors(im: Image.Image):
    """Return (outline, shadows, bases, highlights) lists of RGBA tuples."""
    a = np.array(rgba(im))
    mask = a[:, :, 3] > 20
    cols = [tuple(int(v) for v in p) for p in a[mask]]
    if not cols:
        return (0, 0, 0, 255), [], [(200, 200, 200, 255)], []
    uniq = {}
    for c in cols:
        uniq[c] = uniq.get(c, 0) + 1
    def luma(c):
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    def chroma(c):
        return max(c[0], c[1], c[2]) - min(c[0], c[1], c[2])
    items = sorted(uniq, key=lambda c: luma(c))
    outline = items[0]
    # prefer a dark low-ish luma as outline
    for c in items:
        if luma(c) < 55:
            outline = c
            break
    dark, mid, hi = [], [], []
    for c in items:
        if c == outline:
            continue
        L = luma(c)
        if L < 80:
            dark.append(c)
        elif L < 180:
            mid.append(c)
        else:
            hi.append(c)
    if not mid:
        mid = dark or hi or [outline]
    return outline, dark, mid, hi


def darkest(im: Image.Image):
    outline, dark, mid, hi = pal_colors(im)
    return outline


def to16(im32: Image.Image) -> Image.Image:
    return B.down_scale(rgba(im32), 2)


def to32(im16: Image.Image) -> Image.Image:
    return rgba(im16).resize((32, 32), Image.Resampling.NEAREST)


# ---------- head / part extraction (16px) ----------

def head_box(mask: np.ndarray):
    x0, y0, x1, y1 = tight_bbox(mask)
    h = y1 - y0
    w = x1 - x0
    if h < 3 or w < 3:
        return (x0, y0, x1, y1)
    widths = []
    for y in range(y0, y1):
        widths.append(int(mask[y, x0:x1].sum()))
    upper_n = max(2, int(len(widths) * 0.62))
    peak = int(np.argmax(widths[:upper_n]))
    neck = peak + 1
    best = widths[peak]
    limit = min(len(widths) - 1, peak + max(2, int(len(widths) * 0.42)))
    for i in range(peak + 1, limit + 1):
        if widths[i] < best:
            best = widths[i]
            neck = i
        elif widths[i] > best + 1 and i > peak + 2:
            break
    hy1 = min(y1, y0 + max(neck + 1, int(h * 0.38)))
    # keep at least ~35% and at most 65% of height
    hy1 = min(y0 + int(h * 0.68), max(hy1, y0 + max(3, int(h * 0.35))))
    sub = mask[y0:hy1, :]
    ys, xs = np.where(sub)
    if len(xs) == 0:
        return (x0, y0, x1, y0 + max(3, int(h * 0.45)))
    return int(xs.min()), y0, int(xs.max()) + 1, hy1


def close_eyes(im: Image.Image, src_idle: Image.Image) -> Image.Image:
    """Replace eye-like mid-dark pixels in the head with a short closed-eye line."""
    out = rgba(im).copy()
    mask = ink_mask(out)
    if mask.sum() < 4:
        return out
    hb = head_box(mask)
    outline, dark, mid, hi = pal_colors(src_idle)
    a = np.array(out)
    hx0, hy0, hx1, hy1 = hb
    # search for compact mid-dark clusters (eyes) in the mid-left of the head
    region = a[hy0:hy1, hx0:hx1]
    if region.size == 0:
        return out
    luma = 0.2126 * region[:, :, 0] + 0.7152 * region[:, :, 1] + 0.0722 * region[:, :, 2]
    alpha = region[:, :, 3] > 20
    # eye candidates: darker than fill, lighter than outline, compact
    ol = 0.2126 * outline[0] + 0.7152 * outline[1] + 0.0722 * outline[2]
    eye = alpha & (luma > ol + 8) & (luma < 110)
    # if we found some, draw a 2-wide horizontal line at their median y
    ys, xs = np.where(eye)
    px = out.load()
    if len(ys) >= 1:
        ey = hy0 + int(np.median(ys))
        ex = hx0 + int(np.median(xs))
    else:
        ey = hy0 + int((hy1 - hy0) * 0.45)
        ex = hx0 + int((hx1 - hx0) * 0.35)
    # only draw on existing ink so we don't float a line in empty space
    line_w = 2 if (hx1 - hx0) <= 8 else 3
    for dx in range(-line_w + 1, 1):
        x, y = ex + dx, ey
        if 0 <= x < out.size[0] and 0 <= y < out.size[1] and px[x, y][3] > 20:
            px[x, y] = outline[:3] + (255,)
        # also the pixel just above/below if they were eye-like (flatten to a slit)
        if 0 <= x < out.size[0] and 0 <= y - 1 < out.size[1]:
            if eye.any() and (y - 1 - hy0) < eye.shape[0] and (x - hx0) < eye.shape[1]:
                if eye[y - 1 - hy0, x - hx0]:
                    # restore toward neighboring fill
                    if mid:
                        px[x, y - 1] = mid[0][:3] + (255,)
    return out


def open_mouth(im: Image.Image, src_idle: Image.Image, wide=False) -> Image.Image:
    out = rgba(im).copy()
    mask = ink_mask(out)
    if mask.sum() < 4:
        return out
    hb = head_box(mask)
    outline, dark, mid, hi = pal_colors(src_idle)
    mouth = (0, 0, 0, 255) if True else outline
    # prefer a near-black already in the palette
    a = np.array(src_idle)
    m = a[:, :, 3] > 20
    if m.any():
        cols = [tuple(int(v) for v in p) for p in a[m]]
        blackish = [c for c in cols if c[0] < 30 and c[1] < 30 and c[2] < 30]
        if blackish:
            mouth = blackish[0]
        else:
            mouth = outline
    px = out.load()
    hx0, hy0, hx1, hy1 = hb
    # snout is the left side of a left-facing head
    mx = hx0 + max(1, int((hx1 - hx0) * 0.28))
    my = hy0 + int((hy1 - hy0) * 0.58)
    ww, hh = (3, 3) if wide else (2, 2)
    # carve a mouth hole, keep a 1px outline around it when possible
    for dy in range(-(hh // 2), hh - hh // 2):
        for dx in range(0, ww):
            x, y = mx + dx, my + dy
            if 0 <= x < out.size[0] and 0 <= y < out.size[1] and px[x, y][3] > 20:
                px[x, y] = mouth[:3] + (255,)
    # slight jaw drop: copy a row under the mouth down 1px if empty
    jy = my + (hh - hh // 2)
    if 0 <= jy < out.size[1] - 1:
        for dx in range(0, ww + 1):
            x = mx + dx
            if 0 <= x < out.size[0] and px[x, jy][3] > 20 and px[x, jy + 1][3] <= 20:
                px[x, jy + 1] = outline[:3] + (255,)
    return out


def raise_arms(im: Image.Image, dy=-2) -> Image.Image:
    """Shift mid-height side protrusions (arms) upward a little."""
    mask = ink_mask(im)
    if mask.sum() < 4:
        return im
    x0, y0, x1, y1 = tight_bbox(mask)
    h = y1 - y0
    # mid belt
    y_a, y_b = y0 + int(h * 0.30), y0 + int(h * 0.70)
    # left and right 20% strips
    w = x1 - x0
    bands = [(x0, x0 + max(1, int(w * 0.28))), (x1 - max(1, int(w * 0.28)), x1)]
    out = rgba(im).copy()
    a = np.array(out)
    for bx0, bx1 in bands:
        sub = mask[y_a:y_b, bx0:bx1]
        if sub.sum() < 2:
            continue
        piece = out.crop((bx0, y_a, bx1, y_b))
        # clear original
        a[y_a:y_b, bx0:bx1] = 0
        out = Image.fromarray(a)
        out.paste(piece, (bx0, y_a + dy), piece)
        a = np.array(out)
    return out


# ---------- official bed stamp ----------

def extract_bed(ag_sleep16: Image.Image) -> Image.Image:
    a = np.array(rgba(ag_sleep16))
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    # Agumon head is yellow/gold; bed is grey-blue / white / cyan
    yellow = (r.astype(int) > g.astype(int) + 15) & (r.astype(int) > b.astype(int) + 10) & (r > 80)
    # also drop very dark outline pixels that belong to the head (upper area)
    keep = (al > 20) & ~yellow
    # only keep lower portion (the crib)
    keep[:7, :] = False
    out = a.copy()
    out[~keep] = 0
    # drop isolated pixels in the upper remaining
    return Image.fromarray(out)


def biped_sleep(im16: Image.Image, bed: Image.Image, src_idle: Image.Image, breath=0) -> Image.Image:
    mask = ink_mask(im16)
    hb = head_box(mask)
    head = close_eyes(im16.crop(hb), src_idle)
    if breath:
        head = shift_im(head, breath, 0)
    out = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    out.paste(bed, (0, 0), bed)
    bmask = ink_mask(bed)
    bys, _ = np.where(bmask)
    bed_top = int(bys.min()) if len(bys) else 8
    hy = bed_top - head.size[1] + 2
    # prefer slightly left, like official Agumon/Greymon
    hx = 2
    if hy < 0:
        # trim a bit of empty top of the head crop, or shift bed is not allowed — clip head from top
        trim = min(-hy, max(0, head.size[1] - 4))
        if trim:
            head = head.crop((0, trim, head.size[0], head.size[1]))
        hy = 0
    if hx + head.size[0] > 16:
        hx = max(0, 16 - head.size[0])
    if hy + head.size[1] > 16:
        hy = max(0, 16 - head.size[1])
    out.paste(head, (hx, hy), head)
    return out


def quad_sleep(im16: Image.Image, src_idle: Image.Image, breath=0) -> Image.Image:
    """Gabumon-style huddled rest: settle down, tuck the head, close the eyes. No full-sprite rotate."""
    im = close_eyes(im16, src_idle)
    mask = ink_mask(im)
    if mask.sum() < 4:
        return shift_im(im, 0, 1)
    hb = head_box(mask)
    head = im.crop(hb)
    body = clear_box(im, hb, pad=0)
    # sit down
    body = shift_im(body, 0, 1)
    hx = hb[0] + (1 if breath else 0)
    hy = hb[1] + 2
    if hx + head.size[0] > 16:
        hx = max(0, 16 - head.size[0])
    if hy + head.size[1] > 16:
        hy = max(0, 16 - head.size[1])
    hx = max(0, hx)
    hy = max(0, hy)
    body.paste(head, (hx, hy), head)
    return body


def baby_sleep(im16: Image.Image, src_idle: Image.Image, breath=0) -> Image.Image:
    """Official Koromon-style: same blob, settled lower, closed eyes. No rotation."""
    im = close_eyes(im16, src_idle)
    im = shift_im(im, breath, 1)
    return im


def egg_variant(im16: Image.Image, kind: str) -> Image.Image:
    outline, dark, mid, hi = pal_colors(im16)
    out = rgba(im16).copy()
    if kind == "idle1":
        return shift_im(out, 1, 0)
    if kind == "sleep0":
        return shift_im(out, 0, 1)
    if kind == "sleep1":
        return shift_im(out, 1, 1)
    if kind == "refuse":
        return shift_im(out, 1, 0)
    if kind == "happy":
        return shift_im(out, 0, -1)
    if kind == "angry":
        return shift_im(out, 0, 1)
    if kind == "attack":
        return shift_im(out, -1, 0)
    if kind == "hurt" or kind == "hurt0":
        return shift_im(out, 1, 1)
    if kind == "hurt1":
        return shift_im(out, 0, 1)
    if kind in ("eat0", "eat1"):
        return shift_im(out, 0, 0 if kind == "eat0" else 1)
    if kind == "hatch":
        # crack lines across the egg, official-style (dark outline streaks)
        px = out.load()
        w, h = out.size
        mask = ink_mask(out)
        x0, y0, x1, y1 = tight_bbox(mask)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        # zigzag crack from top to mid, then a short branch
        pts = []
        x, y = cx, y0
        while y < cy + 1 and y < h:
            pts.append((x, y))
            y += 1
            x += 1 if (y - y0) % 3 == 1 else (-1 if (y - y0) % 3 == 2 else 0)
        for (x, y) in pts:
            if 0 <= x < w and 0 <= y < h and px[x, y][3] > 20:
                px[x, y] = outline[:3] + (255,)
            # a slightly offset parallel chip
            if 0 <= x + 1 < w and 0 <= y < h and px[x + 1, y][3] > 20 and mid:
                # leave a tiny gap / highlight next to the crack
                pass
        # short branch
        if pts:
            bx, by = pts[len(pts) // 2]
            for k in range(3):
                x, y = bx + k, by + (k // 2)
                if 0 <= x < w and 0 <= y < h and px[x, y][3] > 20:
                    px[x, y] = outline[:3] + (255,)
        return out
    return out


def refuse_pose(im16: Image.Image, src_idle: Image.Image) -> Image.Image:
    """Head bowed / turned away, body slightly hunched. Official Agumon refuse."""
    mask = ink_mask(im16)
    if mask.sum() < 4:
        return im16
    hb = head_box(mask)
    head = im16.crop(hb)
    body = clear_box(im16, hb, pad=0)
    # hunch: shift body down 1
    body = shift_im(body, 0, 1)
    # bow head: down 2, slightly back (right) — looking down/away
    hx, hy = hb[0] + 1, hb[1] + 2
    out = body
    if hx + head.size[0] > 16:
        hx = 16 - head.size[0]
    if hy + head.size[1] > 16:
        hy = 16 - head.size[1]
    hx = max(0, hx)
    hy = max(0, hy)
    out.paste(head, (hx, hy), head)
    return out


def happy_pose(im16: Image.Image, src_idle: Image.Image) -> Image.Image:
    """Slight lift + open mouth + raised arms (official-style cheerful, not a huge jump)."""
    im = shift_im(im16, 0, -1)
    im = raise_arms(im, dy=-1)
    im = open_mouth(im, src_idle, wide=True)
    return im


def angry_pose(im16: Image.Image, src_idle: Image.Image) -> Image.Image:
    """Lowered stance + a frown brow."""
    im = shift_im(im16, 0, 1)
    outline, dark, mid, hi = pal_colors(src_idle)
    mask = ink_mask(im)
    if mask.sum() < 4:
        return im
    hb = head_box(mask)
    px = im.load()
    # brow: a short dark line above typical eye
    ex = hb[0] + int((hb[2] - hb[0]) * 0.35)
    ey = hb[1] + int((hb[3] - hb[1]) * 0.32)
    for dx in range(0, 3):
        x, y = ex + dx, ey
        if 0 <= x < 16 and 0 <= y < 16 and px[x, y][3] > 20:
            px[x, y] = outline[:3] + (255,)
    return im


def attack_pose(im16: Image.Image, src_idle: Image.Image) -> Image.Image:
    """Lunge forward, mouth open."""
    im = shift_im(im16, -2, 0)
    im = open_mouth(im, src_idle, wide=True)
    return im


def hurt_pose(im16: Image.Image, src_idle: Image.Image, slump=1) -> Image.Image:
    """Slumped, head slightly drooped."""
    mask = ink_mask(im16)
    if mask.sum() < 4:
        return shift_im(im16, 0, slump)
    hb = head_box(mask)
    head = im16.crop(hb)
    body = clear_box(im16, hb, pad=0)
    body = shift_im(body, 0, slump)
    hx, hy = hb[0] + (1 if slump else 0), hb[1] + slump + 1
    if hx + head.size[0] > 16:
        hx = max(0, 16 - head.size[0])
    if hy + head.size[1] > 16:
        hy = max(0, 16 - head.size[1])
    hx = max(0, hx)
    hy = max(0, hy)
    body.paste(head, (hx, hy), head)
    return body


def walk_pose(im16: Image.Image) -> Image.Image:
    """Weight shift: move the lower (leg) portion one pixel, official walk style."""
    mask = ink_mask(im16)
    if mask.sum() < 4:
        return shift_im(im16, 1, 0)
    x0, y0, x1, y1 = tight_bbox(mask)
    split = y0 + int((y1 - y0) * 0.62)
    legs = im16.crop((0, split, 16, 16))
    top = im16.crop((0, 0, 16, split))
    out = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    out.paste(top, (0, 0), top)
    # step: shift legs 1px left (forward)
    out.paste(legs, (-1, split), legs)
    return out


def eat_pose(im16: Image.Image, src_idle: Image.Image, chew=False) -> Image.Image:
    im = open_mouth(im16, src_idle, wide=not chew)
    if chew:
        im = shift_im(im, 0, 0)  # same stance, slightly smaller mouth already
    return im


# ---------- artbook parse ----------

def parse_artbook_rows():
    im = Image.open(ARTBOOK).convert("RGBA")
    a = np.array(im)
    H, W = a.shape[:2]
    alp = a[:, :, 3]
    rgb = a[:, :, :3].astype(int)
    white = (rgb[:, :, 0] >= 250) & (rgb[:, :, 1] >= 250) & (rgb[:, :, 2] >= 250) & (alp > 200)
    ink = (alp > 200) & ~white
    LEFT_X = [94, 114, 134, 154]
    RIGHT_X = [504, 524, 544, 564]
    CELL = 16

    def bands_in(x0, x1):
        rows = np.where(ink[:, x0:x1].any(axis=1))[0]
        bands = []
        if len(rows) == 0:
            return bands
        s = int(rows[0])
        prev = s
        for y in rows[1:]:
            if y > prev + 4:
                bands.append((s, prev + 1))
                s = int(y)
            prev = int(y)
        bands.append((s, prev + 1))
        return bands

    def filt(bands, xs):
        out = []
        for y0, y1 in bands:
            h = y1 - y0
            n = 0
            for x in xs:
                tile = a[y0:y1, x:x + CELL]
                ch = np.abs(tile[:, :, 0].astype(int) - tile[:, :, 1].astype(int)).sum()
                opa = (tile[:, :, 3] > 200) & ~((tile[:, :, 0] >= 250) & (tile[:, :, 1] >= 250) & (tile[:, :, 2] >= 250))
                if opa.sum() >= 6 and ch >= 40:
                    n += 1
            if n >= 3 and 10 <= h <= 20:
                out.append((y0, y1, n, h))
        return out

    rb = filt(bands_in(504, 580), RIGHT_X)
    return im, H, rb, RIGHT_X


def cell16_from_band(sheet: Image.Image, x: int, y0: int, y1: int, H: int) -> Image.Image:
    h = min(16, y1 - y0, H - y0)
    crop = sheet.crop((x, y0, x + 16, y0 + h))
    canvas = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    # bottom-align when the band is short (feet on the 16-grid floor)
    top = 16 - h if h < 16 else 0
    canvas.paste(crop, (0, top))
    return canvas


def mask_iou(a: Image.Image, b: Image.Image) -> float:
    m1, m2 = ink_mask(a), ink_mask(b)
    if m1.shape != m2.shape:
        return 0.0
    inter = np.logical_and(m1, m2).sum()
    uni = np.logical_or(m1, m2).sum()
    return float(inter / uni) if uni else 0.0


def is_lying(im16: Image.Image) -> bool:
    """True only for a clearly flattened/horizontal rest (e.g. Petitmon ab3), not a hunched stand."""
    m = ink_mask(im16)
    if not m.any():
        return False
    x0, y0, x1, y1 = tight_bbox(m)
    w, h = x1 - x0, y1 - y0
    # must sit in the lower half and be distinctly wider than tall
    return y0 >= 4 and h <= 10 and w >= h * 1.4 and w >= 8


def _has_face_mouth(im16: Image.Image) -> bool:
    """Large dark or saturated-red hole in the head (official open-mouth cell)."""
    m = ink_mask(im16)
    if not m.any():
        return False
    hb = head_box(m)
    a = np.array(rgba(im16))
    head = a[hb[1]:hb[3], hb[0]:hb[2]]
    if head.size == 0:
        return False
    al = head[:, :, 3] > 20
    luma = 0.2126 * head[:, :, 0] + 0.7152 * head[:, :, 1] + 0.0722 * head[:, :, 2]
    dark = al & (luma < 55)
    red = al & (head[:, :, 0] > head[:, :, 1] + 40) & (head[:, :, 0] > head[:, :, 2] + 20)
    return int(dark.sum()) >= 4 or int(red.sum()) >= 4


def has_open_mouth_look(im16: Image.Image, idle16: Image.Image) -> bool:
    """True only when slot2 is a same-stance open-mouth (eat), not a lunge/weapon attack."""
    m = ink_mask(im16)
    mi = ink_mask(idle16)
    if not m.any() or not mi.any():
        return False
    # stance should still match idle closely; attacks diverge
    if mask_iou(to32(im16), to32(idle16)) < 0.78:
        return False
    x0, y0, x1, y1 = tight_bbox(m)
    ix0, iy0, ix1, iy1 = tight_bbox(mi)
    if (x1 - x0) > (ix1 - ix0) + 2:
        return False
    hb = head_box(m)
    a = np.array(rgba(im16))
    head = a[hb[1]:hb[3], hb[0]:hb[2]]
    if head.size == 0:
        return False
    luma = 0.2126 * head[:, :, 0] + 0.7152 * head[:, :, 1] + 0.0722 * head[:, :, 2]
    hole = (head[:, :, 3] > 20) & (luma < 40)
    # idle head hole count — only count NEW darkness
    ai = np.array(rgba(idle16))
    hbi = head_box(mi)
    headi = ai[hbi[1]:hbi[3], hbi[0]:hbi[2]]
    hole_i = 0
    if headi.size:
        lumai = 0.2126 * headi[:, :, 0] + 0.7152 * headi[:, :, 1] + 0.0722 * headi[:, :, 2]
        hole_i = int(((headi[:, :, 3] > 20) & (lumai < 40)).sum())
    return int(hole.sum()) >= hole_i + 3


# ---------- coverage helpers ----------

def kind_of(cov_mon, key, default="designed"):
    if not cov_mon:
        return default
    return cov_mon.get(key, {}).get("kind", default)


def load_names():
    text = (ROOT / "js" / "evolution-data.js").read_text()
    names = {}
    for m in re.finditer(
        r'(\w+):\s*\{\s*id:\s*"(\w+)"[^}]*?nameZh:\s*"([^"]+)"[^}]*?nameEn:\s*"([^"]+)"',
        text,
        re.S,
    ):
        names[m.group(1)] = (m.group(3), m.group(4))
    return names


def replace_entry(js_text: str, mid: str, obj: dict) -> str:
    # find the entry block `    mid: { w: 32 ... } },` or last `} }`
    pat = re.compile(rf"    {re.escape(mid)}: \{{ w: 32, h: 32, pal: \[.*?\] \}} ?", re.S)
    # frames nested — non-greedy until the closing of this object at indent 4
    # more reliable: from `    mid: { w:` to the matching `    } },` or `    } }`
    start = js_text.find(f"    {mid}: {{ w: 32")
    if start < 0:
        raise KeyError(mid)
    # find end: next `\n    other:` or `\n  };`
    nxt = re.search(r"\n    [A-Za-z_]\w*: \{ w: |\n  \};", js_text[start + 10:])
    if not nxt:
        raise KeyError("end " + mid)
    end = start + 10 + nxt.start()
    block = B.format_entry(mid, obj)
    # format_entry doesn't include trailing comma; keep one
    return js_text[:start] + block + "," + js_text[end:]


def designed_monster_ids(coverage):
    ids = []
    for mid, meta in coverage["monsters"].items():
        if any(v.get("kind") == "designed" for v in meta.values()):
            ids.append(mid)
    return ids


def find_official_dot(mid: str):
    fn = MAP.get("primary", {}).get(mid)
    if not fn:
        return None
    # try wikimon folder with various casings / underscores
    cands = list(WIKI.glob("*"))
    want = fn.lower().replace(" ", "_").replace("-", "_")
    for p in cands:
        got = p.name.lower().replace(" ", "_").replace("-", "_")
        if got == want or got.replace("__", "_") == want:
            return p
        # looser: stem
    # mapping names like 'Lunamon vpet dm.gif' vs 'Lunamon_vpet_dm.gif'
    simplified = re.sub(r"[^a-z0-9]", "", fn.lower())
    for p in cands:
        if re.sub(r"[^a-z0-9]", "", p.name.lower()) == simplified:
            return p
    return None


def first_gif_frame(path: Path) -> Image.Image:
    im = Image.open(path)
    im.seek(0)
    return rgba(im.copy())


def main():
    js_text = JS_PATH.read_text()
    existing = B.parse_existing_sprites(js_text)
    cov_path = Path("/tmp/pass7/coverage.json")
    coverage_in = json.loads(cov_path.read_text()) if cov_path.exists() else {"monsters": {}}
    designed_ids = designed_monster_ids(coverage_in)
    print("designed monsters", len(designed_ids))

    # official templates
    ag_sleep16 = to16(B.decode_entry(existing["agumon"], "sleep0"))
    bed = extract_bed(ag_sleep16)
    bed.save(CACHE / "bed16.png")

    # parse artbook
    sheet, H, right_bands, RIGHT_X = parse_artbook_rows()
    print("artbook right rows", len(right_bands))
    artbook = {}  # mid -> {slot: im32, lying/mouth flags}
    for idx, mid in ARTBOOK_RIGHT.items():
        if idx >= len(right_bands):
            print("MISSING artbook row", idx, mid)
            continue
        y0, y1, n, h = right_bands[idx]
        cells = [cell16_from_band(sheet, x, y0, y1, H) for x in RIGHT_X]
        # sanity: compare slot0 to current idle
        idle32 = B.decode_entry(existing[mid], "idle0")
        iou0 = mask_iou(to32(cells[0]), idle32)
        artbook[mid] = {
            "cells16": cells,
            "cells32": [to32(c) for c in cells],
            "iou0": iou0,
            "lying3": is_lying(cells[3]),
            "mouth2": has_open_mouth_look(cells[2], cells[0]),
            "y0": y0,
        }
        print(f"  artbook {mid:22s} iou0={iou0:.3f} lying3={artbook[mid]['lying3']} mouth2={artbook[mid]['mouth2']}")

    new_frames = {}  # mid -> {key: Image}
    new_meta = {}    # mid -> {key: {kind, src}}
    counts = Counter()

    for mid in existing:
        if mid.startswith("icon_") or mid.startswith("overlay_"):
            continue
        frs = {k: B.decode_entry(existing[mid], k) for k in existing[mid]["frames"]}
        meta = {k: dict(coverage_in.get("monsters", {}).get(mid, {}).get(k, {"kind": "kept"})) for k in frs}
        if mid not in designed_ids and mid not in artbook:
            new_frames[mid] = frs
            new_meta[mid] = meta
            for k in frs:
                counts[meta.get(k, {}).get("kind", "kept")] += 1
            continue

        # start from existing
        frames = dict(frs)
        kinds = dict(meta)
        plan = body_plan(mid)

        # --- official artbook color cells ---
        if mid in artbook:
            ab = artbook[mid]
            c0, c1, c2, c3 = ab["cells32"]
            # idle0: official color wins over colorized/kept, but do not replace
            # an already-official-color idle (Meicoomon wiki extract, etc.)
            k0 = kinds.get("idle0", {}).get("kind", "")
            def _chroma(im):
                a = np.array(rgba(im))
                m = a[:, :, 3] > 20
                if not m.any():
                    return 0.0
                return float(np.abs(a[:, :, 0].astype(int) - a[:, :, 1].astype(int))[m].mean()
                             + np.abs(a[:, :, 1].astype(int) - a[:, :, 2].astype(int))[m].mean())
            # Keep a real official COLOR idle (e.g. already-artbook). If the stored
            # "official_color" is actually a near-mono DM20 extract, official artbook
            # COLOR wins (Meicoomon wiki GIF is the mono LCD dot).
            if k0 == "official_color" and _chroma(idle32) >= 12:
                pass
            elif ab["iou0"] >= 0.45 or _chroma(ab["cells32"][0]) > _chroma(idle32) + 8:
                frames["idle0"] = c0
                kinds["idle0"] = {"kind": "official_color", "src": "dm20-artbook-slot0"}
            elif ab["iou0"] >= 0.28:
                # weaker match — still likely the same mon; use official color
                frames["idle0"] = c0
                kinds["idle0"] = {"kind": "official_color", "src": "dm20-artbook-slot0-weakiou"}
            else:
                print("  WARN low iou, not replacing idle0", mid, ab["iou0"])
            frames["idle1"] = c1
            kinds["idle1"] = {"kind": "official_color", "src": "dm20-artbook-slot1"}
            frames["attack"] = c2
            kinds["attack"] = {"kind": "official_color", "src": "dm20-artbook-slot2"}
            # use slot2 as eat when it is an open-mouth cell (same stance or a clear mouth fill)
            if ab["mouth2"] or _has_face_mouth(ab["cells16"][2]):
                frames["eat0"] = c2
                frames["eat1"] = c2
                kinds["eat0"] = {"kind": "official_color", "src": "dm20-artbook-slot2-eat"}
                kinds["eat1"] = {"kind": "official_color", "src": "dm20-artbook-slot2-eat"}
            frames["hurt"] = c3
            frames["hurt0"] = c3
            kinds["hurt"] = {"kind": "official_color", "src": "dm20-artbook-slot3"}
            kinds["hurt0"] = {"kind": "official_color", "src": "dm20-artbook-slot3"}
            # hurt1 = slight breath of official hurt, still designed from official pixels
            # keep as official if we only shift 0; we'll make a 1px variant and tag designed
            if ab["lying3"]:
                frames["sleep0"] = c3
                kinds["sleep0"] = {"kind": "official_color", "src": "dm20-artbook-slot3-sleep"}
                frames["sleep1"] = shift_im(c3, 1, 0)
                kinds["sleep1"] = {"kind": "designed", "src": "official-sleep-shift"}

        # identity source: current (possibly updated) idle
        idle32 = frames.get("idle0") or frs.get("idle0")
        if mid in artbook:
            def _ch(im):
                a = np.array(rgba(im))
                msk = a[:, :, 3] > 20
                if not msk.any():
                    return 0.0
                return float(np.abs(a[:, :, 0].astype(int) - a[:, :, 1].astype(int))[msk].mean()
                             + np.abs(a[:, :, 1].astype(int) - a[:, :, 2].astype(int))[msk].mean())
            c0 = artbook[mid]["cells32"][0]
            if _ch(idle32) < 12 and _ch(c0) >= 12:
                print("  FORCE artbook color idle0 over mono extract", mid, "chroma", round(_ch(idle32),2), "->", round(_ch(c0),2))
                frames["idle0"] = c0
                kinds["idle0"] = {"kind": "official_color", "src": "dm20-artbook-slot0-forced"}
                idle32 = c0
        idle16 = to16(idle32)
        src_idle = idle32

        def put_designed(key, im16):
            frames[key] = to32(im16)
            kinds[key] = {"kind": "designed", "src": f"redraw-{plan}"}

        # remaining designed keys
        def needs_design(key):
            k = kinds.get(key, {}).get("kind")
            if k in ("official_color", "official_mono_colorized", "official_mono"):
                return False
            return True

        if plan == "egg":
            if needs_design("idle1"):
                put_designed("idle1", egg_variant(idle16, "idle1"))
            for key, tag in [
                ("eat0", "eat0"), ("eat1", "eat1"), ("happy", "happy"),
                ("angry", "angry"), ("refuse", "refuse"),
                ("sleep0", "sleep0"), ("sleep1", "sleep1"),
                ("attack", "attack"), ("hurt", "hurt"), ("hurt0", "hurt0"),
                ("hurt1", "hurt1"), ("hatch", "hatch"),
            ]:
                if key in GAME_KEYS and needs_design(key):
                    put_designed(key, egg_variant(idle16, tag))
        else:
            if needs_design("idle1"):
                put_designed("idle1", walk_pose(idle16))
            if needs_design("eat0"):
                put_designed("eat0", eat_pose(idle16, src_idle, chew=False))
            if needs_design("eat1"):
                put_designed("eat1", eat_pose(idle16, src_idle, chew=True))
            if needs_design("happy"):
                put_designed("happy", happy_pose(idle16, src_idle))
            if needs_design("angry"):
                put_designed("angry", angry_pose(idle16, src_idle))
            if needs_design("refuse"):
                put_designed("refuse", refuse_pose(idle16, src_idle))
            if needs_design("attack"):
                put_designed("attack", attack_pose(idle16, src_idle))
            # If sleep0 is already official, don't replace the pair with a different pose.
            if kinds.get("sleep0", {}).get("kind") not in ("official_color", "official_mono_colorized", "official_mono"):
                if needs_design("sleep0") or needs_design("sleep1"):
                    if plan == "baby":
                        s0 = baby_sleep(idle16, src_idle, 0)
                        s1 = baby_sleep(idle16, src_idle, 1)
                    elif plan == "quad":
                        s0 = quad_sleep(idle16, src_idle, 0)
                        s1 = quad_sleep(idle16, src_idle, 1)
                    else:
                        s0 = biped_sleep(idle16, bed, src_idle, 0)
                        s1 = biped_sleep(idle16, bed, src_idle, 1)
                    if needs_design("sleep0"):
                        put_designed("sleep0", s0)
                    if needs_design("sleep1"):
                        put_designed("sleep1", s1)
            elif needs_design("sleep1"):
                base = frames.get("sleep0") or idle32
                frames["sleep1"] = shift_im(base, 1, 0)
                kinds["sleep1"] = {"kind": "designed", "src": "official-sleep-shift"}
            if needs_design("hurt0"):
                if "hurt" in frames and kinds.get("hurt", {}).get("kind") == "official_color":
                    # 1px variant of official hurt
                    put_designed("hurt1", to16(shift_im(frames["hurt"], 0, 0)))
                    # actually make a tiny offset at 32
                    frames["hurt1"] = shift_im(frames["hurt"], 0, 0)  # will overwrite below
                    frames["hurt1"] = shift_im(frames["hurt"], -1, 0)
                    kinds["hurt1"] = {"kind": "designed", "src": "official-hurt-shift"}
                    # hurt0 already official
                else:
                    put_designed("hurt0", hurt_pose(idle16, src_idle, 1))
                    put_designed("hurt1", hurt_pose(idle16, src_idle, 2))
                    frames["hurt"] = frames["hurt0"]
                    kinds["hurt"] = dict(kinds["hurt0"])
            elif needs_design("hurt"):
                put_designed("hurt", hurt_pose(idle16, src_idle, 1))
            if needs_design("hurt1") and "hurt1" not in frames:
                base = frames.get("hurt0") or frames.get("hurt") or idle32
                frames["hurt1"] = shift_im(base, -1, 0)
                kinds["hurt1"] = {"kind": "designed", "src": "hurt-shift"}

        # aliases
        if "eat1" in frames:
            frames["eat"] = frames["eat1"]
            kinds["eat"] = dict(kinds.get("eat1", {"kind": "designed"}))
        if "sleep0" in frames:
            frames["sleep"] = frames["sleep0"]
            kinds["sleep"] = dict(kinds.get("sleep0", {"kind": "designed"}))
        if "hurt0" in frames and "hurt" not in frames:
            frames["hurt"] = frames["hurt0"]
            kinds["hurt"] = dict(kinds.get("hurt0", {"kind": "designed"}))
        elif "hurt" in frames and "hurt0" not in frames:
            frames["hurt0"] = frames["hurt"]
            kinds["hurt0"] = dict(kinds.get("hurt", {"kind": "designed"}))

        new_frames[mid] = frames
        new_meta[mid] = kinds
        for k in frames:
            counts[kinds.get(k, {}).get("kind", "kept")] += 1

    # --- write sprites.js (replace designed/artbook mons + keep the rest) ---
    # Re-encode every monster so palette stays consistent per entry; only
    # rewrite entries we actually changed.
    changed = set(designed_ids) | set(artbook)
    text = js_text
    for mid in list(existing):
        if mid not in changed:
            continue
        if mid.startswith("icon_") or mid.startswith("overlay_"):
            continue
        enc = B.encode_sprite(new_frames[mid])
        text = replace_entry(text, mid, enc)
        print("encoded", mid, "frames", len(enc["frames"]), "pal", len(enc["pal"]))
    JS_PATH.write_text(text)
    print("wrote", JS_PATH, "bytes", JS_PATH.stat().st_size)

    # coverage
    out_cov = {"counts": dict(counts), "artbook_hits": len(artbook), "monsters": {}}
    # rebuild counts more carefully over GAME_KEYS only (no alias double-count in report later)
    key_counts = Counter()
    for mid, kinds in new_meta.items():
        out_cov["monsters"][mid] = kinds
        for k, v in kinds.items():
            if k in POSES_FOR_SHEET or k in ("hatch", "hurt0", "hurt1"):
                key_counts[v.get("kind", "kept")] += 1
    out_cov["counts_primary"] = dict(key_counts)
    (CACHE / "coverage.json").write_text(json.dumps(out_cov, indent=2, ensure_ascii=False))

    # frame-coverage.md (designed-heavy section + totals)
    names = load_names()
    lines = [
        "# Frame coverage",
        "",
        "Official color cells are used as-is (no recolor). Official monochrome cells stay colorized from earlier passes. Designed frames in this pass are 16-grid redraws using official DMC/PenC pose conventions (bed+head sleep for bipeds, lying quadruped, Koromon-style baby, egg cracks).",
        "",
        f"## Totals (primary keys)",
        "",
    ]
    for k, n in sorted(key_counts.items(), key=lambda kv: (-kv[1], kv[0])):
        lines.append(f"- `{k}`: {n}")
    lines += ["", f"Artbook official-color hits (monsters): {len(artbook)}", "", "## Designed-heavy monsters", ""]
    lines.append("| id | name | idle0 | idle1 | eat | happy | angry | refuse | sleep | attack | hurt | notes |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for mid in designed_ids:
        kinds = new_meta[mid]
        zh, en = names.get(mid, ("", mid))
        def tag(k):
            kk = kinds.get(k, kinds.get(k + "0", {})).get("kind", "")
            src = kinds.get(k, kinds.get(k + "0", {})).get("src", "")
            short = {"official_color": "官方彩色", "official_mono_colorized": "官方點陣上色", "designed": "自製", "kept_existing_idle": "既有", "kept": "既有"}.get(kk, kk)
            return short
        notes = body_plan(mid)
        if mid in artbook:
            notes += f"; artbook iou0={artbook[mid]['iou0']:.2f}"
        lines.append(
            f"| `{mid}` | {zh} {en} | {tag('idle0')} | {tag('idle1')} | {tag('eat0')} | {tag('happy')} | {tag('angry')} | {tag('refuse')} | {tag('sleep0')} | {tag('attack')} | {tag('hurt')} | {notes} |"
        )
    (ROOT / "frame-coverage.md").write_text("\n".join(lines) + "\n")
    print("wrote frame-coverage.md")

    # --- anim-sample: 8 + 8 designed-heavy ---
    sample = [
        "agumon", "omegamon", "dorumon", "lasttyranomon", "titamon", "lunamon", "kingetemon", "meicoomon",
        "hackmon", "jesmon", "zubamon", "dracomon", "alphamon", "coronamon", "petitmon", "dorugamon",
    ]
    make_anim_sample(sample, new_frames, new_meta, names, ROOT / "anim-sample.png")

    # preview designed sleeps for QA
    qa = ["dorumon", "titamon", "lunamon", "kingetemon", "lasttyranomon", "meicoomon", "hackmon", "petitmon", "pinochimon", "examon"]
    make_anim_sample(qa, new_frames, new_meta, names, CACHE / "qa-designed.png")
    print("samples written")
    print("counts_primary", dict(key_counts))
    print("counts_all", dict(counts))


def make_anim_sample(ids, frames, meta, names, path: Path):
    cols = POSES_FOR_SHEET
    scale = 3
    cell = 32 * scale
    label_w = 110
    tag_h = 16
    row_h = cell + tag_h + 8
    header = 36
    W = label_w + len(cols) * (cell + 6) + 10
    H = header + len(ids) * row_h + 8
    bg = (236, 232, 224, 255)
    sheet = Image.new("RGBA", (W, H), bg)
    dr = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
        font_s = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
    except Exception:
        font = font_s = ImageFont.load_default()
    # try CJK
    for fp in (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    ):
        if Path(fp).exists():
            try:
                font = ImageFont.truetype(fp, 11)
                font_s = ImageFont.truetype(fp, 9)
                break
            except Exception:
                pass
    dr.text((8, 6), "動畫格（來源標在每格下方：官方彩色／既有上色／自製）", fill=(40, 36, 32, 255), font=font)
    for i, k in enumerate(cols):
        x = label_w + i * (cell + 6)
        dr.text((x, 20), k if k != "idle0" else "idle0", fill=(80, 76, 70, 255), font=font_s)
    kind_zh = {
        "official_color": "官方彩色",
        "official_mono_colorized": "官方點陣上色",
        "official_mono": "官方點陣",
        "designed": "自製",
        "kept_existing_idle": "既有上色",
        "kept": "既有",
    }
    tile_bg = (250, 248, 244, 255)
    for r, mid in enumerate(ids):
        y = header + r * row_h
        zh, en = names.get(mid, ("", mid))
        dr.text((6, y + 20), zh or mid, fill=(30, 28, 24, 255), font=font)
        dr.text((6, y + 36), mid, fill=(110, 106, 100, 255), font=font_s)
        frs = frames[mid]
        kinds = meta[mid]
        for i, k in enumerate(cols):
            x = label_w + i * (cell + 6)
            tile = Image.new("RGBA", (cell, cell), tile_bg)
            im = frs.get(k) or frs.get("idle0")
            if im is not None:
                s = rgba(im).resize((cell, cell), Image.Resampling.NEAREST)
                tile = Image.alpha_composite(tile, s)
            sheet.paste(tile, (x, y))
            tag = kind_zh.get(kinds.get(k, {}).get("kind", ""), kinds.get(k, {}).get("kind", ""))
            dr.text((x, y + cell + 1), tag, fill=(90, 80, 70, 255), font=font_s)
    sheet.convert("RGB").save(path)
    print("anim-sample", path, sheet.size)


if __name__ == "__main__":
    main()
