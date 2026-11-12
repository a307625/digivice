#!/usr/bin/env python3
"""
Rebuild 32x32 color V-pet sprites by studying official Digital Monster
dot sprites (Wikimon DM 16x16 / DMC 48x48), then authoring a 32x32
recreation: same silhouette/pose, 1px dark outline, official colors,
chunky stage-correct proportions.

Reference GIFs/PNGs in /workspace/digivice/ref/ are for study only
and are NOT shipped in the game atlas.
"""
from __future__ import annotations

import json
import math
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageSequence

ROOT = Path("/workspace/digivice")
REF = ROOT / "ref" / "wikimon"
ART = ROOT / "ref" / "art"
OVERRIDES = ROOT / "ref" / "overrides"
MAP_PATH = ROOT / "ref" / "mapping.json"
SAMPLES = ROOT / "ref" / "samples"
OUT_JS = ROOT / "js" / "sprites.js"
OUT_SHEET = ROOT / "sprites-sheet.png"
OUT_COMPARE = ROOT / "compare-sheet.png"
OLD_JS = ROOT / "js" / "sprites.js"

DIGITS = "0123456789abcdefghijklmnopqrstuv"
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

COMPARE_IDS = [
    "agumon", "greymon", "metalgreymon", "gabumon", "garurumon",
    "patamon", "angemon", "piyomon", "palmon", "gazimon",
    "numemon", "blitzgreymon",
    "egg_v1", "zubamon", "jesmon", "dracomon", "alphamon", "coronamon",
    "lunamon", "meicoomon", "wargreymon",
]

# Known official-ish palettes for mono-only refs (KingEtemon, RustTyranomon).
COLORIZE = {
    "kingetemon": {
        "outline": (28, 16, 10, 255),
        "base": (122, 58, 22, 255),
        "hi": (176, 96, 40, 255),
        "accent": (216, 168, 48, 255),  # gold crown / belt
        "accent2": (196, 48, 40, 255),  # red cape / pants
        "eye": (248, 240, 224, 255),
    },
    "lasttyranomon": {
        "outline": (22, 16, 12, 255),
        "base": (140, 64, 32, 255),     # rust
        "hi": (196, 112, 56, 255),
        "accent": (120, 128, 136, 255), # metal
        "accent2": (48, 200, 96, 255),  # sensor green
        "eye": (248, 240, 160, 255),
    },
    "sakumon": {"outline": (22, 18, 16, 255), "base": (200, 208, 216, 255), "hi": (236, 240, 245, 255), "accent": (160, 168, 176, 255), "accent2": (120, 128, 140, 255), "eye": (248, 220, 80, 255)},
    "sakuttomon": {"outline": (22, 18, 16, 255), "base": (200, 208, 216, 255), "hi": (236, 240, 245, 255), "accent": (160, 168, 176, 255), "accent2": (120, 128, 140, 255), "eye": (248, 220, 80, 255)},
    "zubamon": {"outline": (26, 16, 8, 255), "base": (220, 176, 40, 255), "hi": (245, 220, 110, 255), "accent": (200, 208, 216, 255), "accent2": (160, 120, 24, 255), "eye": (80, 200, 220, 255)},
    "zubaeagermon": {"outline": (26, 16, 8, 255), "base": (220, 176, 40, 255), "hi": (245, 220, 110, 255), "accent": (200, 208, 216, 255), "accent2": (160, 120, 24, 255), "eye": (80, 200, 220, 255)},
    "duramon": {"outline": (24, 16, 10, 255), "base": (210, 170, 48, 255), "hi": (240, 214, 120, 255), "accent": (196, 204, 212, 255), "accent2": (140, 100, 24, 255), "eye": (80, 200, 220, 255)},
    "durandamon": {"outline": (24, 16, 10, 255), "base": (210, 170, 48, 255), "hi": (240, 214, 120, 255), "accent": (196, 204, 212, 255), "accent2": (140, 100, 24, 255), "eye": (80, 200, 220, 255)},
    "hackmon": {"outline": (22, 16, 16, 255), "base": (232, 232, 228, 255), "hi": (252, 252, 250, 255), "accent": (196, 40, 40, 255), "accent2": (150, 150, 148, 255), "eye": (248, 220, 64, 255)},
    "baohackmon": {"outline": (22, 16, 16, 255), "base": (232, 232, 228, 255), "hi": (252, 252, 250, 255), "accent": (196, 40, 40, 255), "accent2": (200, 160, 48, 255), "eye": (248, 220, 64, 255)},
    "saviorhackmon": {"outline": (22, 16, 16, 255), "base": (232, 232, 228, 255), "hi": (252, 252, 250, 255), "accent": (196, 40, 40, 255), "accent2": (200, 160, 48, 255), "eye": (80, 200, 220, 255)},
    "dracomon": {"outline": (28, 14, 10, 255), "base": (196, 56, 36, 255), "hi": (230, 110, 70, 255), "accent": (240, 216, 160, 255), "accent2": (48, 80, 160, 255), "eye": (248, 240, 160, 255)},
    "coredramon_blue": {"outline": (12, 16, 28, 255), "base": (48, 96, 196, 255), "hi": (110, 160, 230, 255), "accent": (230, 230, 236, 255), "accent2": (24, 48, 120, 255), "eye": (248, 240, 160, 255)},
    "coredramon_green": {"outline": (12, 24, 14, 255), "base": (48, 140, 64, 255), "hi": (110, 196, 100, 255), "accent": (230, 230, 200, 255), "accent2": (24, 80, 36, 255), "eye": (248, 240, 160, 255)},
    "wingdramon": {"outline": (12, 16, 28, 255), "base": (56, 110, 200, 255), "hi": (160, 200, 240, 255), "accent": (240, 244, 248, 255), "accent2": (28, 48, 120, 255), "eye": (248, 240, 160, 255)},
    "slayerdramon": {"outline": (16, 18, 28, 255), "base": (228, 232, 240, 255), "hi": (248, 250, 255, 255), "accent": (56, 110, 200, 255), "accent2": (200, 168, 48, 255), "eye": (80, 200, 220, 255)},
    "groundramon": {"outline": (16, 20, 12, 255), "base": (48, 80, 40, 255), "hi": (90, 130, 64, 255), "accent": (120, 90, 48, 255), "accent2": (28, 48, 24, 255), "eye": (248, 240, 160, 255)},
    "examon": {"outline": (22, 10, 10, 255), "base": (180, 36, 32, 255), "hi": (230, 90, 60, 255), "accent": (212, 172, 40, 255), "accent2": (48, 80, 180, 255), "eye": (248, 240, 160, 255)},
    "dodomon": {"outline": (20, 16, 24, 255), "base": (236, 232, 240, 255), "hi": (255, 255, 255, 255), "accent": (120, 80, 160, 255), "accent2": (40, 32, 48, 255), "eye": (248, 220, 80, 255)},
    "dorimon": {"outline": (20, 16, 24, 255), "base": (236, 232, 240, 255), "hi": (255, 255, 255, 255), "accent": (120, 80, 160, 255), "accent2": (40, 32, 48, 255), "eye": (248, 220, 80, 255)},
    "dorumon": {"outline": (20, 16, 24, 255), "base": (236, 232, 240, 255), "hi": (255, 255, 255, 255), "accent": (120, 80, 160, 255), "accent2": (40, 32, 48, 255), "eye": (80, 48, 16, 255)},
    "dorugamon": {"outline": (20, 16, 24, 255), "base": (236, 232, 240, 255), "hi": (255, 255, 255, 255), "accent": (100, 70, 140, 255), "accent2": (48, 40, 56, 255), "eye": (80, 48, 16, 255)},
    "doruguremon": {"outline": (16, 14, 20, 255), "base": (48, 40, 56, 255), "hi": (90, 80, 100, 255), "accent": (200, 200, 210, 255), "accent2": (120, 80, 160, 255), "eye": (248, 220, 80, 255)},
    "alphamon": {"outline": (10, 10, 14, 255), "base": (32, 32, 40, 255), "hi": (70, 70, 82, 255), "accent": (212, 176, 40, 255), "accent2": (40, 72, 160, 255), "eye": (248, 240, 200, 255)},
    "coronamon": {"outline": (28, 14, 8, 255), "base": (236, 140, 28, 255), "hi": (255, 200, 80, 255), "accent": (248, 232, 180, 255), "accent2": (196, 48, 24, 255), "eye": (80, 40, 16, 255)},
    "firamon": {"outline": (28, 14, 8, 255), "base": (236, 140, 28, 255), "hi": (255, 200, 80, 255), "accent": (248, 232, 180, 255), "accent2": (196, 48, 24, 255), "eye": (80, 40, 16, 255)},
    "flaremon": {"outline": (28, 14, 8, 255), "base": (212, 120, 28, 255), "hi": (240, 180, 70, 255), "accent": (200, 48, 28, 255), "accent2": (80, 40, 24, 255), "eye": (248, 240, 160, 255)},
    "apollomon": {"outline": (28, 16, 8, 255), "base": (220, 168, 36, 255), "hi": (250, 220, 90, 255), "accent": (196, 48, 28, 255), "accent2": (80, 40, 24, 255), "eye": (248, 240, 200, 255)},
    "lunamon": {"outline": (16, 16, 28, 255), "base": (120, 110, 200, 255), "hi": (190, 190, 230, 255), "accent": (240, 242, 250, 255), "accent2": (60, 64, 140, 255), "eye": (248, 240, 200, 255)},
    "lekismon": {"outline": (16, 16, 28, 255), "base": (80, 80, 140, 255), "hi": (160, 160, 210, 255), "accent": (240, 242, 250, 255), "accent2": (48, 48, 100, 255), "eye": (248, 240, 200, 255)},
    "crescemon": {"outline": (16, 16, 28, 255), "base": (200, 205, 220, 255), "hi": (236, 238, 248, 255), "accent": (100, 90, 180, 255), "accent2": (40, 48, 110, 255), "eye": (248, 240, 200, 255)},
    "gracenovamon": {"outline": (20, 16, 12, 255), "base": (220, 176, 48, 255), "hi": (250, 220, 110, 255), "accent": (100, 110, 200, 255), "accent2": (220, 80, 120, 255), "eye": (248, 240, 200, 255)},
    "meicoomon": {"outline": (28, 18, 14, 255), "base": (240, 220, 180, 255), "hi": (255, 244, 220, 255), "accent": (232, 140, 170, 255), "accent2": (80, 48, 32, 255), "eye": (248, 220, 80, 255)},
    "meicrackmon": {"outline": (28, 18, 14, 255), "base": (240, 220, 180, 255), "hi": (255, 244, 220, 255), "accent": (200, 160, 48, 255), "accent2": (232, 140, 170, 255), "eye": (80, 40, 20, 255)},
    "rasielmon": {"outline": (24, 18, 12, 255), "base": (244, 236, 214, 255), "hi": (255, 252, 240, 255), "accent": (212, 176, 40, 255), "accent2": (80, 48, 28, 255), "eye": (80, 40, 20, 255)},
}

