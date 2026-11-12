#!/usr/bin/env python3
"""Hand-author designed expression frames as 16-grid pixel art (×2 to 32).

Official DMC/PenC happy is NOT a 6-pixel eye tweak on idle: Agumon idle→happy
is 56 head pixels and a 1-cell lift, with a wide snout opening and an
inverted-U eye. Koromon idle→happy is 82 pixels and a 4-cell lift, with a
huge filled mouth. Designed open mouths (child+ and Koromon-style babies)
are outlined cavities filled with official mouth red / pink, never a
transparent cut-through. Official color cells are never rewritten.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_official_poses as B
import redraw_designed_poses as R
import apply_manual_eyes as M

ROOT = Path("/workspace/digivice")
JS_PATH = ROOT / "js" / "sprites.js"
BAK = Path("/tmp/pass10/sprites.js.bak")
COV = Path("/tmp/pass8/coverage.json")
CACHE = Path("/tmp/pass10")
CACHE.mkdir(exist_ok=True)
TERO = Path("/tmp/expr")

# Groups → official analogue, lift, mouth style, tongue, baby-koromon treatment
BABY_FRONT = {"sakumon", "sakuttomon", "dodomon", "dorimon", "plotmon"}
BABY_SIDE = {"petitmon", "pukamon", "babydmon"}
BABIES = BABY_FRONT | BABY_SIDE
HUMANOID = {
    "kingetemon", "titamon", "pinochimon", "flaremon", "apollomon",
    "lekismon", "crescemon", "dianamon", "meicrackmon", "rasielmon",
    "gracenovamon", "baohackmon",
}
QUAD = {"dorumon", "dorugamon", "firamon", "meicoomon"}
VISOR = {
    "jesmon", "alphamon", "slayerdramon", "examon", "duramon", "durandamon",
    "saviorhackmon", "wingdramon", "breakdramon",
}

# Per-monster corrections to the manual table (idle 16-grid, verified).
T_FIX = {
    "pinochimon": {"mouth": (4, 6, 3, 2), "front": False},
    "lasttyranomon": {"eyes": [(5, 6)], "eye_size": (2, 2), "front": False, "mouth": (0, 8, 4, 3)},
    "babydmon": {"front": False, "eyes": [(6, 5)], "mouth": (3, 6, 3, 2)},
    "titamon": {"eyes": [(5, 7), (8, 7)], "mouth": (5, 8, 4, 2)},
    "kingetemon": {"mouth": (5, 7, 5, 2)},
    "rasielmon": {"eyes": [(6, 4), (11, 4)], "mouth": (6, 6, 4, 2)},
    "baohackmon": {"mouth": (6, 5, 4, 2)},
    "pukamon": {"mouth": (3, 5, 3, 3), "eyes": [(5, 5)]},
    "meicrackmon": {"mouth": (3, 6, 3, 3)},
    "dianamon": {"mouth": (5, 6, 4, 2), "front": True},
    "flaremon": {"front": True, "mouth": (4, 5, 4, 2)},
    "apollomon": {"front": True, "mouth": (4, 5, 4, 2)},
    "crescemon": {"front": True, "mouth": (5, 5, 3, 2)},
}

T = {k: dict(v) for k, v in M.T.items()}
for mid, fx in T_FIX.items():
    T[mid].update(fx)

EXAMPLE_FOR = {}
for mid in BABIES:
    EXAMPLE_FOR[mid] = "koromon"
for mid in HUMANOID:
    EXAMPLE_FOR[mid] = "ogremon"
for mid in QUAD:
    EXAMPLE_FOR[mid] = "garurumon"
for mid in VISOR:
    EXAMPLE_FOR[mid] = "omegamon"


def kind_of(meta, key):
    return meta.get(key, {}).get("kind", "")


def is_official(meta, key):
    return kind_of(meta, key) in ("official_color", "official_mono_colorized", "kept_existing_idle")


def designed(meta, key, frames):
    return kind_of(meta, key) == "designed" and key in frames


def frames_equal(a, b):
    aa, bb = np.array(R.rgba(a)), np.array(R.rgba(b))
    if aa.shape != bb.shape:
        return False
    ai, bi = aa[:, :, 3] >= 128, bb[:, :, 3] >= 128
    if not np.array_equal(ai, bi):
        return False
    return np.array_equal(aa[ai][:, :3], bb[ai][:, :3])


def to16(im32):
    return B.down_scale(R.rgba(im32), 2)


def to32(im16):
    return R.rgba(im16).resize((32, 32), Image.Resampling.NEAREST)


def luma(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def is_outline_color(c):
    return luma(c) < 40


def arr16(im):
    return np.array(R.rgba(im))


def fromarr(a):
    return Image.fromarray(a, "RGBA")


def shift16(im, dx, dy):
    return R.shift_im(R.rgba(im), dx, dy)


def put(a, x, y, color, only_ink=False, allow_new=False):
    if not (0 <= x < 16 and 0 <= y < 16):
        return
    if only_ink and a[y, x, 3] < 128:
        return
    if a[y, x, 3] < 128 and not allow_new:
        return
    a[y, x] = color[:4] if len(color) == 4 else color[:3] + (255,)


def clear(a, x, y):
    if 0 <= x < 16 and 0 <= y < 16:
        a[y, x] = (0, 0, 0, 0)


def group_of(mid):
    if mid in BABY_FRONT:
        return "baby_front"
    if mid in BABY_SIDE:
        return "baby_side"
    if mid in HUMANOID:
        return "humanoid"
    if mid in QUAD:
        return "quad"
    if mid in VISOR:
        return "visor"
    return "dino"


def lift_amount(mid, idle16):
    """Official: Koromon +4, Agumon +1, Ogremon 0. Don't clip a sprite that already hugs y=0."""
    g = group_of(mid)
    a = arr16(idle16)
    ink_y = [y for y in range(16) if (a[y, :, 3] >= 128).any()]
    top = ink_y[0] if ink_y else 0
    if g == "baby_front":
        want = 3
    elif g == "baby_side":
        want = 2
    elif g == "humanoid":
        want = 0  # Ogremon happy keeps the standing body, changes only the face
    else:
        want = 1
    # never lift more than `top` (keep the crest/horn on canvas)
    return max(0, min(want, top))


