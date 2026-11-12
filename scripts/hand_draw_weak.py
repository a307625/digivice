#!/usr/bin/env python3
"""Hand-draw weak 32x32 sprites from official 16-grid V-pet silhouettes.

Fills every solid design pixel with official-style colors (Reference Book /
game appearance), then 2x nearest, then a readable 1px dark outline.
Output goes to ref/overrides/{id}_idle0.png (rebuild prefers these).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rebuild_sprites as R

ROOT = Path("/workspace/digivice")
REF = ROOT / "ref" / "wikimon"
OV = ROOT / "ref" / "overrides"
PREV = Path("/tmp/redraw")
OV.mkdir(exist_ok=True)
PREV.mkdir(exist_ok=True)

FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
MAP = json.loads((ROOT / "ref" / "mapping.json").read_text())["primary"]


def rgba(c, a=255):
    if len(c) == 4:
        return c
    return (c[0], c[1], c[2], a)


def flood_knock(im: Image.Image, dark=18) -> Image.Image:
    """Knock corner-connected transparent OR near-black OR paper-white background."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def isbg(c):
        r, g, b, a = c
        if a < 16:
            return True
        if r <= dark and g <= dark and b <= dark:
            return True
        if r >= 248 and g >= 248 and b >= 248:
            return True
        return False

    seen = [[False] * w for _ in range(h)]
    st = []
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if isbg(px[x, y]):
            st.append((x, y))
    while st:
        x, y = st.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        if not isbg(px[x, y]):
            continue
        seen[y][x] = True
        px[x, y] = (0, 0, 0, 0)
        st.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def load_mask16(mid: str) -> Image.Image:
    fn = MAP[mid].replace(" ", "_")
    path = REF / fn
    frs = R.gif_frames(path)
    raw = flood_knock(frs[0]) if frs[0].size[0] >= 64 else frs[0].convert("RGBA")
    # For 36x36 mono: do NOT knock white first in a way that matters; ink is black.
    if raw.size == (36, 36):
        raw = frs[0].convert("RGBA")
        crop = raw.crop((2, 2, 34, 34))
        small = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        sp, px = small.load(), crop.load()
        for y in range(16):
            for x in range(16):
                cells = [px[x * 2 + dx, y * 2 + dy] for dy in range(2) for dx in range(2)]
                ink = [c for c in cells if c[3] >= 128 and (c[0] + c[1] + c[2]) / 3 < 140]
                if len(ink) >= 2:
                    sp[x, y] = (0, 0, 0, 255)
        return small
    if raw.size == (128, 128):
        k = flood_knock(frs[0])
        return k.resize((16, 16), Image.NEAREST)
    if raw.size == (48, 48):
        k = R.knock_bg(frs[0])
        # preserve light fills: a cell is solid if any non-bg pixel exists
        small = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        sp, px = small.load(), k.load()
        for y in range(16):
            for x in range(16):
                cols = []
                for dy in range(3):
                    for dx in range(3):
                        c = px[x * 3 + dx, y * 3 + dy]
                        if c[3] >= 128 and not (c[0] >= 248 and c[1] >= 248 and c[2] >= 248 and c[3] < 16):
                            if c[3] >= 128 and not (c[0] >= 248 and c[1] >= 248 and c[2] >= 248 and k.size):
                                if c[3] >= 128:
                                    # paper white with alpha 0 already skipped; opaque white is FILL
                                    cols.append(c)
                # drop fully transparent
                cols = [c for c in cols if c[3] >= 128]
                if cols:
                    # prefer a non-outline fill if present
                    fills = [c for c in cols if (c[0] + c[1] + c[2]) / 3 > 48]
                    sp[x, y] = (fills or cols)[0]
        return small
    if raw.size == (32, 32):
        small = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        sp, px = small.load(), raw.load()
        for y in range(16):
            for x in range(16):
                cells = [px[x * 2 + dx, y * 2 + dy] for dy in range(2) for dx in range(2)]
                ink = [c for c in cells if c[3] >= 128 and (c[0] + c[1] + c[2]) / 3 < 140]
                if len(ink) >= 2:
                    sp[x, y] = (0, 0, 0, 255)
        return small
    raise RuntimeError(f"unhandled source size {raw.size} for {mid}")