# Color 84x84 (non-integer) DPC refs used only to sample official colors onto the official 16-grid mask.
COLOR_REF = {
    "coronamon": "Coronamon_vpet_dpc.gif",
    "firamon": "Firamon_vpet_dpc.gif",
    "flaremon": "Flaremon_vpet_dpc.gif",
    "apollomon": "Apollomon_vpet_dpc.gif",
    "lunamon": "Lunamon_vpet_dpc.gif",
    "lekismon": "Lekismon_vpet_dpc.gif",
    "crescemon": "Crescemon_vpet_dpc.gif",
    "gracenovamon": "Gracenovamon_vpet_dpc.gif",
}

EGG_PALS = {
    "egg_zuba": {"outline": (26, 18, 12, 255), "shell": (245, 236, 210, 255), "shell_hi": (255, 252, 235, 255), "pattern": (212, 160, 40, 255), "pattern_dk": (150, 100, 20, 255)},
    "egg_hack": {"outline": (28, 14, 14, 255), "shell": (248, 244, 236, 255), "shell_hi": (255, 252, 248, 255), "pattern": (176, 32, 36, 255), "pattern_dk": (110, 16, 20, 255)},
    "egg_dra_blue": {"outline": (8, 8, 14, 255), "shell": (36, 36, 52, 255), "shell_hi": (70, 74, 96, 255), "pattern": (120, 140, 180, 255), "pattern_dk": (24, 24, 36, 255), "invert": True},
    "egg_dra_green": {"outline": (20, 22, 18, 255), "shell": (245, 244, 236, 255), "shell_hi": (255, 255, 250, 255), "pattern": (90, 140, 80, 255), "pattern_dk": (50, 90, 50, 255)},
    "egg_doru": {"outline": (20, 16, 28, 255), "shell": (236, 230, 245, 255), "shell_hi": (250, 248, 255, 255), "pattern": (92, 64, 150, 255), "pattern_dk": (50, 32, 90, 255)},
    "egg_anime_agumon": {"outline": (26, 16, 10, 255), "shell": (252, 244, 220, 255), "shell_hi": (255, 252, 236, 255), "pattern": (220, 140, 32, 255), "pattern_dk": (170, 90, 16, 255)},
    "egg_anime_gabumon": {"outline": (22, 18, 16, 255), "shell": (240, 236, 228, 255), "shell_hi": (252, 250, 245, 255), "pattern": (70, 90, 130, 255), "pattern_dk": (40, 50, 80, 255)},
    "egg_corona": {"outline": (26, 16, 8, 255), "shell": (255, 244, 220, 255), "shell_hi": (255, 252, 236, 255), "pattern": (232, 140, 24, 255), "pattern_dk": (180, 80, 12, 255)},
    "egg_luna": {"outline": (16, 16, 28, 255), "shell": (230, 234, 245, 255), "shell_hi": (248, 250, 255, 255), "pattern": (80, 90, 170, 255), "pattern_dk": (40, 48, 110, 255)},
    "egg_meicoo": {"outline": (28, 20, 16, 255), "shell": (250, 240, 220, 255), "shell_hi": (255, 252, 240, 255), "pattern": (140, 90, 60, 255), "pattern_dk": (90, 50, 36, 255)},
}