def is_red_pink(c):
    """True red/pink already in the sprite. Excludes gold/yellow (R and G both high)."""
    r, g, b = c[:3]
    if r < 80:
        return False
    if r <= g + 30:
        return False
    if g >= 160 and (r - g) < 80:
        return False
    return True


# Standard official mouth colors, sampled from official 32×32 DMC/PenC cells
# (Ogremon cavity/lip, Koromon tongue, Greymon/Ogremon teeth). Allowed only
# for mouth interior / lip / tongue / teeth — see expression-rules.md.
MOUTH_RED = (165, 36, 8, 255)
MOUTH_RED_DEEP = (123, 20, 0, 255)
TONGUE_PINK = (230, 174, 197, 255)
TEETH_WHITE = (248, 248, 248, 255)


def _rgb_dist(a, b):
    return (sum((int(a[i]) - int(b[i])) ** 2 for i in range(3))) ** 0.5


def pal(im16, eyes=None):
    """Idle palette stays exact for body/head. Mouth interior may use official red/pink."""
    outline, dark, mid, hi = R.pal_colors(im16)
    def pick(lst, fallback):
        return (lst[0][:3] + (255,)) if lst else fallback
    ol = outline[:3] + (255,)
    fill = pick(mid, ol)
    a = arr16(im16)
    ink = a[:, :, 3] >= 128
    cols = [tuple(int(v) for v in p[:3]) for p in a[ink]] if ink.any() else []
    unique = list(dict.fromkeys(cols))
    # Existing light: the lightest non-outline color already in the sprite.
    non_ol = [c for c in unique if not is_outline_color(c)]
    light = (max(non_ol, key=luma) + (255,)) if non_ol else None
    face = fill
    if eyes:
        samples = []
        for (ex, ey) in eyes:
            for dy in range(-1, 3):
                for dx in range(-1, 4):
                    x, y = ex + dx, ey + dy
                    if 0 <= x < 16 and 0 <= y < 16 and a[y, x, 3] >= 128:
                        c = tuple(int(v) for v in a[y, x, :3])
                        if not is_outline_color(c):
                            samples.append(c)
        if samples:
            face = Counter(samples).most_common(1)[0][0] + (255,)
    # Mouth cavity: only reuse an existing color if it is a vivid red that
    # still contrasts with the body fill. Tan / pale pink / body-adjacent
    # reds blend into the head (LastTyranomon, Dianamon). Otherwise use the
    # official Ogremon mouth red, or deep red when the body is itself red.
    reds = [c for c in unique if is_red_pink(c)]
    reds.sort(key=lambda c: -(c[0] - max(c[1], c[2])))
    def is_vivid_cavity_red(c):
        r, g, b = c[:3]
        return r >= 140 and (r - g) >= 60 and g <= 110
    vivid = [c for c in reds if is_vivid_cavity_red(c)]
    if vivid:
        mouth = vivid[0] + (255,)
    else:
        mouth = MOUTH_RED
    if _rgb_dist(fill, mouth) < 100:
        mouth = MOUTH_RED_DEEP
    # Tongue: existing lighter red/pink, else official pink.
    if reds:
        pinkish = [c for c in reds if c[0] > 140 and c[2] > 70]
        tongue = (pinkish[0] + (255,)) if pinkish else TONGUE_PINK
    else:
        tongue = TONGUE_PINK
    # Teeth: existing near-white, else official white.
    whites = [c for c in unique if min(c) > 200]
    teeth = (max(whites, key=luma) + (255,)) if whites else TEETH_WHITE
    # Lip / depth: official deep red (or existing darker red).
    lip = MOUTH_RED_DEEP
    if reds:
        deeper = [c for c in reds if luma(c) < luma(mouth[:3]) - 10]
        if deeper:
            lip = min(deeper, key=luma) + (255,)
    return {
        "outline": ol, "fill": fill, "face": face, "light": light,
        "mouth": mouth, "tongue": tongue, "teeth": teeth, "lip": lip,
        "dark": pick(dark, ol),
    }


def want_teeth(mid, kind):
    """Where official group examples show white teeth in an open mouth."""
    g = group_of(mid)
    if g == "visor":
        return False
    if kind in ("hurt", "refuse", "eat0"):
        return False
    if g in ("baby_front", "baby_side"):
        return kind in ("happy", "eat1", "angry", "attack")
    if g == "humanoid":
        return kind in ("eat1", "angry", "attack")
    if g == "dino":
        return kind in ("happy", "eat1", "angry", "attack")
    return False  # quad: official Gabumon/Garurumon are pink fill, rarely teeth