def solid16(mask: Image.Image):
    px = mask.load()
    s = [[False] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            c = px[x, y]
            s[y][x] = c[3] >= 128
    return s


def render32_from_color16(col16: Image.Image, outline=(22, 16, 14, 255)) -> Image.Image:
    """2x nearest fill, then 1px outline: outward if there is room, else inward
    only when a fill sibling remains so thin 2px limbs are not eaten whole."""
    base = col16.resize((32, 32), Image.NEAREST).convert("RGBA")
    w, h = 32, 32
    px = base.load()
    # First try outward outline into empty pixels
    add = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 128:
                continue
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h:
                    continue
                if px[nx, ny][3] < 128:
                    add.append((nx, ny))
    for x, y in add:
        if px[x, y][3] < 128:
            px[x, y] = outline
    # Inward outline where we couldn't expand (canvas edge, or already outlined)
    # Convert an edge fill pixel to outline if it has a filled 4-neighbor that stays fill.
    convert = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 128 or px[x, y][:3] == outline[:3]:
                continue
            edge = False
            has_fill_sib = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or px[nx, ny][3] < 128:
                    edge = True
                else:
                    if px[nx, ny][:3] != outline[:3]:
                        has_fill_sib = True
            # Only inward-outline on the original 32 border of the pre-outward image
            # We already added outward; remaining "edge against canvas" cases:
            if (x == 0 or y == 0 or x == 31 or y == 31) and has_fill_sib:
                convert.append((x, y))
    for x, y in convert:
        px[x, y] = outline
    return base


def paint_standard(mask: Image.Image, pal: dict, overlay: dict, belly=None, metal=None, hair=None) -> Image.Image:
    """Shade a 16-mask with body/hi/shadow plus optional region fns and pixel overlays.

    overlay: {(x,y): 'E'|'P'|'W'|'C'|'A'|'N'|'M'|'R'|'K'|'Y'|'U'|'H'|'S'|'B'}
    belly/metal/hair: predicates (x,y) -> bool
    """
    s = solid16(mask)
    pal = {k: rgba(v) for k, v in pal.items()}
    out = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    op = out.load()
    for y in range(16):
        for x in range(16):
            if not s[y][x]:
                continue
            if hair and hair(x, y) and "N" in pal:
                op[x, y] = pal["N"]
            elif metal and metal(x, y) and "M" in pal:
                op[x, y] = pal["M"]
            elif belly and belly(x, y) and "C" in pal:
                op[x, y] = pal["C"]
            elif y <= 5 and x <= 8 and "H" in pal:
                op[x, y] = pal["H"]
            elif y >= 11 and x >= 8 and "S" in pal:
                op[x, y] = pal["S"]
            else:
                op[x, y] = pal["B"]
    # overlays last
    for (x, y), ch in overlay.items():
        if 0 <= x < 16 and 0 <= y < 16:
            key = ch if ch in pal else ch.upper()
            if key in pal:
                op[x, y] = pal[key]
                # overlays may add an eye in a hole (not originally solid)
    return out


# Official-ish palettes (outline, body, highlight, shadow, cream, accents, eyes)
def pal(**k):
    # defaults
    d = dict(
        O=(22, 16, 14, 255),
        B=(180, 140, 80, 255),
        H=(220, 190, 120, 255),
        S=(130, 90, 50, 255),
        C=(240, 224, 192, 255),
        A=(200, 160, 40, 255),
        N=(80, 100, 180, 255),
        E=(80, 200, 80, 255),
        P=(16, 12, 10, 255),
        W=(255, 255, 255, 255),
        M=(200, 208, 216, 255),
        R=(196, 40, 36, 255),
        K=(32, 32, 40, 255),
        Y=(232, 196, 48, 255),
        U=(120, 90, 180, 255),
    )
    d.update({kk: rgba(vv) for kk, vv in k.items()})
    return d


# Specs: palette + overlays + regions. Coordinates are 16-grid.
# Eyes follow style-guide: iris + pupil + optional shine, oversized and readable.

SPECS = {}

# ----- Zuba line -----
SPECS["sakumon"] = dict(
    pal=pal(B=(200, 208, 218), H=(236, 242, 248), S=(140, 148, 160), C=(236, 242, 248),
            E=(248, 212, 48), P=(20, 16, 12), O=(22, 18, 16)),
    overlay={(8, 4): "E", (8, 5): "P"},
)
SPECS["sakuttomon"] = dict(
    pal=pal(B=(200, 208, 218), H=(236, 242, 248), S=(140, 148, 160),
            E=(248, 212, 48), P=(20, 16, 12), O=(22, 18, 16)),
    overlay={(5, 5): "E", (5, 6): "P", (11, 5): "E", (11, 6): "P"},
)
SPECS["zubamon"] = dict(
    pal=pal(B=(228, 180, 36), H=(250, 220, 100), S=(170, 120, 20), C=(240, 230, 200),
            M=(210, 216, 224), E=(40, 48, 40, 255), P=(16, 12, 10), W=(255, 255, 255),
            O=(26, 16, 8)),
    overlay={(6, 5): "E", (6, 6): "P", (7, 5): "W"},
    belly=lambda x, y: 6 <= x <= 10 and 8 <= y <= 12,
)
SPECS["zubaeagermon"] = dict(
    pal=pal(B=(228, 180, 36), H=(250, 220, 100), S=(170, 120, 20), C=(240, 230, 200),
            M=(210, 216, 224), E=(40, 48, 40, 255), P=(16, 12, 10), O=(26, 16, 8)),
    overlay={(6, 5): "E", (6, 6): "P"},
    belly=lambda x, y: 5 <= x <= 10 and 8 <= y <= 12,
    metal=lambda x, y: y <= 3 or x <= 1,
)
SPECS["duramon"] = dict(
    pal=pal(B=(212, 168, 40), H=(240, 210, 110), S=(150, 110, 24), C=(230, 230, 220),
            M=(196, 204, 214), E=(40, 160, 200), P=(16, 12, 10), O=(24, 16, 10)),
    overlay={(6, 4): "E", (6, 5): "P"},
    metal=lambda x, y: x <= 3 or y <= 2,
    belly=lambda x, y: 6 <= x <= 10 and 8 <= y <= 11,
)
SPECS["durandamon"] = dict(
    pal=pal(B=(212, 168, 40), H=(240, 210, 110), S=(150, 110, 24),
            M=(196, 204, 214), E=(40, 160, 200), P=(16, 12, 10), O=(24, 16, 10)),
    overlay={(5, 5): "E", (5, 6): "P"},
    metal=lambda x, y: x <= 2 or (y <= 3 and x <= 8),
)

# ----- Hack line -----
SPECS["hackmon"] = dict(
    pal=pal(B=(236, 236, 232), H=(252, 252, 250), S=(170, 170, 168), C=(236, 236, 232),
            R=(196, 40, 36), E=(248, 212, 48), P=(20, 16, 12), O=(22, 16, 16)),
    overlay={(6, 5): "E", (6, 6): "P", (14, 2): "R", (13, 3): "R", (15, 1): "R"},
    belly=lambda x, y: 5 <= x <= 9 and 8 <= y <= 12,
)
SPECS["baohackmon"] = dict(
    pal=pal(B=(236, 236, 232), H=(252, 252, 250), S=(170, 170, 168),
            R=(196, 40, 36), Y=(212, 168, 40), E=(248, 212, 48), P=(20, 16, 12), O=(22, 16, 16)),
    overlay={(6, 5): "E", (6, 6): "P"},
    hair=lambda x, y: y <= 3 or (x >= 12 and y <= 6),  # red scarf / crest uses N? use R via overlay regions
)
# fix baohackmon red cape via metal/hair: I'll use N as red
SPECS["baohackmon"]["pal"]["N"] = (196, 40, 36, 255)
SPECS["baohackmon"]["hair"] = lambda x, y: (y <= 2 and x >= 8) or (x >= 13 and y <= 7)

SPECS["saviorhackmon"] = dict(
    pal=pal(B=(236, 236, 232), H=(252, 252, 250), S=(170, 170, 168),
            R=(196, 40, 36), Y=(212, 168, 40), N=(196, 40, 36),
            E=(80, 200, 220), P=(16, 12, 10), O=(22, 16, 16), M=(200, 208, 216)),
    overlay={(6, 4): "E", (6, 5): "P"},
    hair=lambda x, y: y <= 2 or x >= 13,
    metal=lambda x, y: 3 <= x <= 8 and 8 <= y <= 11,
)

# ----- Draco line -----
SPECS["dracomon"] = dict(
    pal=pal(B=(200, 52, 36), H=(236, 120, 70), S=(130, 28, 20), C=(240, 216, 168),
            N=(48, 88, 170), E=(248, 232, 96), P=(20, 16, 12), W=(255, 255, 255),
            O=(28, 14, 10)),
    overlay={(6, 4): "E", (7, 4): "W", (6, 5): "P"},
    belly=lambda x, y: 5 <= x <= 10 and 7 <= y <= 11,
    hair=lambda x, y: (x >= 12 and y <= 6) or (x >= 13),  # small blue wing
)
SPECS["coredramon_blue"] = dict(
    pal=pal(B=(40, 92, 196), H=(110, 160, 230), S=(20, 48, 120), C=(232, 232, 236),
            E=(248, 232, 96), P=(16, 12, 10), R=(196, 40, 36), O=(12, 16, 28)),
    overlay={(6, 4): "E", (6, 5): "P", (4, 3): "C"},
    belly=lambda x, y: 5 <= x <= 10 and 7 <= y <= 11,
)
SPECS["coredramon_green"] = dict(
    pal=pal(B=(40, 140, 60), H=(110, 196, 100), S=(20, 80, 36), C=(232, 232, 200),
            E=(248, 232, 96), P=(16, 12, 10), O=(12, 24, 14)),
    overlay={(6, 4): "E", (6, 5): "P"},
    belly=lambda x, y: 5 <= x <= 10 and 7 <= y <= 11,
)
SPECS["wingdramon"] = dict(
    pal=pal(B=(48, 108, 200), H=(150, 190, 236), S=(24, 48, 120), C=(240, 244, 248),
            E=(248, 232, 96), P=(16, 12, 10), O=(12, 16, 28)),
    overlay={(6, 7): "E", (6, 8): "P"},
    belly=lambda x, y: 4 <= x <= 9 and 8 <= y <= 12,
    hair=lambda x, y: x >= 11,  # wing (use C/H already); keep blue
)
SPECS["wingdramon"]["pal"]["N"] = (200, 220, 245, 255)
SPECS["wingdramon"]["hair"] = lambda x, y: x >= 12
SPECS["slayerdramon"] = dict(
    pal=pal(B=(228, 232, 240), H=(248, 250, 255), S=(150, 158, 176),
            N=(48, 100, 196), Y=(212, 168, 40), E=(80, 200, 220), P=(16, 12, 10),
            O=(16, 18, 28), M=(200, 208, 220)),
    overlay={(6, 4): "E", (6, 5): "P"},
    hair=lambda x, y: x >= 13 or y <= 1,
    metal=lambda x, y: 4 <= x <= 10 and 6 <= y <= 10,
)
SPECS["groundramon"] = dict(
    pal=pal(B=(48, 88, 40), H=(96, 140, 70), S=(24, 48, 24), C=(120, 90, 48),
            E=(248, 232, 96), P=(16, 12, 10), O=(16, 20, 12)),
    overlay={(5, 8): "E", (5, 9): "P"},
    belly=lambda x, y: 5 <= x <= 9 and 8 <= y <= 11,
)

# ----- Doru line -----
SPECS["dodomon"] = dict(
    pal=pal(B=(48, 40, 56), H=(90, 80, 100), S=(24, 20, 28), C=(200, 196, 210),
            U=(120, 80, 160), E=(248, 80, 80), P=(16, 12, 10), W=(255, 220, 220),
            O=(20, 16, 24)),
    overlay={(6, 11): "E", (7, 11): "P", (9, 11): "E", (10, 11): "P"},
)
SPECS["dorimon"] = dict(
    pal=pal(B=(48, 40, 56), H=(90, 80, 100), S=(24, 20, 28),
            E=(248, 80, 80), P=(16, 12, 10), O=(20, 16, 24)),
    overlay={(6, 10): "E", (7, 10): "P", (9, 10): "E", (10, 10): "P"},
)
SPECS["dorumon"] = dict(
    pal=pal(B=(236, 232, 240), H=(255, 255, 255), S=(160, 156, 168),
            K=(40, 32, 48), U=(120, 80, 160), E=(80, 48, 16), P=(16, 12, 10),
            W=(255, 255, 255), O=(20, 16, 24)),
    overlay={(6, 4): "E", (7, 4): "W", (6, 5): "P"},
    hair=lambda x, y: y <= 2 or x >= 13,  # purple/black hair-horn — use K
)
SPECS["dorumon"]["pal"]["N"] = (40, 32, 48, 255)
SPECS["dorumon"]["hair"] = lambda x, y: y <= 2 or (x >= 13 and y <= 8)
SPECS["dorugamon"] = dict(
    pal=pal(B=(236, 232, 240), H=(255, 255, 255), S=(160, 156, 168),
            K=(40, 32, 48), U=(100, 70, 140), E=(80, 48, 16), P=(16, 12, 10),
            O=(20, 16, 24)),
    overlay={(5, 4): "E", (5, 5): "P"},
    hair=lambda x, y: y <= 2 or x >= 13,
)
SPECS["dorugamon"]["pal"]["N"] = (40, 32, 48, 255)
SPECS["doruguremon"] = dict(
    pal=pal(B=(48, 40, 56), H=(90, 80, 100), S=(24, 20, 32), C=(200, 200, 210),
            U=(120, 80, 160), E=(248, 212, 48), P=(16, 12, 10), O=(16, 14, 20)),
    overlay={(6, 8): "E", (6, 9): "P"},
    belly=lambda x, y: 4 <= x <= 8 and 9 <= y <= 12,
    hair=lambda x, y: y <= 2,
)
SPECS["doruguremon"]["pal"]["N"] = (100, 70, 140, 255)
SPECS["alphamon"] = dict(
    pal=pal(B=(32, 32, 40), H=(70, 70, 82), S=(16, 16, 20), Y=(212, 176, 40),
            N=(40, 72, 160), E=(248, 240, 200), P=(16, 12, 10), O=(10, 10, 14),
            C=(40, 72, 160)),
    overlay={(6, 4): "E", (6, 5): "P", (7, 3): "Y", (5, 3): "Y"},
    hair=lambda x, y: x >= 11,  # blue cape
    metal=lambda x, y: y <= 2 or (4 <= x <= 8 and y == 6),
)
SPECS["alphamon"]["pal"]["M"] = (212, 176, 40, 255)

# ----- Corona line -----
SPECS["coronamon"] = dict(
    pal=pal(B=(236, 140, 28), H=(255, 200, 80), S=(170, 70, 16), C=(248, 232, 180),
            R=(196, 48, 24), E=(80, 40, 16), P=(16, 12, 10), W=(255, 240, 180),
            O=(28, 14, 8), Y=(255, 210, 70)),
    overlay={(6, 5): "E", (7, 5): "W", (6, 6): "P"},
    belly=lambda x, y: 5 <= x <= 9 and 7 <= y <= 11,
    hair=lambda x, y: y <= 2,  # sun mane
)
SPECS["coronamon"]["pal"]["N"] = (255, 200, 80, 255)
SPECS["firamon"] = dict(
    pal=pal(B=(236, 140, 28), H=(255, 200, 80), S=(170, 70, 16), C=(248, 232, 180),
            R=(196, 48, 24), E=(80, 40, 16), P=(16, 12, 10), O=(28, 14, 8)),
    overlay={(6, 4): "E", (6, 5): "P"},
    belly=lambda x, y: 4 <= x <= 9 and 6 <= y <= 10,
    hair=lambda x, y: y <= 2 or x >= 14,
)
SPECS["firamon"]["pal"]["N"] = (255, 190, 60, 255)
SPECS["flaremon"] = dict(
    pal=pal(B=(212, 120, 28), H=(240, 180, 70), S=(120, 50, 16), C=(248, 232, 180),
            R=(196, 48, 24), E=(248, 240, 160), P=(16, 12, 10), O=(28, 14, 8),
            Y=(220, 168, 40)),
    overlay={(6, 4): "E", (6, 5): "P"},
    belly=lambda x, y: 4 <= x <= 8 and 8 <= y <= 12,
    hair=lambda x, y: y <= 2,
)
SPECS["flaremon"]["pal"]["N"] = (196, 48, 24, 255)
SPECS["apollomon"] = dict(
    pal=pal(B=(220, 168, 36), H=(250, 220, 90), S=(150, 100, 20), C=(248, 232, 200),
            R=(196, 48, 28), E=(248, 240, 200), P=(16, 12, 10), O=(28, 16, 8)),
    overlay={(6, 4): "E", (6, 5): "P"},
    belly=lambda x, y: 5 <= x <= 9 and 7 <= y <= 11,
    hair=lambda x, y: y <= 2 or x >= 13,
)
SPECS["apollomon"]["pal"]["N"] = (196, 48, 28, 255)

# ----- Luna line -----
SPECS["lunamon"] = dict(
    pal=pal(B=(140, 120, 210), H=(200, 196, 236), S=(70, 60, 140), C=(244, 244, 250),
            N=(80, 80, 170), E=(248, 240, 200), P=(40, 24, 48), R=(220, 80, 120),
            O=(16, 16, 28)),
    overlay={(6, 6): "E", (6, 7): "P", (9, 6): "E", (9, 7): "P", (7, 5): "R"},  # forehead gem
    belly=lambda x, y: 5 <= x <= 10 and 8 <= y <= 12,
    hair=lambda x, y: y <= 3,  # ears stay body purple with cream inner via overlay
)
SPECS["lekismon"] = dict(
    pal=pal(B=(80, 80, 150), H=(160, 160, 210), S=(40, 40, 90), C=(240, 242, 250),
            E=(248, 240, 200), P=(24, 16, 32), O=(16, 16, 28)),
    overlay={(6, 5): "E", (6, 6): "P", (9, 5): "E", (9, 6): "P"},
    belly=lambda x, y: 5 <= x <= 10 and 7 <= y <= 12,
    hair=lambda x, y: y <= 2,
)
SPECS["lekismon"]["pal"]["N"] = (200, 200, 230, 255)
SPECS["crescemon"] = dict(
    pal=pal(B=(200, 205, 220), H=(236, 238, 248), S=(110, 110, 140), C=(244, 246, 252),
            U=(100, 90, 180), E=(248, 240, 200), P=(24, 16, 32), O=(16, 16, 28),
            N=(100, 90, 180)),
    overlay={(6, 5): "E", (6, 6): "P"},
    belly=lambda x, y: 5 <= x <= 9 and 8 <= y <= 12,
    hair=lambda x, y: y <= 2 or x >= 13,
)
SPECS["gracenovamon"] = dict(
    pal=pal(B=(220, 176, 48), H=(250, 220, 110), S=(150, 110, 24), C=(230, 230, 240),
            N=(100, 110, 200), R=(220, 80, 120), E=(248, 240, 200), P=(16, 12, 10),
            O=(20, 16, 12)),
    overlay={(6, 8): "E", (6, 9): "P"},
    hair=lambda x, y: x >= 11,
    belly=lambda x, y: 4 <= x <= 8 and 7 <= y <= 11,
)

# ----- Meicoo line -----
SPECS["meicoomon"] = dict(
    pal=pal(B=(240, 220, 180), H=(255, 244, 220), S=(180, 150, 110), C=(255, 244, 220),
            N=(232, 140, 170), K=(80, 48, 32), E=(248, 220, 80), P=(40, 24, 16),
            W=(255, 255, 255), O=(28, 18, 14)),
    overlay={(5, 6): "E", (6, 6): "W", (5, 7): "P", (9, 6): "E", (9, 7): "P"},
    hair=lambda x, y: (y <= 3 and (x <= 3 or x >= 12)),  # pink inner ears — tips dark
    belly=lambda x, y: 5 <= x <= 10 and 8 <= y <= 12,
)
SPECS["meicrackmon"] = dict(
    pal=pal(B=(240, 220, 180), H=(255, 244, 220), S=(180, 150, 110),
            Y=(200, 160, 48), N=(232, 140, 170), E=(80, 40, 20), P=(16, 12, 10),
            O=(28, 18, 14)),
    overlay={(6, 5): "E", (6, 6): "P"},
    belly=lambda x, y: 5 <= x <= 9 and 7 <= y <= 11,
    hair=lambda x, y: y <= 2,
)
SPECS["rasielmon"] = dict(
    pal=pal(B=(244, 236, 214), H=(255, 252, 240), S=(180, 160, 120),
            Y=(212, 176, 40), N=(212, 176, 40), E=(80, 40, 20), P=(16, 12, 10),
            O=(24, 18, 12), C=(255, 252, 240)),
    overlay={(6, 4): "E", (6, 5): "P"},
    hair=lambda x, y: y <= 2 or x >= 13,
    belly=lambda x, y: 5 <= x <= 9 and 7 <= y <= 11,
)

# ----- Examon, Yukimi, Titamon handled specially -----
SPECS["examon"] = dict(
    pal=pal(B=(180, 36, 32), H=(230, 90, 60), S=(110, 20, 16), Y=(212, 172, 40),
            N=(48, 80, 180), E=(248, 240, 160), P=(16, 12, 10), O=(22, 10, 10),
            C=(212, 172, 40)),
    overlay={(5, 7): "E", (5, 8): "P"},
    hair=lambda x, y: x >= 11,  # wing
    metal=lambda x, y: 4 <= x <= 9 and 8 <= y <= 11,
)
SPECS["examon"]["pal"]["M"] = (212, 172, 40, 255)

SPECS["yukimibotamon"] = dict(
    pal=pal(B=(255, 255, 255), H=(255, 255, 255), S=(200, 214, 230), C=(255, 255, 255),
            N=(219, 232, 248), E=(20, 16, 48), P=(8, 8, 20), R=(247, 220, 231),
            O=(20, 16, 40)),
    overlay={(6, 12): "E", (9, 12): "E", (7, 14): "R", (8, 14): "R"},
)


def titamon16() -> Image.Image:
    """Hand-drawn 16x16 Titamon in V-pet style (front-3/4, skull head, olive body)."""
    # Official appearance: animal skull helm, olive-green skin, bone accessories, red eye sockets.
    lines = [
        ".c.k.c.k.c.k..",
        "c.h.h.h.h.h.c.",
        "c.h.e.k.e.h.c.",
        "c.h.h.s.h.h.c.",
        ".c.h.h.h.h.c..",
        "h.b.b.b.b.b.h.",
        "b.b.b.c.c.b.b.",
        "b.s.b.b.b.s.b.",
        "h.b.b.b.b.b.h.",
        "s.b.b.b.b.b.s.",
        ".b.a.a.a.a.b..",
        ".b.s.s.s.s.b..",
        ".b.b.....b.b..",
        "h.s.......s.h.",
        "b.s.......s.b.",
        "s.s.......s.s.",
    ]
    pal = palettes_titamon()
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    op = im.load()
    for y, row in enumerate(lines):
        for x, ch in enumerate(row):
            if ch != ".":
                op[x, y] = pal[ch]
    return im


def palettes_titamon():
    return {
        "k": (22, 16, 14, 255),
        "c": (236, 214, 170, 255),  # bone
        "h": (245, 230, 196, 255),
        "s": (172, 149, 89, 255),
        "e": (196, 32, 28, 255),    # eye sockets
        "b": (58, 92, 36, 255),     # olive body
        "a": (134, 106, 62, 255),   # cloth
    }


def flood_knock_dark(im: Image.Image, dark=18) -> Image.Image:
    """Knock only corner-connected near-black / transparent. Never eat white fills."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def isbg(c):
        r, g, b, a = c
        if a < 16:
            return True
        return r <= dark and g <= dark and b <= dark

    seen = [[False] * w for _ in range(h)]
    st = []
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if isbg(px[x, y]):
            st.append((x, y))
    while st:
        x, y = st.pop()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        if not isbg(px[x, y]):
            continue
        seen[y][x] = True
        px[x, y] = (0, 0, 0, 0)
        st.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def official_clr_32(filename: str) -> Image.Image:
    im = Image.open(REF / filename)
    k = flood_knock_dark(im)
    if k.size == (128, 128):
        return k.resize((32, 32), Image.NEAREST)
    return k.resize((32, 32), Image.NEAREST)


def build_one(mid: str) -> Image.Image:
    if mid == "jesmon":
        return official_clr_32("Jesmon_vpet_clr.png")
    if mid == "dianamon":
        return official_clr_32("Dianamon_vpet_clr.png")
    if mid == "titamon":
        return render32_from_color16(titamon16(), outline=(22, 16, 14, 255))
    spec = SPECS[mid]
    if mid == "yukimibotamon":
        # hand 16 from official 48 mask, guaranteed white fill
        mask = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        # use extracted official silhouette
        src = load_mask16(mid)
        mask = src
    else:
        mask = load_mask16(mid)
    col = paint_standard(
        mask,
        spec["pal"],
        spec.get("overlay") or {},
        belly=spec.get("belly"),
        metal=spec.get("metal"),
        hair=spec.get("hair"),
    )
    return render32_from_color16(col, outline=rgba(spec["pal"]["O"]))


def add_eye_sparkle(im: Image.Image, pal_e=None) -> Image.Image:
    """If an iris block is >=2px, try to place a 1px white shine upper-left of a dark pupil."""
    return im  # eyes already encoded in 16-grid; 2x makes them 2–4px, readable


def main():
    ids = list(SPECS) + ["jesmon", "dianamon", "titamon"]
    # unique preserve order
    seen = set()
    ids = [i for i in ids if not (i in seen or seen.add(i))]
    built = {}
    for mid in ids:
        try:
            im = build_one(mid)
            # plant feet on y=31 if there's a gap (skip official clr canvases already padded)
            if mid not in ("jesmon", "dianamon"):
                bb = im.getbbox()
                if bb and bb[3] < 32:
                    shift = 32 - bb[3]
                    out = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
                    out.paste(im, (0, shift), im)
                    im = out
            path = OV / f"{mid}_idle0.png"
            im.save(path)
            built[mid] = im
            print(f"OK {mid:20} bbox={im.getbbox()} -> {path.name}")
        except Exception as e:
            print(f"FAIL {mid}: {e}")
            raise

    # preview pages
    font = ImageFont.truetype(FONT, 13)
    cols = 8
    cell = 192
    lab = 36
    pad = 12
    items = list(built.items())
    for page in range(0, len(items), 24):
        chunk = items[page:page + 24]
        n = len(chunk)
        rows = (n + cols - 1) // cols
        W = pad * 2 + cols * (cell + 8) - 8
        H = 36 + rows * (cell + lab + 8)
        canvas = Image.new("RGB", (W, H), (28, 30, 36))
        dr = ImageDraw.Draw(canvas)
        dr.text((pad, 8), f"Hand redraw preview {page // 24 + 1}", font=font, fill=(230, 224, 210))
        for j, (mid, im) in enumerate(chunk):
            r, c = divmod(j, cols)
            x = pad + c * (cell + 8)
            y = 32 + r * (cell + lab + 8)
            big = im.resize((cell, cell), Image.NEAREST)
            canvas.paste((24, 26, 32), (x, y, x + cell, y + cell))
            canvas.paste(big.convert("RGB"), (x, y), big)
            dr.text((x, y + cell + 4), mid, font=font, fill=(210, 210, 200))
        outp = PREV / f"redraw_{page // 24 + 1}.png"
        canvas.save(outp)
        print("preview", outp, canvas.size)
    print("drew", len(built), "overrides")


if __name__ == "__main__":
    main()