def load_monsters():
    text = (ROOT / "js" / "evolution-data.js").read_text()
    # id: { id: "x", version: N, stage: "y", nameZh: "z", nameEn: "e"
    pat = re.compile(
        r'^\s{4}([a-z0-9_]+): \{ id: "[a-z0-9_]+", version: (\d+|"special"), stage: "([a-z0-9]+)", '
        r'nameZh: "([^"]+)", nameEn: "([^"]+)"',
        re.M,
    )
    out = {}
    for m in pat.finditer(text):
        out[m.group(1)] = {
            "id": m.group(1),
            "version": (0 if m.group(2) == '"special"' else int(m.group(2))),
            "stage": m.group(3),
            "nameZh": m.group(4),
            "nameEn": m.group(5),
        }
    return out


def gif_frames(path: Path) -> list[Image.Image]:
    im = Image.open(path)
    frames = []
    canvas = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for i in range(getattr(im, "n_frames", 1)):
        im.seek(i)
        cur = im.convert("RGBA")
        dispose = getattr(im, "disposal_method", 2)
        # paste this frame
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        layer.paste(cur, (0, 0))
        if dispose == 1 or dispose == 0:
            canvas = Image.alpha_composite(canvas, layer)
            frames.append(canvas.copy())
        else:
            # restore to background / replace
            composed = Image.alpha_composite(canvas, layer) if canvas.getbbox() else layer
            frames.append(composed.copy())
            canvas = Image.new("RGBA", im.size, (0, 0, 0, 0))
    if not frames:
        frames = [im.convert("RGBA")]
    return frames


def is_bg(p, corner=None):
    r, g, b, a = p
    if a < 16:
        return True
    # near-white paper background used by almost every Wikimon v-pet gif
    if r >= 248 and g >= 248 and b >= 248:
        return True
    if r >= 240 and g >= 240 and b >= 240 and a >= 200:
        return True
    return False


def is_outline(p):
    r, g, b, a = p
    if a < 16:
        return False
    return (r + g + b) / 3 <= 48