def head_limits(a, spec):
    """Tight box around the face (eyes + mouth), used so jaw cuts never eat arms/legs."""
    xs, ys = [], []
    for (x, y) in spec["eyes"]:
        xs += [x, x + 2]; ys += [y, y + 2]
    mx, my, mw, mh = spec["mouth"]
    xs += [mx, mx + mw]; ys += [my, my + mh]
    # also include a little margin, then clamp to ink bbox
    ink = a[:, :, 3] >= 128
    iy, ix = np.where(ink)
    if len(ix) == 0:
        return 0, 0, 15, 15
    x0 = max(int(ix.min()), min(xs) - 2)
    x1 = min(int(ix.max()), max(xs) + 3)
    y0 = max(int(iy.min()), min(ys) - 2)
    y1 = min(int(iy.max()), max(ys) + 3)
    # For side-view snouts the mouth x may be at the tip; include leftmost ink on mouth rows
    for row in range(max(0, my - 1), min(16, my + mh + 1)):
        row_xs = np.where(ink[row])[0]
        if len(row_xs) and int(row_xs[0]) <= mx + 1:
            x0 = min(x0, int(row_xs[0]))
    return x0, y0, x1, y1


# ---- primitive paints (all on 16×16 RGBA array) ----

def _eye_stroke_and_rim(a, stroke, outline, light=None):
    """Draw a dark stroke, then at most a 1-cell rim of an EXISTING light color
    on already-ink, already-dark neighbors. Never invent a color, never wash a pad."""
    stroke_set = set(stroke)
    for (x, y) in stroke:
        if 0 <= x < 16 and 0 <= y < 16:
            a[y, x] = outline
    if light is None:
        return
    for (x, y) in stroke:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < 16 and 0 <= ny < 16):
                continue
            if (nx, ny) in stroke_set:
                continue
            if a[ny, nx, 3] < 128:
                continue
            pix = tuple(int(v) for v in a[ny, nx, :3])
            if luma(pix) < 100:
                a[ny, nx] = light


def paint_arc(a, ex, ey, outline, light=None):
    """Official-style inverted-U in outline-dark, no head wash:

         ##
        #  #
    """
    stroke = [(ex + dx, ey + dy) for (dx, dy) in ((0, 0), (1, 0), (-1, 1), (2, 1))]
    _eye_stroke_and_rim(a, stroke, outline, light)


def paint_slant_eye(a, ex, ey, outline, light=None):
    """Fierce / angry eye: a downward slant, never a ∩, no head wash."""
    stroke = [(ex + dx, ey + dy) for (dx, dy) in ((0, 0), (1, 0), (1, 1), (2, 1))]
    _eye_stroke_and_rim(a, stroke, outline, light)


def paint_closed_line(a, ex, ey, outline, light=None, width=3):
    stroke = [(ex + dx, ey) for dx in range(width)]
    _eye_stroke_and_rim(a, stroke, outline, light)


def in_body_or_near(a, x, y):
    if not (0 <= x < 16 and 0 <= y < 16):
        return False
    if a[y, x, 3] >= 128:
        return True
    # allow a mouth cavity just inside the silhouette: a neighbour is ink
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        xx, yy = x + dx, y + dy
        if 0 <= xx < 16 and 0 <= yy < 16 and a[yy, xx, 3] >= 128:
            return True
    return False


def open_jaw_side(a, mx, my, w, h, outline, interior, head, teeth=None, lip=None):
    """Side-view open mouth: an outlined cavity filled with interior color.

    Official Child+ open mouths (Greymon, Airdramon, Gabumon, Garurumon, …)
    show a dark lip and a red/pink/dark interior, often with white teeth.
    We paint into existing snout ink starting at the tip — never punch a
    transparent hole through the head. The very front cell of each mouth
    row is the outline; cells inward are interior (plus optional teeth
    just under the upper lip).
    """
    x0, y0, x1, y1 = head
    w, h = max(3, w), max(3, h)
    painted = False
    tips = {}
    for row in range(my, my + h):
        if not (0 <= row < 16) or row < y0 or row > y1:
            continue
        xs = np.where(a[row, x0:x1 + 1, 3] >= 128)[0]
        if len(xs) == 0:
            continue
        tips[row] = int(xs[0] + x0)
    if not tips:
        return False
    rows = sorted(tips)
    depth = w
    for i, row in enumerate(rows):
        start = tips[row]
        is_top = i == 0
        is_bot = i == len(rows) - 1
        # keep at least 2 ink cells behind the cavity so the head does not dissolve
        remain = int((a[row, start:x1 + 1, 3] >= 128).sum())
        # Keep one body cell behind the cavity; otherwise take enough span
        # for a visible interior (front outline + at least 2 fill cells).
        span = max(3, min(max(depth, 4), max(3, remain - 1)))
        for j in range(span):
            x = start + j
            if not (0 <= x < 16):
                continue
            if not in_body_or_near(a, x, row):
                continue
            # Lips are the top/bottom rows: outline at the front, outline
            # along the lip, but do not eat a whole 2-cell snout.
            # Middle rows: outline at the tip, then interior (teeth sit in
            # the red, never replace the whole cavity).
            if is_top or is_bot:
                a[row, x] = outline
            elif j == 0:
                a[row, x] = outline
            elif teeth is not None and i == 1 and j in (2, 4) and span > 3:
                a[row, x] = teeth
            elif lip is not None and len(rows) >= 4 and i == len(rows) - 2 and j >= 1:
                a[row, x] = lip
            else:
                a[row, x] = interior
            painted = True
        # lip ticks just outside the band, on existing ink
        if is_top:
            top = row - 1
            if 0 <= top < 16 and a[top, start, 3] >= 128:
                a[top, start] = outline
        if is_bot:
            bot = row + 1
            if 0 <= bot < 16 and a[bot, start, 3] >= 128:
                a[bot, start] = outline
    return painted


