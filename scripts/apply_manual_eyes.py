#!/usr/bin/env python3
"""Apply a manual 16-grid eye/mouth table to every designed expression frame.

Happy eyes are official-style inverted-U (∩) in dark outline, replacing the
whole original eye, stamped as 16-grid cells (= 2×2 blocks on the 32 canvas).
Sleep uses a closed horizontal line at the same (or sleep-pose) eye coordinates.
Official color cells are never rewritten.
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

ROOT = Path("/workspace/digivice")
JS_PATH = ROOT / "js" / "sprites.js"
BAK = Path("/tmp/pass9/sprites.js.bak")
COV_PATH = Path("/tmp/pass8/coverage.json")
CACHE = Path("/tmp/pass9")
CACHE.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Manual 16-grid table. Coordinates are (x, y) on the 16×16 grid (top-left of
# each eye or mouth). eye_size is the rectangle to erase (replaced by the ∩
# or the sleep line). mouth is (x, y, w, h) for eat1/happy; eat0 uses a
# smaller hole. sleep_eyes are on the sleep0 body (head may have moved).
# ---------------------------------------------------------------------------
T = {
    "kingetemon": {
        "eyes": [(5, 5), (8, 5)], "eye_size": (2, 1), "front": True,
        "mouth": (6, 7, 3, 2), "sleep_eyes": [(6, 4), (9, 4)],
        "visor": True, "tongue": True,
    },
    "titamon": {
        "eyes": [(5, 7), (8, 7)], "eye_size": (2, 2), "front": True,
        "mouth": (5, 8, 3, 2), "sleep_eyes": [(4, 4), (7, 4)],
        "visor": False, "tongue": True,
    },
    "pinochimon": {
        "eyes": [(7, 5)], "eye_size": (2, 1), "front": False,
        "mouth": (2, 6, 2, 2), "sleep_eyes": [(6, 4)],
        "visor": False, "tongue": True,
    },
    "lasttyranomon": {
        "eyes": [(3, 7), (5, 7), (7, 7)], "eye_size": (1, 1), "front": True,
        "mouth": (2, 9, 3, 2), "sleep_eyes": [(3, 6), (5, 6), (7, 6)],
        "visor": False, "tongue": False,
    },
    "sakumon": {
        "eyes": [(6, 9), (8, 9)], "eye_size": (1, 1), "front": True,
        "mouth": (7, 10, 2, 2), "sleep_eyes": [(6, 9), (8, 9)],
        "visor": False, "tongue": False,
    },
    "sakuttomon": {
        "eyes": [(4, 8), (8, 8)], "eye_size": (1, 1), "front": True,
        "mouth": (6, 10, 3, 2), "sleep_eyes": [(5, 8), (8, 8)],
        "visor": False, "tongue": False,
    },
    "zubamon": {
        "eyes": [(5, 4)], "eye_size": (2, 2), "front": False,
        "mouth": (2, 5, 2, 2), "sleep_eyes": [(8, 6)],
        "visor": False, "tongue": False,
    },
    "zubaeagermon": {
        "eyes": [(5, 6)], "eye_size": (2, 2), "front": False,
        "mouth": (3, 6, 2, 2), "sleep_eyes": [(6, 4)],
        "visor": False, "tongue": False,
    },
    "duramon": {
        "eyes": [(6, 3), (8, 3)], "eye_size": (2, 1), "front": True,
        "mouth": (4, 5, 2, 2), "sleep_eyes": [(5, 3), (7, 3)],
        "visor": True, "tongue": False,
    },
    "durandamon": {
        "eyes": [(5, 3), (8, 3)], "eye_size": (2, 2), "front": True,
        "mouth": (3, 5, 2, 2), "sleep_eyes": [(6, 4)],
        "visor": True, "tongue": False,
    },
    "hackmon": {
        "eyes": [(4, 5)], "eye_size": (2, 2), "front": False,
        "mouth": (1, 6, 2, 2), "sleep_eyes": [(4, 3)],
        "visor": False, "tongue": False,
    },
    "baohackmon": {
        "eyes": [(5, 3), (8, 3)], "eye_size": (2, 1), "front": True,
        "mouth": (3, 7, 3, 2), "sleep_eyes": [(5, 3), (8, 3)],
        "visor": False, "tongue": True,
    },
    "saviorhackmon": {
        "eyes": [(4, 4), (6, 4)], "eye_size": (2, 1), "front": True,
        "mouth": (3, 6, 2, 2), "sleep_eyes": [(5, 3)],
        "visor": True, "tongue": False,
    },
    "jesmon": {
        "eyes": [(6, 3)], "eye_size": (2, 2), "front": False,
        "mouth": (3, 5, 2, 2), "sleep_eyes": [(6, 3)],
        "visor": True, "tongue": False,
    },
    "petitmon": {
        "eyes": [(7, 8)], "eye_size": (1, 2), "front": False,
        "mouth": (5, 9, 2, 2), "sleep_eyes": [(7, 12)],
        "visor": False, "tongue": False,
    },
    "babydmon": {
        "eyes": [(5, 4), (8, 4)], "eye_size": (1, 2), "front": True,
        "mouth": (6, 6, 2, 1), "sleep_eyes": [(5, 4), (8, 4)],
        "visor": False, "tongue": False,
    },
    "dracomon": {
        "eyes": [(6, 4)], "eye_size": (2, 2), "front": False,
        "mouth": (3, 5, 2, 2), "sleep_eyes": [(6, 3)],
        "visor": False, "tongue": False,
    },
    "coredramon_blue": {
        "eyes": [(6, 4)], "eye_size": (2, 2), "front": False,
        "mouth": (3, 5, 2, 2), "sleep_eyes": [(6, 3)],
        "visor": False, "tongue": False,
    },
    "coredramon_green": {
        "eyes": [(6, 4)], "eye_size": (2, 2), "front": False,
        "mouth": (3, 5, 2, 2), "sleep_eyes": [(6, 3)],
        "visor": False, "tongue": False,
    },
    "wingdramon": {
        "eyes": [(5, 3)], "eye_size": (2, 2), "front": False,
        "mouth": (2, 4, 2, 2), "sleep_eyes": [(5, 2)],
        "visor": False, "tongue": False,
    },
    "slayerdramon": {
        "eyes": [(5, 3)], "eye_size": (2, 2), "front": False,
        "mouth": (3, 4, 2, 2), "sleep_eyes": [(5, 3)],
        "visor": True, "tongue": False,
    },
    "groundramon": {
        "eyes": [(6, 5)], "eye_size": (2, 1), "front": False,
        "mouth": (3, 6, 2, 2), "sleep_eyes": [(5, 3)],
        "visor": False, "tongue": False,
    },
    "breakdramon": {
        "eyes": [(7, 3)], "eye_size": (2, 2), "front": False,
        "mouth": (2, 4, 2, 2), "sleep_eyes": [(5, 3)],
        "visor": True, "tongue": False,
    },
    "examon": {
        "eyes": [(6, 4)], "eye_size": (2, 2), "front": False,
        "mouth": (3, 5, 2, 2), "sleep_eyes": [(5, 4)],
        "visor": True, "tongue": False,
    },
    "dodomon": {
        "eyes": [(5, 8), (9, 8)], "eye_size": (2, 2), "front": True,
        "mouth": (6, 12, 3, 2), "sleep_eyes": [(5, 10), (9, 10)],
        "visor": False, "tongue": False,
    },
    "dorimon": {
        "eyes": [(6, 9), (10, 9)], "eye_size": (2, 2), "front": True,
        "mouth": (6, 12, 3, 2), "sleep_eyes": [(6, 10), (9, 10)],
        "visor": False, "tongue": False,
    },
    "dorumon": {
        "eyes": [(6, 4)], "eye_size": (1, 2), "front": False,
        "mouth": (2, 5, 2, 2), "sleep_eyes": [(6, 6)],
        "visor": False, "tongue": False,
    },
    "dorugamon": {
        "eyes": [(6, 4)], "eye_size": (1, 2), "front": False,
        "mouth": (2, 5, 2, 2), "sleep_eyes": [(5, 5)],
        "visor": False, "tongue": False,
    },
    "doruguremon": {
        "eyes": [(6, 5)], "eye_size": (2, 2), "front": False,
        "mouth": (3, 6, 2, 2), "sleep_eyes": [(5, 3)],
        "visor": False, "tongue": False,
    },
    "alphamon": {
        "eyes": [(6, 3)], "eye_size": (2, 2), "front": False,
        "mouth": (3, 5, 2, 2), "sleep_eyes": [(6, 4)],
        "visor": True, "tongue": False,
    },
    "pukamon": {
        "eyes": [(5, 5)], "eye_size": (1, 2), "front": False,
        "mouth": (3, 7, 2, 2), "sleep_eyes": [(5, 6)],
        "visor": False, "tongue": False,
    },
    "coronamon": {
        "eyes": [(5, 4)], "eye_size": (2, 2), "front": False,
        "mouth": (2, 5, 2, 2), "sleep_eyes": [(6, 3)],
        "visor": False, "tongue": False,
    },
    "firamon": {
        "eyes": [(4, 3)], "eye_size": (2, 2), "front": False,
        "mouth": (2, 4, 2, 2), "sleep_eyes": [(5, 3)],
        "visor": False, "tongue": False,
    },
    "flaremon": {
        "eyes": [(4, 4)], "eye_size": (2, 2), "front": False,
        "mouth": (2, 5, 2, 2), "sleep_eyes": [(5, 3)],
        "visor": False, "tongue": True,
    },
    "apollomon": {
        "eyes": [(4, 4)], "eye_size": (2, 2), "front": False,
        "mouth": (2, 5, 2, 2), "sleep_eyes": [(5, 3)],
        "visor": False, "tongue": True,
    },
    "lunamon": {
        "eyes": [(6, 4)], "eye_size": (2, 2), "front": False,
        "mouth": (2, 6, 2, 2), "sleep_eyes": [(6, 4)],
        "visor": False, "tongue": False,
    },
    "lekismon": {
        "eyes": [(5, 3), (8, 3)], "eye_size": (2, 1), "front": True,
        "mouth": (5, 5, 2, 2), "sleep_eyes": [(5, 3), (8, 3)],
        "visor": False, "tongue": True,
    },
    "crescemon": {
        "eyes": [(6, 4)], "eye_size": (2, 1), "front": False,
        "mouth": (4, 5, 2, 2), "sleep_eyes": [(6, 4)],
        "visor": False, "tongue": True,
    },
    "dianamon": {
        "eyes": [(6, 5)], "eye_size": (2, 2), "front": False,
        "mouth": (5, 8, 3, 2), "sleep_eyes": [(6, 4)],
        "visor": False, "tongue": True,
    },
    "gracenovamon": {
        "eyes": [(5, 4), (7, 4)], "eye_size": (2, 1), "front": True,
        "mouth": (4, 6, 2, 2), "sleep_eyes": [(6, 3)],
        "visor": False, "tongue": True,
    },
    "plotmon": {
        "eyes": [(4, 6), (9, 6)], "eye_size": (2, 2), "front": True,
        "mouth": (6, 8, 3, 2), "sleep_eyes": [(4, 6), (9, 6)],
        "visor": False, "tongue": False,
    },
    "meicoomon": {
        "eyes": [(4, 3), (7, 4)], "eye_size": (2, 2), "front": True,
        "mouth": (5, 7, 3, 2), "sleep_eyes": [(5, 4), (8, 4)],
        "visor": False, "tongue": False,
    },
    "meicrackmon": {
        "eyes": [(6, 5)], "eye_size": (2, 2), "front": False,
        "mouth": (3, 7, 2, 2), "sleep_eyes": [(6, 4)],
        "visor": False, "tongue": True,
    },
    "rasielmon": {
        "eyes": [(6, 4), (11, 4)], "eye_size": (2, 2), "front": True,
        "mouth": (5, 8, 3, 2), "sleep_eyes": [(6, 3), (10, 5)],
        "visor": False, "tongue": True,
    },
}

# Official-style 16-grid ∩ (inverted-U / happy ^), relative to eye origin.
# Dark outline cells; the interior and the original eye rect are filled.
ARC_BIG = [(0, 0), (1, 0), (-1, 1), (2, 1)]          #  ##
                                                     # #  #
SLEEP_LINE_BIG = [(-1, 0), (0, 0), (1, 0), (2, 0)]
SLEEP_LINE_SMALL = [(-1, 0), (0, 0), (1, 0)]


def luma(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def to16(im32):
    return B.down_scale(R.rgba(im32), 2)


def to32(im16):
    return R.rgba(im16).resize((32, 32), Image.Resampling.NEAREST)


def outline_and_fill(im16, eye_xy, eye_size):
    """Darkest ink = outline; a mid neighbor of the eye = face fill."""
    a = np.array(R.rgba(im16))
    ink = a[:, :, 3] >= 128
    if not ink.any():
        return (0, 0, 0, 255), (200, 200, 200, 255)
    cols = [tuple(int(v) for v in p) for p in a[ink]]
    outline = min(cols, key=lambda c: luma(c))
    ex, ey = eye_xy
    ew, eh = eye_size
    neigh = []
    h, w = a.shape[:2]
    for y in range(max(0, ey - 1), min(h, ey + eh + 2)):
        for x in range(max(0, ex - 2), min(w, ex + ew + 3)):
            if a[y, x, 3] < 128:
                continue
            c = tuple(int(v) for v in a[y, x])
            if luma(c) > luma(outline) + 25:
                neigh.append(c)
    if neigh:
        fill = tuple(int(v) for v in np.median(np.array(neigh), axis=0))
    else:
        mids = [c for c in cols if 40 < luma(c) < 200]
        fill = mids[len(mids) // 2] if mids else (200, 200, 200, 255)
    return outline[:3] + (255,), fill[:3] + (255,)


def mouth_color(im16, outline):
    a = np.array(R.rgba(im16))
    ink = a[:, :, 3] >= 128
    if ink.any():
        cols = [tuple(int(v) for v in p[:3]) for p in a[ink]]
        blackish = [c for c in cols if c[0] < 30 and c[1] < 30 and c[2] < 30]
        if blackish:
            return blackish[0] + (255,)
    return outline[:3] + (255,)


def set_cell(px, x, y, color, w=16, h=16, only_ink=False):
    if 0 <= x < w and 0 <= y < h:
        if only_ink and px[x, y][3] < 128:
            return False
        px[x, y] = color[:3] + (255,)
        return True
    return False


def erase_eye(im16, ex, ey, ew, eh, fill):
    px = im16.load()
    for dy in range(-1, eh + 1):
        for dx in range(-1, ew + 1):
            x, y = ex + dx, ey + dy
            if 0 <= x < 16 and 0 <= y < 16 and px[x, y][3] >= 128:
                # only erase inside / immediately around the eye rect
                if 0 <= dx < ew and 0 <= dy < eh:
                    px[x, y] = fill
    return im16


def stamp_happy_eye(im16, ex, ey, ew, eh, outline, fill):
    erase_eye(im16, ex, ey, ew, eh, fill)
    arc = ARC_BIG  # always the official 4-cell ∩ so it reads at 3× game scale
    ox = ex + max(0, (ew - 2) // 2)
    oy = ey
    px = im16.load()
    # Fill interior of the ∩ with face fill (already erased)
    for dx, dy in arc:
        set_cell(px, ox + dx, oy + dy, outline)
    return im16


def stamp_sleep_eye(im16, ex, ey, ew, eh, outline, fill):
    erase_eye(im16, ex, ey, ew, max(eh, 2), fill)
    line = SLEEP_LINE_SMALL if (ew <= 1 and eh <= 1) else SLEEP_LINE_BIG
    ox = ex + max(0, (ew - 2) // 2)
    oy = ey + max(0, eh // 2)
    px = im16.load()
    for dx, dy in line:
        set_cell(px, ox + dx, oy + dy, outline)
    return im16


def stamp_mouth(im16, mx, my, w, h, color):
    px = im16.load()
    for dy in range(h):
        for dx in range(w):
            set_cell(px, mx + dx, my + dy, color, only_ink=True)
    return im16


def stamp_tongue(im16, mx, my, mw, mh, pink, outline):
    """Hang a 2×3 tongue from the bottom of the mouth."""
    px = im16.load()
    tx = mx + max(0, mw // 2 - 1)
    ty = my + mh
    for dy in range(0, 3):
        half = 1 if dy < 2 else 0
        for dx in range(-half, 2):
            x, y = tx + dx, ty + dy
            if not (0 <= x < 16 and 0 <= y < 16):
                continue
            edge = dy == 2 or dx in (-half, 1)
            px[x, y] = (outline[:3] + (255,)) if edge else (pink[:3] + (255,))
    return im16


def tongue_pink(im16):
    a = np.array(R.rgba(im16))
    ink = a[:, :, 3] >= 128
    if ink.any():
        cols = [tuple(int(v) for v in p[:3]) for p in a[ink]]
        reds = [c for c in cols if c[0] > c[1] + 30 and c[0] > c[2] + 10 and c[0] > 80]
        if reds:
            reds.sort(key=lambda c: -c[0])
            return reds[0] + (255,)
    return (232, 88, 112, 255)


def pose_similar(a, b, iou_min=0.89):
    aa, bb = np.array(R.rgba(a)), np.array(R.rgba(b))
    ma, mb = aa[:, :, 3] >= 128, bb[:, :, 3] >= 128
    inter = np.logical_and(ma, mb).sum()
    union = np.logical_or(ma, mb).sum()
    iou = inter / union if union else 0.0
    if iou < iou_min:
        return False
    def bbh(m):
        ys, xs = np.where(m)
        if len(ys) == 0:
            return 0, 0
        return int(ys.max() - ys.min() + 1), int(xs.max() - xs.min() + 1)
    ha, wa = bbh(ma)
    hb, wb = bbh(mb)
    return abs(ha - hb) <= 4 and abs(wa - wb) <= 5


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
    a_ink, b_ink = aa[:, :, 3] >= 128, bb[:, :, 3] >= 128
    if not np.array_equal(a_ink, b_ink):
        return False
    return np.array_equal(aa[a_ink][:, :3], bb[a_ink][:, :3])


def decode_all(entry):
    return {name: B.decode_entry(entry, name) for name in entry["frames"]}


def pick_eat_base(frames, meta):
    idle = R.rgba(frames["idle0"])
    for k in ("eat1", "eat0", "eat"):
        if k in frames and is_official(meta, k) and pose_similar(frames[k], idle):
            return k, R.rgba(frames[k]).copy(), True
    return "idle0", idle.copy(), is_official(meta, "idle0")


def apply_one(mid, frames, meta, stats):
    if mid not in T:
        return frames, meta, []
    spec = T[mid]
    idle32 = R.rgba(frames["idle0"])
    idle16 = to16(idle32)
    eyes = spec["eyes"]
    ew, eh = spec["eye_size"]
    mx, my, mw, mh = spec["mouth"]
    outline, fill = outline_and_fill(idle16, eyes[0], (ew, eh))
    mcol = mouth_color(idle16, outline)
    changed = []

    def write32(im16):
        return to32(im16)

    # --- eat0 / eat1 / eat (designed only) ---
    if designed(meta, "eat0", frames):
        im = idle16.copy()
        stamp_mouth(im, mx, my, max(1, mw - 1), max(1, mh - 1), mcol)
        frames["eat0"] = write32(im)
        meta["eat0"] = {"kind": "designed", "src": "manual-eat0"}
        changed.append("eat0"); stats["eat0"] += 1
    if designed(meta, "eat1", frames):
        im = idle16.copy()
        stamp_mouth(im, mx, my, mw, mh, mcol)
        frames["eat1"] = write32(im)
        meta["eat1"] = {"kind": "designed", "src": "manual-eat1"}
        changed.append("eat1"); stats["eat1"] += 1
    if designed(meta, "eat", frames):
        src = frames.get("eat1") or frames.get("eat0") or write32(stamp_mouth(idle16.copy(), mx, my, mw, mh, mcol))
        frames["eat"] = R.rgba(src).copy()
        meta["eat"] = {"kind": "designed", "src": "manual-eat-alias"}
        changed.append("eat"); stats["eat"] += 1

    # --- happy ---
    if designed(meta, "happy", frames):
        bk, base32, official = pick_eat_base(frames, meta)
        im = to16(base32)
        if bk == "idle0":
            stamp_mouth(im, mx, my, mw, mh, mcol)
        for (ex, ey) in eyes:
            stamp_happy_eye(im, ex, ey, ew, eh, outline, fill)
        frames["happy"] = write32(im)
        meta["happy"] = {"kind": "designed", "src": f"manual-happy-from-{bk}"}
        changed.append("happy"); stats["happy"] += 1

    # --- angry ---
    if designed(meta, "angry", frames):
        bk, base32, official = pick_eat_base(frames, meta)
        im = to16(base32)
        if bk == "idle0":
            stamp_mouth(im, mx, my, mw, mh, mcol)
        # keep original / fierce eyes (NOT ^^). Optional 2-cell brow above first eye.
        if not spec.get("visor"):
            px = im.load()
            ex, ey = eyes[0]
            set_cell(px, ex, ey - 1, outline, only_ink=True)
            set_cell(px, ex + 1, ey - 1, outline, only_ink=True)
        frames["angry"] = write32(im)
        if official and bk.startswith("eat"):
            # If we only copied official eat and added at most a brow, keep designed
            # tag when the brow changed pixels; if no brow, it may equal official eat.
            meta["angry"] = {"kind": "designed", "src": f"manual-angry-from-{bk}"}
        else:
            meta["angry"] = {"kind": "designed", "src": f"manual-angry-from-{bk}"}
        changed.append("angry"); stats["angry"] += 1

    # --- refuse ---
    if designed(meta, "refuse", frames):
        if spec.get("tongue"):
            im = idle16.copy()
            stamp_mouth(im, mx, my, max(1, mw), max(1, mh - 1), mcol)
            stamp_tongue(im, mx, my, mw, mh, tongue_pink(idle16), outline)
            frames["refuse"] = write32(im)
            meta["refuse"] = {"kind": "designed", "src": "manual-refuse-tongue"}
        elif mid in R.BABIES:
            frames["refuse"] = R.shift_im(idle32, 0, 2)
            meta["refuse"] = {"kind": "designed", "src": "manual-refuse-baby"}
        else:
            bowed = R.refuse_pose(idle16.copy(), idle16)
            frames["refuse"] = write32(bowed)
            meta["refuse"] = {"kind": "designed", "src": "manual-refuse-bow"}
        changed.append("refuse"); stats["refuse"] += 1

    # --- sleep: keep body, stamp closed-line eyes at sleep_eyes ---
    for sk in ("sleep0", "sleep1", "sleep"):
        if not designed(meta, sk, frames):
            continue
        # sleep1 handled after sleep0 as a 1px shift if sleep0 exists
        if sk == "sleep1":
            continue
        im = to16(frames[sk])
        seyes = spec.get("sleep_eyes") or eyes
        # outline/fill from the sleep sprite itself (crib colours differ)
        o2, f2 = outline_and_fill(im, seyes[0], (ew, eh))
        for (ex, ey) in seyes:
            stamp_sleep_eye(im, ex, ey, ew, eh, o2, f2)
        frames[sk] = write32(im)
        meta[sk] = {"kind": "designed", "src": "manual-sleep-line"}
        changed.append(sk); stats[sk] += 1

    if designed(meta, "sleep1", frames):
        if "sleep0" in frames:
            frames["sleep1"] = R.shift_im(R.rgba(frames["sleep0"]), 1, 0)
            meta["sleep1"] = {"kind": "designed", "src": "manual-sleep1-shift"}
            changed.append("sleep1"); stats["sleep1"] += 1

    # --- hurt1: 1px bob of official hurt; leave unique designed slump alone ---
    if designed(meta, "hurt1", frames):
        if "hurt" in frames and is_official(meta, "hurt"):
            frames["hurt1"] = R.shift_im(R.rgba(frames["hurt"]), 0, 1)
            meta["hurt1"] = {"kind": "designed", "src": "manual-hurt1-shift"}
            changed.append("hurt1"); stats["hurt1"] += 1
        elif "hurt0" in frames and is_official(meta, "hurt0"):
            frames["hurt1"] = R.shift_im(R.rgba(frames["hurt0"]), 0, 1)
            meta["hurt1"] = {"kind": "designed", "src": "manual-hurt1-shift"}
            changed.append("hurt1"); stats["hurt1"] += 1

    # --- designed hurt (no official): slump of idle, slightly closed/grimace, no X ---
    if designed(meta, "hurt", frames) and not is_official(meta, "hurt"):
        im = idle16.copy()
        # slight closed line (shorter than sleep) + keep a grimace mouth
        for (ex, ey) in eyes:
            px = im.load()
            set_cell(px, ex, ey, outline, only_ink=True)
            set_cell(px, ex + 1, ey, outline, only_ink=True)
        stamp_mouth(im, mx, my, max(1, mw - 1), max(1, mh - 1), mcol)
        slumped = R.hurt_pose(im, im, slump=1)
        frames["hurt"] = write32(slumped)
        meta["hurt"] = {"kind": "designed", "src": "manual-hurt-slump"}
        if designed(meta, "hurt0", frames):
            frames["hurt0"] = R.rgba(frames["hurt"]).copy()
        if designed(meta, "hurt1", frames) and kind_of(meta, "hurt1") != "designed":
            pass
        if designed(meta, "hurt1", frames) and meta.get("hurt1", {}).get("src") != "manual-hurt1-shift":
            frames["hurt1"] = R.shift_im(R.rgba(frames["hurt"]), 0, 1)
            meta["hurt1"] = {"kind": "designed", "src": "manual-hurt1-from-hurt"}
            if "hurt1" not in changed:
                changed.append("hurt1"); stats["hurt1"] += 1
        changed.append("hurt"); stats["hurt"] += 1

    # --- attack designed ---
    if designed(meta, "attack", frames):
        im = idle16.copy()
        stamp_mouth(im, mx, my, mw, mh, mcol)
        att = write32(im)
        frames["attack"] = R.shift_im(att, -2, 0)
        meta["attack"] = {"kind": "designed", "src": "manual-attack"}
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


def tile32(im, scale, bg=(250, 248, 244, 255)):
    cell = 32 * scale
    tile = Image.new("RGBA", (cell, cell), bg)
    s = R.rgba(im).resize((cell, cell), Image.Resampling.NEAREST)
    return Image.alpha_composite(tile, s).convert("RGB")


def make_happy_check(ids, frames, names, official_frames, path):
    """idle0 | happy | sleep0 at 6x, 3 official examples on top."""
    scale = 6
    cell = 32 * scale
    label_w = 130
    tag_h = 18
    row_h = cell + tag_h + 6
    header = 40
    official_ids = ["agumon", "koromon", "ogremon"]
    all_ids = official_ids + list(ids)
    W = label_w + 3 * (cell + 8) + 10
    H = header + len(all_ids) * row_h + 8
    sheet = Image.new("RGB", (W, H), (236, 232, 224))
    dr = ImageDraw.Draw(sheet)
    f, fs = font(14), font(11)
    dr.text((8, 8), "happy-check  ×6　左 idle0  中 happy（^^ 必須清楚）  右 sleep0（閉眼橫線）　上三列為官方", fill=(30, 26, 22), font=f)
    cols = ["idle0", "happy", "sleep0"]
    for i, k in enumerate(cols):
        dr.text((label_w + i * (cell + 8) + 4, header - 16), k, fill=(80, 70, 60), font=fs)
    for r, mid in enumerate(all_ids):
        y = header + r * row_h
        official = mid in official_ids
        zh, en = names.get(mid, ("", mid))
        tag = "官方" if official else "自製"
        dr.text((6, y + 40), zh or mid, fill=(20, 20, 20), font=fs)
        dr.text((6, y + 58), mid, fill=(110, 100, 90), font=fs)
        dr.text((6, y + 76), tag, fill=(160, 60, 50) if official else (60, 80, 140), font=fs)
        frs = official_frames[mid] if official else frames[mid]
        for i, k in enumerate(cols):
            src = frs.get(k) or frs.get("idle0")
            sheet.paste(tile32(src, scale), (label_w + i * (cell + 8), y))
    sheet.save(path)
    print("wrote", path, sheet.size)
    return path


def make_expression_check(ids, frames, meta, names, path):
    """For all 44: every designed frame next to idle0 at 6x, with source tag."""
    scale = 6
    cell = 32 * scale
    label_w = 130
    tag_h = 16
    keys_all = ["idle0", "eat0", "eat1", "happy", "angry", "refuse", "sleep0", "sleep1", "attack", "hurt"]
    # width uses all keys (idle always + designed; official designed-skipped still shown dim? show all but tag)
    W = label_w + len(keys_all) * (cell + 6) + 10
    header = 48
    row_h = cell + tag_h + 8
    H = header + len(ids) * row_h + 8
    sheet = Image.new("RGB", (W, H), (236, 232, 224))
    dr = ImageDraw.Draw(sheet)
    f, fs = font(14), font(10)
    dr.text((8, 6), "expression-check  ×6　每隻自製表情列在 idle0 旁，格下標來源（官方彩色 / 自製）。請用遊戲 3× 尺度檢視表情是否清楚。", fill=(30, 26, 22), font=f)
    for i, k in enumerate(keys_all):
        dr.text((label_w + i * (cell + 6) + 2, 28), k, fill=(80, 70, 60), font=fs)
    kind_zh = {
        "official_color": "官方彩色",
        "official_mono_colorized": "官方點陣上色",
        "designed": "自製",
        "kept_existing_idle": "既有上色",
        "kept": "既有",
    }
    for r, mid in enumerate(ids):
        y = header + r * row_h
        zh, en = names.get(mid, ("", mid))
        dr.text((6, y + 50), zh or mid, fill=(20, 20, 20), font=fs)
        dr.text((6, y + 68), mid, fill=(110, 100, 90), font=fs)
        frs = frames[mid]
        kinds = meta[mid]
        for i, k in enumerate(keys_all):
            x = label_w + i * (cell + 6)
            src = frs.get(k)
            if src is None:
                # empty slot
                ImageDraw.Draw(sheet).rectangle([x, y, x + cell, y + cell], fill=(220, 218, 212))
                continue
            sheet.paste(tile32(src, scale), (x, y))
            kk = kinds.get(k, {}).get("kind", "")
            tag = kind_zh.get(kk, kk)
            color = (160, 60, 50) if kk == "official_color" else ((60, 80, 140) if kk == "designed" else (90, 90, 90))
            dr.text((x + 2, y + cell + 1), tag, fill=color, font=fs)
    sheet.save(path)
    print("wrote", path, sheet.size)
    return path


def main():
    # Start from the pre-expression (post-pose-redraw) atlas so old auto-eyes are gone.
    js_text = BAK.read_text() if BAK.exists() else JS_PATH.read_text()
    existing = B.parse_existing_sprites(js_text)
    cov = json.loads(COV_PATH.read_text())
    names = R.load_names()
    ids = [m for m in T.keys()]
    assert len(ids) == 44, len(ids)
    stats = Counter()
    new_frames = {}
    new_meta = {}

    for mid in ids:
        frames = decode_all(existing[mid])
        meta = {k: dict(v) for k, v in cov["monsters"][mid].items()}
        before = {k: R.rgba(v).copy() for k, v in frames.items()}
        frames, meta, changed = apply_one(mid, frames, meta, stats)
        # restore any official_color that might have been written
        for k, im in list(frames.items()):
            if kind_of(cov["monsters"][mid], k) == "official_color":
                if not frames_equal(before[k], im):
                    print("RESTORING official", mid, k)
                    frames[k] = before[k]
        new_frames[mid] = frames
        new_meta[mid] = meta

    # write sprites
    text = js_text
    for mid, frames in new_frames.items():
        text = R.replace_entry(text, mid, B.encode_sprite(frames))
    JS_PATH.write_text(text)
    print("wrote", JS_PATH, "bytes", JS_PATH.stat().st_size)

    # official drift vs backup
    bak = B.parse_existing_sprites(BAK.read_text()) if BAK.exists() else existing
    now = B.parse_existing_sprites(text)
    drift = 0
    for mid in ids:
        for k, v in cov["monsters"][mid].items():
            if v.get("kind") != "official_color":
                continue
            if k not in bak[mid]["frames"] or k not in now[mid]["frames"]:
                continue
            if not frames_equal(B.decode_entry(bak[mid], k), B.decode_entry(now[mid], k)):
                print("OFFICIAL DRIFT", mid, k)
                drift += 1
    print("official drift", drift, "stats", dict(stats))

    # official examples for happy-check
    official_frames = {mid: decode_all(now[mid]) for mid in ("agumon", "koromon", "ogremon")}
    make_happy_check(ids, new_frames, names, official_frames, ROOT / "happy-check.png")
    # expression-check uses updated meta
    make_expression_check(ids, new_frames, new_meta, names, ROOT / "expression-check.png")

    # also refresh anim-sample
    sample = [
        "agumon", "omegamon", "dorumon", "lasttyranomon", "titamon", "lunamon", "kingetemon", "meicoomon",
        "hackmon", "jesmon", "zubamon", "dracomon", "alphamon", "coronamon", "petitmon", "dorugamon",
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