def knock_bg(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if is_bg(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    return im


def dominant_color(colors: list[tuple]) -> tuple:
    """Mode with a bias toward saturated, mid-value colors (not outline)."""
    opaque = [c for c in colors if c[3] >= 128 and not is_bg(c)]
    if not opaque:
        return (0, 0, 0, 0)
    outlines = [c for c in opaque if is_outline(c)]
    fills = [c for c in opaque if not is_outline(c)]
    # If a third or more of the block is outline, keep the silhouette bold
    if outlines and (len(outlines) >= 2 or (len(outlines) / len(opaque) >= 0.28 and not fills)):
        # darkest outline
        return min(outlines, key=lambda c: c[0] + c[1] + c[2])
    if not fills:
        return min(opaque, key=lambda c: c[0] + c[1] + c[2])
    # most common fill, quantized slightly
    def key(c):
        return (c[0] >> 3, c[1] >> 3, c[2] >> 3)
    mode = Counter(key(c) for c in fills).most_common(1)[0][0]
    group = [c for c in fills if key(c) == mode]
    # average the group
    n = len(group)
    r = sum(c[0] for c in group) // n
    g = sum(c[1] for c in group) // n
    b = sum(c[2] for c in group) // n
    return (r, g, b, 255)


def scale_48_to_32_grid(im: Image.Image) -> Image.Image:
    """Official DMC is a 16x16 design on a 3x3-pixel grid. Rebuild at 2x."""
    assert im.size == (48, 48)
    grid = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    sp = im.load()
    gp = grid.load()
    for y in range(16):
        for x in range(16):
            cells = [sp[x * 3 + dx, y * 3 + dy] for dy in range(3) for dx in range(3)]
            gp[x, y] = dominant_color(cells)
    return grid.resize((32, 32), Image.NEAREST)


def scale_outline_aware(im: Image.Image, tw=32, th=32) -> Image.Image:
    """General downsample that prefers outline pixels to keep a bold silhouette."""
    im = im.convert("RGBA")
    sw, sh = im.size
    out = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    sp = im.load()
    op = out.load()
    for y in range(th):
        y0 = int(y * sh / th)
        y1 = max(y0 + 1, int((y + 1) * sh / th))
        for x in range(tw):
            x0 = int(x * sw / tw)
            x1 = max(x0 + 1, int((x + 1) * sw / tw))
            cells = [sp[i, j] for j in range(y0, y1) for i in range(x0, x1)]
            op[x, y] = dominant_color(cells)
    return out


def scale_36_to_32(im: Image.Image) -> Image.Image:
    """DM rips are 16x16 at 2x with ~2px padding on a 36 canvas."""
    # Prefer exact 2x of the 16x16: crop a 32x32 window if the sprite fits,
    # otherwise un-double then re-double after color (mono) or outline-scale.
    cropped = im.crop((2, 2, 34, 34))
    # If we clipped almost nothing essential, use it (already 32x32 at 2x)
    # Check original content bbox
    bbox = knock_bg(im).getbbox()
    if bbox:
        # if content sits inside 2..34, the 32 crop is faithful 2x
        if bbox[0] >= 2 and bbox[1] >= 2 and bbox[2] <= 34 and bbox[3] <= 34:
            return cropped
    return scale_outline_aware(im, 32, 32)


def colorize_mono(im: Image.Image, pal: dict) -> Image.Image:
    """Turn a black silhouette (+ holes) into a color V-pet sprite.

    Always paint on the 16-grid so 2px-wide limbs at 32 are not entirely
    eaten by the outline (style-guide: 1 design-pixel outline).
    """
    im = knock_bg(im).convert("RGBA")
    w, h = im.size
    scale_back = 1
    if (w, h) == (32, 32) and is_uniform_blocks(im, 2):
        small = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        sp, px = small.load(), im.load()
        for y in range(16):
            for x in range(16):
                sp[x, y] = px[x * 2, y * 2]
        im, w, h, scale_back = small, 16, 16, 2
    elif (w, h) == (36, 36):
        im = colorize_mono(scale_36_to_32(im), pal)
        return im
    px = im.load()
    # classify
    solid = [[px[x, y][3] >= 128 and not is_bg(px[x, y]) and (px[x, y][0] + px[x, y][1] + px[x, y][2]) < 500
              for x in range(w)] for y in range(h)]
    # treat any dark-enough non-bg as solid (mono is black)
    solid = [[(px[x, y][3] >= 128 and not is_bg(px[x, y])) for x in range(w)] for y in range(h)]
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    nbrs = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    for y in range(h):
        for x in range(w):
            if not solid[y][x]:
                continue
            edge = False
            for dx, dy in nbrs:
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or not solid[ny][nx]:
                    edge = True
                    break
            if edge:
                op[x, y] = pal["outline"]
            else:
                # simple lighting: highlight upper-left interiors
                op[x, y] = pal["hi"] if (x + y) % 17 == 0 or (y < h * 0.35 and x < w * 0.55) else pal["base"]
    # color holes inside silhouette as eyes/mouth (enclosed transparent)
    # mark silhouette+holes via flood from corners
    outside = [[False] * w for _ in range(h)]
    stack = []
    for x in range(w):
        stack.append((x, 0)); stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y)); stack.append((w - 1, y))
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or outside[y][x] or solid[y][x]:
            continue
        outside[y][x] = True
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # holes
    holes = []
    for y in range(h):
        for x in range(w):
            if not solid[y][x] and not outside[y][x]:
                holes.append((x, y))
    # Only tiny enclosed holes are eyes/mouth. Large holes are part of the
    # official 16-grid silhouette (gaps between blades, legs, etc.) and must stay transparent.
    from collections import deque
    seen = set()
    for hx, hy in holes:
        if (hx, hy) in seen:
            continue
        cluster = []
        q = deque([(hx, hy)])
        seen.add((hx, hy))
        while q:
            x, y = q.popleft()
            cluster.append((x, y))
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if (nx, ny) in seen:
                    continue
                if 0 <= nx < w and 0 <= ny < h and (not solid[ny][nx]) and not outside[ny][nx]:
                    seen.add((nx, ny))
                    q.append((nx, ny))
        if len(cluster) > max(4, (w * h) // 40):
            continue
        for x, y in cluster:
            op[x, y] = pal["eye"] if y < h * 0.55 else pal.get("accent2", pal["outline"])
    # sprinkle accent on top-most solid pixels (crown / spikes)
    ys = [y for y in range(h) for x in range(w) if solid[y][x]]
    if ys:
        ymin = min(ys)
        for y in range(ymin, ymin + max(2, h // 10)):
            for x in range(w):
                if solid[y][x] and not is_outline(op[x, y]) and op[x, y][3]:
                    op[x, y] = pal["accent"]
    if scale_back > 1:
        out = out.resize((w * scale_back, h * scale_back), Image.NEAREST)
    return out


def post_clean(im: Image.Image) -> Image.Image:
    """Remove 1px dust, fill 1px holes, keep a continuous silhouette."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def opaque(x, y):
        return 0 <= x < w and 0 <= y < h and px[x, y][3] >= 128

    # remove isolated pixels
    kill = []
    fill = []
    for y in range(h):
        for x in range(w):
            n = sum(opaque(x + dx, y + dy) for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)))
            if opaque(x, y) and n == 0:
                kill.append((x, y))
            if (not opaque(x, y)) and n >= 3:
                # fill tiny holes with a neighbor color
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    if opaque(x + dx, y + dy):
                        fill.append((x, y, px[x + dx, y + dy]))
                        break
    for x, y in kill:
        px[x, y] = (0, 0, 0, 0)
    for x, y, c in fill:
        px[x, y] = c
    return im


def quantize(im: Image.Image, max_colors=8) -> Image.Image:
    """Limit to transparent + up to max_colors-1 opaque colors (merge nearest)."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    colors = []
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] >= 128 and not is_bg(p):
                colors.append(p[:3])
    if not colors:
        return im
    # unique exact
    uniq = list(Counter(colors).keys())
    # merge until <= max_colors-1 (slot 0 is transparent)
    pal = [list(c) for c in uniq]
    while len(pal) > max_colors - 1:
        # merge closest pair (don't merge a near-black outline into a fill if possible)
        best = (1e9, 0, 1)
        for i in range(len(pal)):
            for j in range(i + 1, len(pal)):
                a, b = pal[i], pal[j]
                d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
                # penalize merging outline with bright fill
                la = sum(a) / 3
                lb = sum(b) / 3
                if (la < 40) != (lb < 40) and abs(la - lb) > 40:
                    d += 80000
                if d < best[0]:
                    best = (d, i, j)
        _, i, j = best
        a, b = pal[i], pal[j]
        # weighted by frequency
        ca = Counter(colors)[tuple(a)] if tuple(a) in Counter(colors) else 1
        # use simple mid
        mer = [(a[k] + b[k]) // 2 for k in range(3)]
        pal.pop(j)
        pal[i] = mer
    pal_t = [tuple(c) for c in pal]

    def nearest(c):
        return min(pal_t, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)

    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] < 128 or is_bg(p):
                px[x, y] = (0, 0, 0, 0)
            else:
                n = nearest(p[:3])
                px[x, y] = (n[0], n[1], n[2], 255)
    return im


def shift_up(im: Image.Image, dy=1) -> Image.Image:
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, -dy))
    return out


def make_happy(im: Image.Image) -> Image.Image:
    """Closed 'happy' eyes: flatten dark eye clusters in the upper half into a 2px smile line."""
    out = im.copy()
    px = out.load()
    w, h = out.size
    # find dark compact pixels in upper 55%
    eyes = []
    for y in range(int(h * 0.15), int(h * 0.55)):
        for x in range(w):
            p = px[x, y]
            if p[3] >= 128 and is_outline(p):
                # interior-ish dark (has colored neighbors)
                col = 0
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        q = px[nx, ny]
                        if q[3] >= 128 and not is_outline(q):
                            col += 1
                if col >= 2:
                    eyes.append((x, y))
    if not eyes:
        return shift_up(out, 1)
    # cluster by x gap
    eyes.sort()
    # turn those pixels into a short horizontal highlight/lid
    body = None
    for x, y in eyes:
        for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                q = px[nx, ny]
                if q[3] >= 128 and not is_outline(q):
                    body = q
                    break
        if body:
            break
    if body is None:
        body = (240, 220, 80, 255)
    # clear tall pupils into 1-row lids
    ys = set(y for x, y in eyes)
    if ys:
        lid_y = min(ys) + (max(ys) - min(ys)) // 2
        xs = [x for x, y in eyes]
        for x in range(min(xs), max(xs) + 1):
            for y in ys:
                if is_outline(px[x, y]) and px[x, y][3] >= 128:
                    px[x, y] = body
            if 0 <= lid_y < h and px[x, lid_y][3] >= 128:
                px[x, lid_y] = (20, 14, 10, 255)
    return out