def open_jaw_front(a, cx, cy, w, h, outline, interior, lip=None, teeth=None):
    """Koromon/Ogremon front mouth: outlined cavity with a colored interior.

    h is at least 3: top lip = outline, middle row(s) = interior (optional
    white teeth on the first interior row, optional lip color on the last
    interior row like Koromon's pink/red bottom), bottom lip = outline.
    Only paints cells that are already ink or immediately inside the
    silhouette — never leaves a transparent hole.
    """
    w, h = max(3, w), max(3, h)
    x0 = max(1, min(cx - w // 2, 16 - w - 1))
    y0 = max(0, min(cy, 16 - h))
    for dy in range(h):
        for dx in range(w):
            x, y = x0 + dx, y0 + dy
            if not in_body_or_near(a, x, y):
                continue
            is_edge = dy == 0 or dy == h - 1 or dx == 0 or dx == w - 1
            if is_edge:
                a[y, x] = outline
            elif teeth is not None and dy == 1 and dx % 2 == 1 and 0 < dx < w - 1:
                a[y, x] = teeth
            elif lip is not None and h >= 4 and dy == h - 2:
                a[y, x] = lip
            else:
                a[y, x] = interior
    return True


def paint_tongue(a, mx, my, mw, mh, pink, outline):
    """Hang a clearly visible 2-wide × 4-tall tongue from the mouth, including into empty space."""
    if pink is None:
        return
    tx = mx + max(0, mw // 2 - 1)
    ty = my + max(2, mh)  # start at the bottom of the mouth opening
    # body of the tongue
    for dy in range(0, 4):
        width = 2 if dy < 3 else 3
        x0 = tx if dy < 3 else tx - 1
        for i, x in enumerate(range(x0, x0 + width)):
            y = ty + dy
            if not (0 <= x < 16 and 0 <= y < 16):
                continue
            edge = dy == 3 or i == 0 or i == width - 1
            a[y, x] = outline if (dy == 3 and edge) else pink


def paint_normal_eye(a, ex, ey, ew, eh, dark, light=None):
    stroke = []
    for dy in range(max(1, eh)):
        for dx in range(max(1, ew)):
            stroke.append((ex + dx, ey + dy))
    _eye_stroke_and_rim(a, stroke, dark, light)


def n_diff16(a, b):
    ai, bi = a[:, :, 3] >= 128, b[:, :, 3] >= 128
    d = (ai != bi) | (ai & bi & np.any(a[:, :, :3] != b[:, :, :3], axis=2))
    return int(d.sum())


# Profile humanoids: a front rectangle lands on the torso, so keep a side cavity.
PROFILE_HUMANOID = {"pinochimon", "meicrackmon"}


def use_front_mouth(mid, spec):
    g = group_of(mid)
    if g == "baby_front":
        return True
    if g == "visor":
        return False  # filled snout/visor slit, never a 6×4 chest maw
    if g == "humanoid":
        return mid not in PROFILE_HUMANOID
    if spec.get("front"):
        return True
    return False


def mouth_wh(mid, kind, mw, mh):
    """Open-mouth width and height in 16-grid cells."""
    g = group_of(mid)
    if g == "visor":
        if kind in ("eat0", "hurt"):
            return max(3, mw), 3
        return max(4, mw + 1), max(3, mh + 1)
    if kind == "eat0":
        return max(5, mw + 1), 3
    if g == "baby_front":
        return max(6, mw + 3), max(4, mh + 2)
    return max(6, mw + 2), max(4, mh + 2)


def shifted_spec(spec, lift):
    s = dict(spec)
    s["eyes"] = [(x, y - lift) for (x, y) in spec["eyes"]]
    s["sleep_eyes"] = [(x, y - lift) for (x, y) in spec.get("sleep_eyes") or spec["eyes"]]
    mx, my, mw, mh = spec["mouth"]
    s["mouth"] = (mx, my - lift, mw, mh)
    return s


# ---- per-expression builders ----

def build_happy(idle16, mid, spec, colors):
    lift = lift_amount(mid, idle16)
    im = shift16(idle16, 0, -lift) if lift else idle16.copy()
    a = arr16(im)
    sp = shifted_spec(spec, lift)
    eyes = [(x, max(0, y)) for (x, y) in sp["eyes"]]
    mx, my, mw, mh = sp["mouth"]
    my = max(0, my)
    ol, light, mouth, tongue = colors["outline"], colors["light"], colors["mouth"], colors["tongue"]
    teeth = colors["teeth"] if want_teeth(mid, "happy") else None
    lip_color = colors.get("lip")
    head = head_limits(a, sp)

    if use_front_mouth(mid, spec):
        g = group_of(mid)
        fw, fh = mouth_wh(mid, "happy", mw, mh)
        lip = tongue if g == "baby_front" else lip_color
        open_jaw_front(a, mx + mw // 2, my, fw, fh, ol, mouth, lip=lip, teeth=teeth)
    else:
        ww, hh = mouth_wh(mid, "happy", mw, mh)
        open_jaw_side(a, mx, my, ww, hh, ol, mouth, head, teeth=teeth, lip=lip_color)

    for (ex, ey) in eyes:
        paint_arc(a, ex, ey, ol, light=light)
    return fromarr(a)


def build_eat(idle16, mid, spec, colors, wide=False):
    a = arr16(idle16.copy())
    eyes = list(spec["eyes"])
    ew, eh = spec["eye_size"]
    mx, my, mw, mh = spec["mouth"]
    ol, light, mouth, dark = colors["outline"], colors["light"], colors["mouth"], colors["dark"]
    kind = "eat1" if wide else "eat0"
    teeth = colors["teeth"] if want_teeth(mid, kind) else None
    lip_color = colors.get("lip")
    if not wide:
        a = arr16(shift16(fromarr(a), 0, 1))
        eyes = [(x, min(15, y + 1)) for x, y in eyes]
        my = min(14, my + 1)
        sp = shifted_spec(spec, -1)
    else:
        sp = dict(spec)
        sp["eyes"] = eyes
        sp["mouth"] = (mx, my, mw, mh)
    head = head_limits(a, sp)
    if use_front_mouth(mid, spec):
        fw, fh = mouth_wh(mid, kind, mw, mh)
        open_jaw_front(a, mx + mw // 2, my, fw, fh, ol, mouth, lip=(lip_color if wide else None), teeth=teeth)
    else:
        ww, hh = mouth_wh(mid, kind, mw, mh)
        open_jaw_side(a, mx, my, ww, hh, ol, mouth, head, teeth=teeth, lip=(lip_color if wide else None))
    for (ex, ey) in eyes:
        paint_normal_eye(a, ex, ey, max(1, ew), max(1, eh), dark, light=light)
    return fromarr(a)


def build_angry(idle16, mid, spec, colors):
    # Agumon angry shares the eat1 body (lift + open jaw) with slanted eyes.
    # Humanoids (Ogremon) keep the standing body.
    lift = 0 if group_of(mid) == "humanoid" else lift_amount(mid, idle16) or (0 if group_of(mid) == "humanoid" else 1)
    if group_of(mid) != "humanoid" and group_of(mid) not in ("baby_front", "baby_side"):
        lift = max(lift, 1) if lift_amount(mid, idle16) else lift
    # simpler: same lift as happy
    lift = lift_amount(mid, idle16)
    im = shift16(idle16, 0, -lift) if lift else idle16.copy()
    a = arr16(im)
    sp = shifted_spec(spec, lift)
    eyes = [(x, max(0, y)) for (x, y) in sp["eyes"]]
    mx, my, mw, mh = sp["mouth"]
    my = max(0, my)
    ol, light, mouth = colors["outline"], colors["light"], colors["mouth"]
    teeth = colors["teeth"] if want_teeth(mid, "angry") else None
    lip_color = colors.get("lip")
    head = head_limits(a, sp)
    if use_front_mouth(mid, spec):
        g = group_of(mid)
        fw, fh = mouth_wh(mid, "angry", mw, mh)
        open_jaw_front(a, mx + mw // 2, my, fw, fh, ol, mouth, lip=lip_color, teeth=teeth)
    else:
        ww, hh = mouth_wh(mid, "angry", mw, mh)
        open_jaw_side(a, mx, my, ww, hh, ol, mouth, head, teeth=teeth, lip=lip_color)
    for (ex, ey) in eyes:
        paint_slant_eye(a, ex, ey, ol, light=light)
    return fromarr(a)


def build_refuse(idle16, mid, spec, colors):
    g = group_of(mid)
    ol, light, mouth, pink = colors["outline"], colors["light"], colors["mouth"], colors["tongue"]
    mx, my, mw, mh = spec["mouth"]
    if g == "humanoid" or spec.get("tongue"):
        a = arr16(idle16.copy())
        head = head_limits(a, spec)
        fw, fh = mouth_wh(mid, "refuse", mw, mh)
        if use_front_mouth(mid, spec):
            open_jaw_front(a, mx + mw // 2, my, fw, fh, ol, mouth, lip=colors.get("lip"))
        else:
            open_jaw_side(a, mx, my, fw, fh, ol, mouth, head, lip=colors.get("lip"))
        paint_tongue(a, mx, my, mw, max(2, mh), pink, ol)
        return fromarr(a)
    if g in ("baby_front", "baby_side"):
        # Koromon refuse: a slightly different, often lower/smaller frontal — a 1–2 cell drop is the safe read.
        drop = 1
        a = arr16(idle16)
        ink_y = [y for y in range(16) if (a[y, :, 3] >= 128).any()]
        bot = ink_y[-1] if ink_y else 15
        if bot + drop > 15:
            drop = 15 - bot
        return shift16(idle16, 0, max(0, drop))
    # dino / quad / visor: bowed head (already a designed refuse_pose)
    return R.refuse_pose(idle16.copy(), idle16)


def build_sleep(sleep16, mid, spec, colors):
    a = arr16(sleep16.copy())
    ol, light = colors["outline"], colors["light"]
    seyes = spec.get("sleep_eyes") or spec["eyes"]
    for (ex, ey) in seyes:
        paint_closed_line(a, ex, ey, ol, light=light, width=4)
    return fromarr(a)


def build_hurt(idle16, mid, spec, colors):
    im = shift16(idle16, 0, 1)
    a = arr16(im)
    ol, light, mouth = colors["outline"], colors["light"], colors["mouth"]
    mx, my, mw, mh = spec["mouth"]
    my = min(14, my + 1)
    eyes = [(x, min(15, y + 1)) for x, y in spec["eyes"]]
    sp = shifted_spec(spec, -1)
    head = head_limits(a, sp)
    if use_front_mouth(mid, spec):
        open_jaw_front(a, mx + mw // 2, my, max(3, mw), 3, ol, mouth, lip=colors.get("lip"))
    else:
        open_jaw_side(a, mx, my, max(3, mw), max(3, mh), ol, mouth, head, lip=colors.get("lip"))
    for (ex, ey) in eyes:
        paint_closed_line(a, ex, ey, ol, light=light, width=3)
    return fromarr(a)


def build_attack(idle16, mid, spec, colors):
    im = build_angry(idle16, mid, spec, colors)
    return shift16(im, -2, 0)


# Unique artbook cells visually scanned: 42 monsters × 4 slots = 168.
# Examon artbook slot2 (the TSR dm20_ver20th.png crop) contains white "OM"
# letters in the cell itself — a label/watermark, not a pose. slot0/1/3 are clean.
# Do not use slot2 for attack or eat; fall back to designed frames.
CONTAMINATED_OFFICIAL = {
    "examon": ("eat0", "eat1", "eat", "attack"),
}


def keep_official(mid, key, cov):
    if mid in CONTAMINATED_OFFICIAL and key in CONTAMINATED_OFFICIAL[mid]:
        return False
    return kind_of(cov["monsters"][mid], key) == "official_color"


def apply_one(mid, frames, meta, stats):
    if mid not in T:
        return frames, meta, []
    # Unmap contaminated official cells so the designed builders run.
    if mid in CONTAMINATED_OFFICIAL:
        for k in CONTAMINATED_OFFICIAL[mid]:
            if k not in frames and "idle0" in frames:
                frames[k] = R.rgba(frames["idle0"]).copy()
            meta[k] = {"kind": "designed", "src": "designed-replacing-contaminated-artbook"}
    spec = T[mid]
    idle32 = R.rgba(frames["idle0"])
    idle16 = to16(idle32)
    colors = pal(idle16, spec.get('eyes'))
    changed = []

    def out(im16):
        return to32(im16)

    # eat (designed only)
    if designed(meta, "eat0", frames):
        frames["eat0"] = out(build_eat(idle16, mid, spec, colors, wide=False))
        meta["eat0"] = {"kind": "designed", "src": "hand-eat0"}
        changed.append("eat0"); stats["eat0"] += 1
    if designed(meta, "eat1", frames):
        frames["eat1"] = out(build_eat(idle16, mid, spec, colors, wide=True))
        meta["eat1"] = {"kind": "designed", "src": "hand-eat1"}
        changed.append("eat1"); stats["eat1"] += 1
    if designed(meta, "eat", frames):
        frames["eat"] = R.rgba(frames.get("eat1") or frames["eat0"]).copy()
        meta["eat"] = {"kind": "designed", "src": "hand-eat-alias"}
        changed.append("eat"); stats["eat"] += 1

    if designed(meta, "happy", frames):
        frames["happy"] = out(build_happy(idle16, mid, spec, colors))
        meta["happy"] = {"kind": "designed", "src": "hand-happy"}
        changed.append("happy"); stats["happy"] += 1
        # magnitude check at 16-grid
        n = n_diff16(arr16(idle16), arr16(to16(frames["happy"])))
        stats["happy_diff_min"] = min(n, stats.get("happy_diff_min", 999))
        stats["happy_diff_max"] = max(n, stats.get("happy_diff_max", 0))
        if n < 20:
            print(f"WARN {mid} happy vs idle only {n} px at 16-grid")

    if designed(meta, "angry", frames):
        frames["angry"] = out(build_angry(idle16, mid, spec, colors))
        meta["angry"] = {"kind": "designed", "src": "hand-angry"}
        changed.append("angry"); stats["angry"] += 1

    if designed(meta, "refuse", frames):
        frames["refuse"] = out(build_refuse(idle16, mid, spec, colors))
        meta["refuse"] = {"kind": "designed", "src": "hand-refuse"}
        changed.append("refuse"); stats["refuse"] += 1

    for sk in ("sleep0", "sleep"):
        if designed(meta, sk, frames):
            frames[sk] = out(build_sleep(to16(frames[sk]), mid, spec, colors))
            meta[sk] = {"kind": "designed", "src": "hand-sleep"}
            changed.append(sk); stats[sk] += 1
    if designed(meta, "sleep1", frames):
        src = frames.get("sleep0") or frames.get("sleep")
        if src is not None:
            frames["sleep1"] = R.shift_im(R.rgba(src), 1, 0)
            meta["sleep1"] = {"kind": "designed", "src": "hand-sleep1"}
            changed.append("sleep1"); stats["sleep1"] += 1

    if designed(meta, "hurt1", frames):
        if "hurt" in frames and is_official(meta, "hurt"):
            frames["hurt1"] = R.shift_im(R.rgba(frames["hurt"]), 0, 1)
            meta["hurt1"] = {"kind": "designed", "src": "hand-hurt1-shift"}
            changed.append("hurt1"); stats["hurt1"] += 1
        elif "hurt0" in frames and is_official(meta, "hurt0"):
            frames["hurt1"] = R.shift_im(R.rgba(frames["hurt0"]), 0, 1)
            meta["hurt1"] = {"kind": "designed", "src": "hand-hurt1-shift"}
            changed.append("hurt1"); stats["hurt1"] += 1

    if designed(meta, "hurt", frames) and not is_official(meta, "hurt"):
        frames["hurt"] = out(build_hurt(idle16, mid, spec, colors))
        meta["hurt"] = {"kind": "designed", "src": "hand-hurt"}
        changed.append("hurt"); stats["hurt"] += 1
        if designed(meta, "hurt0", frames):
            frames["hurt0"] = R.rgba(frames["hurt"]).copy()
        if designed(meta, "hurt1", frames) and meta.get("hurt1", {}).get("src") != "hand-hurt1-shift":
            frames["hurt1"] = R.shift_im(R.rgba(frames["hurt"]), 0, 1)
            meta["hurt1"] = {"kind": "designed", "src": "hand-hurt1"}
            if "hurt1" not in changed:
                changed.append("hurt1"); stats["hurt1"] += 1

    if designed(meta, "attack", frames):
        frames["attack"] = out(build_attack(idle16, mid, spec, colors))
        meta["attack"] = {"kind": "designed", "src": "hand-attack"}
        changed.append("attack"); stats["attack"] += 1

    return frames, meta, changed


def font(size):
    for path, idx in (
        ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 3),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 0),
    ):
        try:
            return ImageFont.truetype(path, size, index=idx) if path.endswith(".ttc") else ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def tile(im, scale, bg=(250, 248, 244, 255)):
    cell = 32 * scale
    t = Image.new("RGBA", (cell, cell), bg)
    s = R.rgba(im).resize((cell, cell), Image.Resampling.NEAREST)
    return Image.alpha_composite(t, s).convert("RGB")


def make_expression_check(ids, frames, meta, names, official, path):
    """Each monster: 6x row (official-example | idle0 | designed frames) and a 3x row."""
    keys = ["idle0", "eat0", "eat1", "happy", "angry", "refuse", "sleep0", "sleep1", "attack", "hurt"]
    # columns: example + keys
    cols = ["example"] + keys
    scale6, scale3 = 6, 3
    c6, c3 = 32 * scale6, 32 * scale3
    label_w = 140
    tag_h = 14
    header = 52
    # one monster block: label + 6x row + 3x row
    row6 = c6 + tag_h
    row3 = c3 + 6
    block_h = row6 + row3 + 10
    W = label_w + len(cols) * (c6 + 4) + 8
    H = header + len(ids) * block_h + 8
    sheet = Image.new("RGB", (W, H), (236, 232, 224))
    dr = ImageDraw.Draw(sheet)
    f, fs = font(15), font(10)
    dr.text((8, 6), "expression-check  每隻兩列：上 6×（官方同組範例 | idle0 | 各表情）  下 3×（遊戲尺度）。只接受一眼能認出的表情。", fill=(30, 26, 22), font=f)
    for i, k in enumerate(cols):
        dr.text((label_w + i * (c6 + 4) + 2, 30), "官方例" if k == "example" else k, fill=(80, 70, 60), font=fs)
    kind_zh = {
        "official_color": "官方彩色", "designed": "自製",
        "kept_existing_idle": "既有上色", "official_mono_colorized": "官方點陣上色",
    }
    for r, mid in enumerate(ids):
        y = header + r * block_h
        zh, en = names.get(mid, ("", mid))
        ex_id = EXAMPLE_FOR.get(mid, "agumon")
        ex_zh = names.get(ex_id, ("", ex_id))[0]
        dr.text((6, y + 20), zh or mid, fill=(20, 20, 20), font=fs)
        dr.text((6, y + 38), mid, fill=(110, 100, 90), font=fs)
        dr.text((6, y + 56), f"例:{ex_zh or ex_id}", fill=(140, 80, 60), font=fs)
        frs = frames[mid]
        kinds = meta[mid]
        # 6x row
        for i, k in enumerate(cols):
            x = label_w + i * (c6 + 4)
            if k == "example":
                src = official[ex_id].get("happy") or official[ex_id].get("idle0")
                sheet.paste(tile(src, scale6), (x, y))
                dr.text((x + 2, y + c6 + 1), f"{ex_id} happy", fill=(160, 60, 50), font=fs)
                continue
            src = frs.get(k)
            if src is None:
                ImageDraw.Draw(sheet).rectangle([x, y, x + c6, y + c6], fill=(220, 218, 212))
                continue
            sheet.paste(tile(src, scale6), (x, y))
            kk = kinds.get(k, {}).get("kind", "")
            tag = kind_zh.get(kk, kk)
            col = (160, 60, 50) if kk == "official_color" else ((60, 80, 140) if kk == "designed" else (90, 90, 90))
            dr.text((x + 2, y + c6 + 1), tag, fill=col, font=fs)
        # 3x row, left-aligned under the 6x cells (same column anchors, smaller tiles)
        y3 = y + row6 + 2
        for i, k in enumerate(cols):
            x = label_w + i * (c6 + 4)
            if k == "example":
                src = official[ex_id].get("happy") or official[ex_id].get("idle0")
                sheet.paste(tile(src, scale3), (x, y3))
                continue
            src = frs.get(k)
            if src is None:
                continue
            sheet.paste(tile(src, scale3), (x, y3))
    sheet.save(path)
    print("wrote", path, sheet.size)
    return path


def split_check(path, ids, outdir, chunk=8):
    im = Image.open(path)
    header = 52
    n = len(ids)
    block_h = (im.size[1] - header - 8) // n
    paths = []
    for i in range(0, n, chunk):
        y0 = 0 if i == 0 else header + i * block_h
        y1 = header + min(n, i + chunk) * block_h + 8
        # include header on every chunk so columns stay labelled
        chunk_im = Image.new("RGB", (im.size[0], (y1 - (header if i else 0)) + (header if i else 0)), (236, 232, 224))
        if i == 0:
            piece = im.crop((0, 0, im.size[0], y1))
            chunk_im = piece
        else:
            hdr = im.crop((0, 0, im.size[0], header))
            body = im.crop((0, header + i * block_h, im.size[0], y1))
            chunk_im = Image.new("RGB", (im.size[0], header + body.size[1]), (236, 232, 224))
            chunk_im.paste(hdr, (0, 0))
            chunk_im.paste(body, (0, header))
        p = outdir / f"ec_chunk_{i:02d}.png"
        chunk_im.save(p)
        paths.append(p)
        print("chunk", p, chunk_im.size, "monsters", ids[i:i+chunk])
    return paths


def decode_all(entry):
    return {name: B.decode_entry(entry, name) for name in entry["frames"]}


def main():
    js_text = BAK.read_text() if BAK.exists() else JS_PATH.read_text()
    existing = B.parse_existing_sprites(js_text)
    cov = json.loads(COV.read_text())
    names = R.load_names()
    ids = list(T.keys())
    assert len(ids) == 44
    # default official example
    for mid in ids:
        EXAMPLE_FOR.setdefault(mid, "agumon")

    stats = Counter()
    new_frames, new_meta = {}, {}
    for mid in ids:
        frames = decode_all(existing[mid])
        meta = {k: dict(v) for k, v in cov["monsters"][mid].items()}
        before = {k: R.rgba(v).copy() for k, v in frames.items()}
        frames, meta, changed = apply_one(mid, frames, meta, stats)
        for k, im in list(frames.items()):
            if keep_official(mid, k, cov):
                if not frames_equal(before[k], im):
                    print("RESTORING official", mid, k)
                    frames[k] = before[k]
        new_frames[mid] = frames
        new_meta[mid] = meta
        if mid in T and designed(meta, "happy", frames if False else {"happy": True}):
            n = n_diff16(arr16(to16(before["idle0"])), arr16(to16(frames["happy"])))
            print(f"  {mid:18s} happy Δ16={n:3d}")

    text = js_text
    for mid, frames in new_frames.items():
        text = R.replace_entry(text, mid, B.encode_sprite(frames))
    JS_PATH.write_text(text)
    print("wrote", JS_PATH, JS_PATH.stat().st_size)
    # Persist unmapped contaminants so later passes do not treat them as official.
    for mid, keys in CONTAMINATED_OFFICIAL.items():
        for k in keys:
            cov["monsters"][mid][k] = {
                "kind": "designed",
                "src": "designed-replacing-contaminated-artbook",
            }
    COV.write_text(json.dumps(cov, indent=2, ensure_ascii=False))
    print("updated coverage", COV)

    bak = B.parse_existing_sprites(BAK.read_text())
    now = B.parse_existing_sprites(text)
    drift = 0
    for mid in ids:
        for k, v in cov["monsters"][mid].items():
            if not keep_official(mid, k, cov):
                continue
            if k not in bak[mid]["frames"] or k not in now[mid]["frames"]:
                continue
            if not frames_equal(B.decode_entry(bak[mid], k), B.decode_entry(now[mid], k)):
                print("OFFICIAL DRIFT", mid, k); drift += 1
    print("official drift", drift, "stats", {k: stats[k] for k in stats if not str(k).startswith("happy_diff")})
    print("happy Δ16 range", stats.get("happy_diff_min"), "..", stats.get("happy_diff_max"))

    official_ids = {"agumon", "koromon", "ogremon", "garurumon", "omegamon", "wargreymon"}
    official = {}
    for mid in official_ids:
        if mid in now:
            official[mid] = decode_all(now[mid])
        elif mid in existing:
            official[mid] = decode_all(existing[mid])
    # wargreymon may not be in atlas under that id
    if "wargreymon" not in official and "omegamon" in official:
        official["wargreymon"] = official["omegamon"]

    make_expression_check(ids, new_frames, new_meta, names, official, ROOT / "expression-check.png")
    split_check(ROOT / "expression-check.png", ids, CACHE, chunk=8)

    sample = [
        "agumon", "omegamon", "dorumon", "lasttyranomon", "titamon", "lunamon", "kingetemon", "meicoomon",
        "hackmon", "jesmon", "examon", "dracomon", "alphamon", "coronamon", "petitmon", "dorugamon",
    ]
    samp_frames, samp_meta = {}, {}
    for mid in sample:
        if mid in new_frames:
            samp_frames[mid] = new_frames[mid]
            base = {k: dict(v) for k, v in cov["monsters"].get(mid, {}).items()}
            base.update(new_meta[mid])
            samp_meta[mid] = base
        else:
            samp_frames[mid] = decode_all(now[mid])
            samp_meta[mid] = {k: dict(v) for k, v in cov["monsters"].get(mid, {}).items()}
    R.make_anim_sample(sample, samp_frames, samp_meta, names, ROOT / "anim-sample.png")
    print("done")


if __name__ == "__main__":
    main()