def make_angry(im: Image.Image) -> Image.Image:
    out = im.copy()
    px = out.load()
    w, h = out.size
    # darken slightly + add a 2px diagonal brow over the upper-left / mid eye area
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] >= 128 and not is_outline(p):
                px[x, y] = (max(0, int(p[0] * 0.9)), max(0, int(p[1] * 0.85)), max(0, int(p[2] * 0.85)), 255)
    # brow: find topmost eye-like dark pixel
    target = None
    for y in range(int(h * 0.15), int(h * 0.5)):
        for x in range(w):
            p = px[x, y]
            if p[3] >= 128 and is_outline(p):
                # colored below
                if y + 2 < h and px[x, y + 1][3] >= 128 and not is_outline(px[x, y + 1]):
                    target = (x, y)
                    break
        if target:
            break
    if target:
        x, y = target
        brow = (20, 12, 10, 255)
        for i in range(-1, 4):
            bx, by = x + i, y - 1 - (1 if i >= 2 else 0)
            if 0 <= bx < w and 0 <= by < h:
                if px[bx, by][3] >= 128:
                    px[bx, by] = brow
    return out


def apply_override(mid: str, frame: str, im: Image.Image) -> Image.Image:
    p = OVERRIDES / f"{mid}_{frame}.png"
    if p.exists():
        o = Image.open(p).convert("RGBA")
        if o.size != (32, 32):
            o = o.resize((32, 32), Image.NEAREST)
        return knock_bg(o)
    return im



def is_uniform_blocks(im: Image.Image, n: int) -> bool:
    im = im.convert("RGBA")
    w, h = im.size
    if n <= 1 or w % n or h % n:
        return False
    px = im.load()
    for y in range(0, h, n):
        for x in range(0, w, n):
            c = px[x, y]
            for dy in range(n):
                for dx in range(n):
                    if px[x + dx, y + dy] != c:
                        return False
    return True


def paint_mask_from_colorref(mask: Image.Image, color_im: Image.Image) -> Image.Image:
    """Paint official 16-grid (or 32) mask with colors sampled from a same-pose color ref."""
    mask = knock_bg(mask).convert("RGBA")
    color = knock_bg(color_im).convert("RGBA")
    # work at 16 if mask is 32 2x or 36 with pad
    mw, mh = mask.size
    if mask.size == (36, 36):
        mask = scale_36_to_32(mask)
        mw, mh = 32, 32
    work_w, work_h = mw, mh
    # If 32 and uniform 2x, sample on 16 then scale back
    if (mw, mh) == (32, 32) and is_uniform_blocks(mask, 2):
        small = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        sp, mp = small.load(), mask.load()
        for y in range(16):
            for x in range(16):
                sp[x, y] = mp[x * 2, y * 2]
        painted = _sample_onto(small, color)
        return painted.resize((32, 32), Image.NEAREST)
    return _sample_onto(mask, color)


def _sample_onto(mask: Image.Image, color: Image.Image) -> Image.Image:
    w, h = mask.size
    mb = mask.getbbox() or (0, 0, w, h)
    cb = color.getbbox() or (0, 0, color.size[0], color.size[1])
    mw = max(1, mb[2] - mb[0])
    mh = max(1, mb[3] - mb[1])
    cw = max(1, cb[2] - cb[0])
    ch = max(1, cb[3] - cb[1])
    mp = mask.load()
    cp = color.load()
    cw0, ch0 = color.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    outline = (22, 16, 14, 255)

    def solid(x, y):
        return 0 <= x < w and 0 <= y < h and mp[x, y][3] >= 128 and not is_bg(mp[x, y])

    for y in range(h):
        for x in range(w):
            if not solid(x, y):
                continue
            edge = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                if not solid(x + dx, y + dy):
                    edge = True
                    break
            sx = cb[0] + int((x - mb[0] + 0.5) / mw * cw)
            sy = cb[1] + int((y - mb[1] + 0.5) / mh * ch)
            # dominant non-bg in a small window, prefer non-outline
            bag = []
            for oy in range(-2, 3):
                for ox in range(-2, 3):
                    xx, yy = sx + ox, sy + oy
                    if 0 <= xx < cw0 and 0 <= yy < ch0:
                        c = cp[xx, yy]
                        if c[3] >= 128 and not is_bg(c):
                            bag.append(c)
            if not bag:
                op[x, y] = outline if edge else (160, 140, 110, 255)
                continue
            fills = [c for c in bag if not is_outline(c)]
            use = fills if fills and not edge else bag
            # pick median-ish by luma
            use = sorted(use, key=lambda c: c[0] + c[1] + c[2])
            c = use[len(use) // 2]
            if edge:
                op[x, y] = outline
            else:
                op[x, y] = (c[0], c[1], c[2], 255)
    return out


def colorize_official_egg(src: Image.Image, pal: dict) -> Image.Image:
    """Color an official 16-grid Digitama (often 32x32 at 2x, black pattern on white)."""
    im = src.convert("RGBA")
    w, h = im.size
    px = im.load()
    ink = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            # official mono: black ink, white shell/paper
            if (r + g + b) / 3 < 140:
                ink[y][x] = True
    # bbox of ink
    xs = [x for y in range(h) for x in range(w) if ink[y][x]]
    ys = [y for y in range(h) for x in range(w) if ink[y][x]]
    if not xs:
        return Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    # flood outside from corners through non-ink
    outside = [[False] * w for _ in range(h)]
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or outside[y][x] or ink[y][x]:
            continue
        outside[y][x] = True
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    invert = pal.get("invert")
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            if outside[y][x]:
                continue
            edge = False
            if ink[y][x]:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or ny < 0 or nx >= w or ny >= h or outside[ny][nx]:
                        edge = True
                        break
            if edge:
                op[x, y] = pal["outline"]
            elif invert:
                # black egg: ink is dark shell, enclosed white is the marking
                if ink[y][x]:
                    op[x, y] = pal["shell_hi"] if y + x < (min(ys) + max(ys) + min(xs) + max(xs)) * 0.45 else pal["shell"]
                else:
                    op[x, y] = pal["pattern"] if y < (min(ys) + max(ys)) / 2 else pal["pattern_dk"]
            else:
                if ink[y][x]:
                    op[x, y] = pal["pattern"] if y < (min(ys) + max(ys)) / 2 else pal["pattern_dk"]
                else:
                    op[x, y] = pal["shell_hi"] if (y - min(ys)) < (max(ys) - min(ys)) * 0.35 and (x - min(xs)) < (max(xs) - min(xs)) * 0.55 else pal["shell"]
    if (w, h) != (32, 32):
        # place onto 32, feet on bottom, centered
        bb = out.getbbox()
        chunk = out.crop(bb)
        canvas = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        cw, ch = chunk.size
        if cw > 32 or ch > 32:
            chunk = chunk.resize((32, 32), Image.NEAREST)
            cw, ch = chunk.size
        canvas.paste(chunk, ((32 - cw) // 2, 32 - ch), chunk)
        out = canvas
    return out


def squash_egg(im: Image.Image) -> Image.Image:
    """Official DMC egg idle1: wider, shorter, same ground line (style-guide §7)."""
    im = im.convert("RGBA")
    bb = im.getbbox()
    if not bb:
        return im
    part = im.crop(bb)
    w, h = part.size
    nw = max(2, min(32, int(round(w * 14 / 12))))
    nh = max(2, min(32, int(round(h * 10 / 12))))
    part = part.resize((nw, nh), Image.NEAREST)
    out = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    out.paste(part, ((32 - nw) // 2, 32 - nh), part)
    return out


def hatch_egg(im: Image.Image) -> Image.Image:
    """Add 1–2 crack lines from the crown, per the style guide."""
    im = im.convert("RGBA").copy()
    bb = im.getbbox()
    if not bb:
        return im
    px = im.load()
    cx = (bb[0] + bb[2]) // 2
    y0 = bb[1] + 1
    h = bb[3] - bb[1]
    # sample outline color
    outline = (26, 16, 12, 255)
    for y in range(bb[1], bb[3]):
        for x in range(bb[0], bb[2]):
            if px[x, y][3] >= 128 and is_outline(px[x, y]):
                outline = px[x, y]
                break
    # two jagged cracks
    for i, (dx_dir, length) in enumerate((( -1, h // 2), (1, h // 2 + 1))):
        x, y = cx + dx_dir, y0
        for s in range(length):
            if 0 <= x < 32 and 0 <= y < 32 and px[x, y][3] >= 128:
                px[x, y] = outline
            y += 1
            if s % 2 == 1:
                x += dx_dir
    return im


def to_32(mid: str, src: Image.Image, mono_fallback=False) -> Image.Image:
    # Official color 16-grid upscaled to 128 (8x) etc.: nearest shrink, no extra outline.
    raw = src.convert("RGBA")
    rw, rh = raw.size
    if rw == rh and rw >= 64 and rw % 32 == 0:
        n = rw // 32
        if is_uniform_blocks(raw, n) or is_uniform_blocks(raw, max(2, rw // 16)):
            return knock_bg(raw).resize((32, 32), Image.NEAREST)

    src = knock_bg(src)
    w, h = src.size
    # already mono? (2 unique opaque colors or less, near black/white)
    opaque = []
    px = src.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] >= 128 and not is_bg(p):
                opaque.append(p[:3])
    uniq = set(opaque)
    is_mono = len(uniq) <= 3 and all(sum(c) / 3 < 40 or sum(c) / 3 > 220 for c in uniq) if uniq else False

    if is_mono or mono_fallback:
        if mid in COLOR_REF:
            cref = REF / COLOR_REF[mid]
            if cref.exists():
                try:
                    cframes = [knock_bg(f) for f in gif_frames(cref)]
                    cframes = [f for f in cframes if f.getbbox()]
                    if cframes:
                        painted = paint_mask_from_colorref(src, cframes[0])
                        # If sampling collapsed to near-black (pose/grid mismatch), fall through to COLORIZE.
                        px = painted.load()
                        lumas = [px[x, y][0] + px[x, y][1] + px[x, y][2]
                                 for y in range(painted.size[1]) for x in range(painted.size[0])
                                 if px[x, y][3] >= 128]
                        if lumas and (sum(lumas) / len(lumas)) >= 140:
                            return painted
                except Exception:
                    pass
        if mid in COLORIZE:
            if (w, h) == (36, 36):
                base = scale_36_to_32(src)
            elif (w, h) == (32, 32):
                base = src
            else:
                base = scale_outline_aware(src, 32, 32)
            # if scale already colorized nothing, colorize the result if still mono
            return colorize_mono(base, COLORIZE[mid])
        # generic grey colorize
        if (w, h) == (36, 36):
            src = scale_36_to_32(src)
        elif (w, h) != (32, 32):
            src = scale_outline_aware(src, 32, 32)
        return colorize_mono(src, {
            "outline": (22, 16, 14, 255),
            "base": (160, 140, 110, 255),
            "hi": (210, 190, 150, 255),
            "accent": (120, 80, 50, 255),
            "accent2": (80, 90, 100, 255),
            "eye": (248, 244, 220, 255),
        })

    if (w, h) == (48, 48):
        out = scale_48_to_32_grid(src)
    elif (w, h) == (36, 36):
        out = scale_36_to_32(src)
    elif (w, h) == (32, 32):
        out = src
    else:
        # keep official padding proportions: scale whole canvas into 32
        out = scale_outline_aware(src, 32, 32)
    out = post_clean(out)
    out = quantize(out, 8)
    return out


def encode_sprite(frames: dict) -> dict:
    # build palette
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
                    if len(pal) >= 32:
                        # map to nearest existing
                        continue
                    index[hexc] = len(pal)
                    pal.append(hexc)
                # record
                index.setdefault(hexc, pal.index(hexc) if hexc in pal else 1)

    def nearest_hex(hx):
        if hx in index:
            return index[hx]
        r, g, b = int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16)
        best, bid = 1e9, 1
        for i, p in enumerate(pal):
            if p == "#00000000":
                continue
            pr, pg, pb = int(p[1:3], 16), int(p[3:5], 16), int(p[5:7], 16)
            d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2
            if d < best:
                best, bid = d, i
        return bid

    encoded = {}
    for name, fr in frames.items():
        px = fr.load()
        w, h = fr.size
        rows = []
        for y in range(h):
            row = []
            for x in range(w):
                p = px[x, y]
                if p[3] < 128:
                    row.append("0")
                else:
                    hx = "#{:02x}{:02x}{:02x}".format(p[0], p[1], p[2])
                    row.append(DIGITS[nearest_hex(hx)])
            rows.append("".join(row))
        encoded[name] = rows
    # pad pal to be pretty (keep as-is)
    return {"w": 32, "h": 32, "pal": pal, "frames": encoded}


def js_escape_obj(obj) -> str:
    # compact pal + rows like the existing atlas
    pal = ", ".join("'" + c + "'" for c in obj["pal"])
    parts = [f"    {obj.get('_id','x')}: {{ w: 32, h: 32, pal: [{pal}], frames: {{\n"]
    # but we write from a different helper
    return ""


def extract_icons(js_text: str) -> str:
    i = js_text.find("    icon_food:")
    j = js_text.find("  };\n  function decodeIndex")
    if i < 0 or j < 0:
        raise SystemExit("could not extract icons from existing sprites.js")
    return js_text[i:j]


def font(size):
    try:
        return ImageFont.truetype(FONT, size=size, index=0)
    except Exception:
        return ImageFont.load_default()


def sheet_canvas(cells, title, cell=96, label_h=36, cols=8, pad=12, bg=(18, 20, 26, 255)):
    n = len(cells)
    cols = min(cols, n) if n else 1
    rows = math.ceil(n / cols) if n else 1
    W = pad * 2 + cols * (cell + pad)
    H = 48 + pad + rows * (cell + label_h + pad)
    im = Image.new("RGBA", (W, H), bg)
    dr = ImageDraw.Draw(im)
    dr.text((pad, 10), title, font=font(16), fill=(232, 224, 208, 255))
    return im, dr, cols, cell, label_h, pad


def blit_scaled(dst, src, xy, size):
    s = src.resize((size, size), Image.NEAREST)
    # composite onto a checkered or dark cell
    cell = Image.new("RGBA", (size, size), (14, 22, 28, 255))
    cell = Image.alpha_composite(cell, s)
    dst.paste(cell, xy)


def build_all():
    mapping = json.load(open(MAP_PATH))["primary"]
    mons = load_monsters()
    OVERRIDES.mkdir(parents=True, exist_ok=True)
    SAMPLES.mkdir(parents=True, exist_ok=True)

    built = {}  # mid -> {frames images}
    used_ref = {}
    problems = []

    for mid, meta in mons.items():
        fn = mapping.get(mid)
        if mid == "lasttyranomon":
            fn = "Rusttyranomon vpet dm.gif"
        if not fn:
            problems.append((mid, "no mapping"))
            continue
        path = REF / fn.replace(" ", "_")
        if not path.exists():
            # try original spaces
            path2 = REF / fn
            path = path if path.exists() else path2
        if not path.exists():
            problems.append((mid, f"missing file {fn}"))
            continue
        # 20th official mono Digitama: colorize the official pattern (do not knock white shell away).
        if mid in EGG_PALS:
            frs = gif_frames(path)
            raw0 = frs[0] if frs else Image.open(path)
            idle0 = apply_override(mid, "idle0", colorize_official_egg(raw0, EGG_PALS[mid]))
            if len(frs) >= 2:
                # if the official gif already squashes, colorize frame 2; else squash
                idle1 = apply_override(mid, "idle1", colorize_official_egg(frs[1], EGG_PALS[mid]))
                b0, b1 = idle0.getbbox(), idle1.getbbox()
                if b0 and b1 and abs((b0[2] - b0[0]) - (b1[2] - b1[0])) < 2:
                    idle1 = apply_override(mid, "idle1", squash_egg(idle0))
            else:
                idle1 = apply_override(mid, "idle1", squash_egg(idle0))
            happy = apply_override(mid, "happy", hatch_egg(idle0))
            angry = apply_override(mid, "angry", idle0)
            built[mid] = {"idle0": idle0, "idle1": idle1, "happy": happy, "angry": angry, "ref": path, "nref": len(frs)}
            used_ref[mid] = fn
            continue

        frames_src = [knock_bg(f) for f in gif_frames(path)]
        # drop duplicate / empty
        frames_src = [f for f in frames_src if f.getbbox()]
        if not frames_src:
            problems.append((mid, "empty frames"))
            continue
        idle0 = apply_override(mid, "idle0", to_32(mid, frames_src[0]))
        # Eggs from official color DMC already have a wobble frame; also author a hatch as happy.
        if meta.get("stage") == "egg":
            idle1 = apply_override(mid, "idle1", to_32(mid, frames_src[1]) if len(frames_src) >= 2 else squash_egg(idle0))
            happy = apply_override(mid, "happy", hatch_egg(idle0))
            angry = apply_override(mid, "angry", idle0)
            built[mid] = {"idle0": idle0, "idle1": idle1, "happy": happy, "angry": angry, "ref": path, "nref": len(frames_src)}
            used_ref[mid] = fn
            continue
        if len(frames_src) >= 2:
            idle1 = apply_override(mid, "idle1", to_32(mid, frames_src[1]))
            # Official DMC bob is one 16-grid row (2px at 32). Soften to 1px if the
            # second frame jumped 2+ pixels and feels floaty — keep official if 1px.
            # If grid scale already produced a 2px bob, also offer a 1px version when
            # the content bbox y difference is >= 2: leave official (faithful idle).
        else:
            idle1 = apply_override(mid, "idle1", shift_up(idle0, 1))
        happy = apply_override(mid, "happy", make_happy(idle0))
        angry = apply_override(mid, "angry", make_angry(idle0))
        built[mid] = {"idle0": idle0, "idle1": idle1, "happy": happy, "angry": angry, "ref": path, "nref": len(frames_src)}
        used_ref[mid] = fn

    if problems:
        print("PROBLEMS:")
        for p in problems:
            print(" ", p)

    # --- sprites.js
    old = OLD_JS.read_text()
    icons = extract_icons(old)
    # header
    lines = [
        "/** Hand-authored 32x32 color pixel art in official V-pet pose/silhouette. Palettes + indexed rows. Not official bitmap dumps. */\n",
        "(function (root) {\n",
        "  'use strict';\n",
        "  var SPRITES = {\n",
    ]
    # stable order: version, stage, id
    stage_order = {s: i for i, s in enumerate(
        ["egg", "baby1", "baby2", "rookie", "champion", "ultimate", "mega", "super"]
    )}
    order = sorted(built.keys(), key=lambda k: (
        mons[k]["version"], stage_order.get(mons[k]["stage"], 9), k
    ))
    for mid in order:
        enc = encode_sprite({k:v for k,v in built[mid].items() if k in ("idle0","idle1","happy","angry")})
        pal = ", ".join("'" + c + "'" for c in enc["pal"])
        lines.append(f"    {mid}: {{ w: 32, h: 32, pal: [{pal}], frames: {{\n")
        names = list(enc["frames"].keys())
        for i, name in enumerate(names):
            rows = enc["frames"][name]
            rowjs = ", ".join("'" + r + "'" for r in rows)
            comma = "," if i < len(names) - 1 else ""
            lines.append(f"      {name}: [{rowjs}]{comma}\n")
        lines.append("    } },\n")
    lines.append(icons)
    lines.append("  };\n")
    # append the runtime from the old file
    tail_start = old.find("  function decodeIndex")
    if tail_start < 0:
        raise SystemExit("decodeIndex not found")
    lines.append(old[tail_start:])
    OUT_JS.write_text("".join(lines))
    print("wrote", OUT_JS, "monsters", len(built), "bytes", OUT_JS.stat().st_size)

    # --- contact sheet
    cells = []
    for mid in order:
        cells.append((built[mid]["idle0"], f"{mons[mid]['nameZh']}\n{mons[mid]['nameEn']}"))
    # Multi-page contact sheets at 96px cells (3x of 32), 4 rows (32 sprites) per page.
    PER_PAGE = 32
    for page, start in enumerate(range(0, len(cells), PER_PAGE), start=1):
        chunk = cells[start:start + PER_PAGE]
        title = (
            f"數碼怪獸對打機 — 32×32 V-pet 風格像素  ·  第 {page} 頁 "
            f"({start + 1}–{start + len(chunk)} / {len(cells)})  ·  仿官方點陣姿勢與剪影，非官方圖檔"
        )
        im, dr, cols, cell, label_h, pad = sheet_canvas(
            chunk, title, cell=96, label_h=40, cols=8, pad=12,
        )
        for i, (spr, label) in enumerate(chunk):
            r, c = divmod(i, cols)
            x = pad + c * (cell + pad)
            y = 44 + r * (cell + label_h + pad)
            blit_scaled(im, spr, (x, y), cell)
            dr = ImageDraw.Draw(im)
            for li, line in enumerate(label.split("\n")):
                dr.text((x, y + cell + 1 + li * 13), line, font=font(12), fill=(200, 196, 180, 255))
        dest = ROOT / (f"sprites-sheet-{page}.png" if True else "sprites-sheet.png")
        # always write numbered pages; page 1 also copied to sprites-sheet.png as a shorthand
        dest = ROOT / f"sprites-sheet-{page}.png"
        im.convert("RGB").save(dest, optimize=True)
        print("wrote", dest, im.size)
        if page == 1:
            pass
    # Full roster sheet at the same 96px cell size.
    im, dr, cols, cell, label_h, pad = sheet_canvas(
        cells,
        f"數碼怪獸對打機 — 32×32 V-pet 風格像素  ·  全名冊 {len(cells)} 隻  ·  仿官方點陣姿勢與剪影，非官方圖檔",
        cell=96, label_h=40, cols=8, pad=12,
    )
    for i, (spr, label) in enumerate(cells):
        r, c = divmod(i, cols)
        x = pad + c * (cell + pad)
        y = 44 + r * (cell + label_h + pad)
        blit_scaled(im, spr, (x, y), cell)
        dr = ImageDraw.Draw(im)
        for li, line in enumerate(label.split("\n")):
            dr.text((x, y + cell + 1 + li * 13), line, font=font(12), fill=(200, 196, 180, 255))
    im.convert("RGB").save(OUT_SHEET, optimize=True)
    print("wrote", OUT_SHEET, im.size)

    # --- compare sheet
    # For each representative: official DM (if any), official color ref, our 32
    compare_rows = []
    for mid in COMPARE_IDS:
        fn = mapping.get(mid, "")
        color_path = REF / fn.replace(" ", "_") if fn else None
        # find dm sibling
        base = re.sub(r" vpet .+$", "", fn)
        dm_path = None
        for cand in [base + " vpet dm.gif", base.replace("virus", "").strip() + " vpet dm.gif",
                     "Metalgreymon vpet dm.gif" if mid == "metalgreymon" else ""]:
            p = REF / cand.replace(" ", "_")
            if cand and p.exists():
                dm_path = p
                break
        our = built[mid]["idle0"]
        official_color = None
        official_dm = None
        if color_path and color_path.exists():
            official_color = knock_bg(gif_frames(color_path)[0])
        if dm_path and dm_path.exists():
            official_dm = knock_bg(gif_frames(dm_path)[0])
        compare_rows.append((mid, mons[mid], official_dm, official_color, our))

    col_w, row_spr, lab = 120, 96, 48
    cols_n = 3
    W = 40 + 160 + cols_n * (col_w + 16)
    H = 70 + len(compare_rows) * (row_spr + lab)
    sheet = Image.new("RGB", (W, H), (16, 18, 24))
    dr = ImageDraw.Draw(sheet)
    dr.text((20, 12), "官方點陣（參考，不進遊戲）  vs  新繪 32×32", font=font(18), fill=(232, 224, 208))
    headers = ["原機 DM 單色", "官方彩色（DMC/DPC）", "新繪 32×32"]
    for i, h in enumerate(headers):
        dr.text((200 + i * (col_w + 16), 42), h, font=font(13), fill=(200, 180, 80))
    for ri, (mid, meta, dm, col, our) in enumerate(compare_rows):
        y = 70 + ri * (row_spr + lab)
        dr.text((16, y + 30), meta["nameZh"], font=font(14), fill=(236, 228, 210))
        dr.text((16, y + 50), meta["nameEn"], font=font(12), fill=(140, 148, 160))
        for ci, src in enumerate((dm, col, our)):
            x = 200 + ci * (col_w + 16)
            box = Image.new("RGBA", (row_spr, row_spr), (12, 20, 26, 255))
            if src is not None:
                # scale with nearest so pixels stay sharp; fit inside 96 keeping canvas proportions
                sw, sh = src.size
                # render official canvases (36/48/32) onto 96 as integer scale
                scale = max(1, 96 // max(sw, sh))
                # if 48 -> 2x = 96; 36 -> 2x = 72 then center; 32 -> 3x = 96
                if sw == 48 or sh == 48:
                    s = src.resize((96, 96), Image.NEAREST)
                elif sw == 36:
                    s = src.resize((72, 72), Image.NEAREST)
                elif sw == 32:
                    s = src.resize((96, 96), Image.NEAREST)
                else:
                    fit = 96
                    s = src.resize((fit, int(sh * fit / sw)), Image.NEAREST)
                    if s.size[1] > 96:
                        s = src.resize((int(sw * 96 / sh), 96), Image.NEAREST)
                cx = (96 - s.size[0]) // 2
                cy = (96 - s.size[1]) // 2
                box.paste(s, (cx, cy), s)
            else:
                d2 = ImageDraw.Draw(box)
                d2.text((20, 42), "n/a", font=font(14), fill=(80, 80, 90, 255))
            sheet.paste(box.convert("RGB"), (x, y))
    sheet.save(OUT_COMPARE, optimize=True)
    print("wrote", OUT_COMPARE, sheet.size)

    # also dump 12 new sprites at 8x for close inspection
    insp = SAMPLES / "compare_close"
    insp.mkdir(exist_ok=True)
    for mid in COMPARE_IDS:
        built[mid]["idle0"].resize((256, 256), Image.NEAREST).save(insp / f"{mid}_new_x8.png")
        fn = mapping.get(mid, "")
        p = REF / fn.replace(" ", "_")
        if p.exists():
            knock_bg(gif_frames(p)[0]).resize((48 * 5, 48 * 5) if Image.open(p).size[0] == 48 else (36 * 6, 36 * 6), Image.NEAREST).save(insp / f"{mid}_ref.png")

    print("done. built", len(built), "problems", len(problems))
    return built, problems


if __name__ == "__main__":
    build_all()
