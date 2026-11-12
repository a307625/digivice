#!/usr/bin/env python3
"""Build expression-study.png from official tero cells, then rebuild designed
expression frames (happy/eat/refuse/angry/sleep/hurt) by reusing the official
base pose and editing only eyes / mouth / tongue. Never rewrite official_color.
"""
from __future__ import annotations

import json
import re
import shutil
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
CACHE = Path("/tmp/pass9")
CACHE.mkdir(parents=True, exist_ok=True)
COV_PATH = Path("/tmp/pass8/coverage.json")
TERO = Path("/tmp/expr")

DMC_SLOTS = [
    "idle0", "idle1", "happy", "angry", "train0", "train1", "attack0", "attack",
    "eat0", "eat1", "refuse", "sleep0", "sleep1", "sick", "hurt",
]
PENC_SLOTS = [
    "idle0", "idle1", "eat0", "eat1", "sleep0", "sleep1", "refuse",
    "happy", "angry", "sick", "hurt", "attack",
]
STUDY_COLS = ["idle0", "happy", "eat0", "eat1", "angry", "refuse", "sleep0", "hurt", "attack"]

EGGS = set(R.EGGS)
BABIES = set(R.BABIES)
QUADS = set(R.QUADS)

HUMANOID_TONGUE = {
    "kingetemon", "titamon", "pinochimon",
    "flaremon", "apollomon",
    "lekismon", "crescemon", "dianamon",
    "meicrackmon", "rasielmon", "gracenovamon",
    "baohackmon",
}
VISOR = {
    "jesmon", "alphamon", "slayerdramon", "examon",
    "duramon", "durandamon", "saviorhackmon",
    "zubaeagermon", "breakdramon", "lasttyranomon",
}
BIPED_DINO = {
    "hackmon", "dracomon", "coredramon_blue", "coredramon_green",
    "lasttyranomon", "groundramon", "breakdramon", "doruguremon",
}
WINGED = {"wingdramon", "slayerdramon", "examon"}
SMALL_BIPED = {"zubamon", "coronamon", "lunamon"}

EXPR_KEYS = [
    "happy", "eat0", "eat1", "eat", "angry", "refuse",
    "sleep0", "sleep1", "sleep", "hurt", "hurt0", "hurt1", "attack",
]

FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FONT_TC_INDEX = 3  # Traditional Chinese


def font(size, index=FONT_TC_INDEX):
    try:
        return ImageFont.truetype(FONT_PATH, size, index=index)
    except Exception:
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
        except Exception:
            return ImageFont.load_default()


def luma(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def chroma(c):
    return max(c[0], c[1], c[2]) - min(c[0], c[1], c[2])


def expr_group(mid: str) -> str:
    if mid in EGGS:
        return "egg"
    if mid in BABIES:
        return "baby_blob"
    if mid in QUADS:
        return "quad"
    if mid in WINGED:
        return "winged"
    if mid in HUMANOID_TONGUE:
        return "humanoid"
    if mid in VISOR:
        return "armored"
    if mid in BIPED_DINO:
        return "biped_dino"
    if mid in SMALL_BIPED:
        return "small_biped"
    return "biped_dino"


def uses_tongue(mid: str) -> bool:
    return mid in HUMANOID_TONGUE


def is_visor(mid: str) -> bool:
    return mid in VISOR


# ---------- official tero study figure ----------

def tero_cells(path: Path, slots):
    im = Image.open(path).convert("RGB")
    out = {}
    for i, name in enumerate(slots):
        x = 4 + i * 99
        if x + 96 <= im.size[0]:
            out[name] = im.crop((x, 16, x + 96, 16 + 96))
    return out


def cell_bg(im: Image.Image):
    a = np.array(im.convert("RGB"))
    return tuple(int(v) for v in a[0, 0])


def highlight_diffs(cell: Image.Image, idle: Image.Image, face_only=False) -> Image.Image:
    """Show the clean official cell, with a gold face box and a light tint only on
    changed face pixels so the sprite itself stays readable."""
    a = np.array(cell.convert("RGB"))
    b = np.array(idle.convert("RGB"))
    out = cell.convert("RGBA")
    if a.shape != b.shape:
        return out
    bg = np.array(cell_bg(idle))
    diff = np.any(a != b, axis=2)
    ink = np.any(np.array(cell.convert("RGB")) != bg, axis=2) | np.any(b != bg, axis=2)
    ys, xs = np.where(ink)
    if len(xs) == 0:
        return out
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    fy1 = y0 + max(8, int((y1 - y0) * 0.55))
    ov = Image.new("RGBA", out.size, (0, 0, 0, 0))
    px = ov.load()
    # only tint changed pixels inside the face box, very lightly
    for y in range(y0, min(fy1, diff.shape[0])):
        for x in range(x0, min(x1, diff.shape[1])):
            if diff[y, x]:
                px[x, y] = (220, 40, 70, 55)
    out = Image.alpha_composite(out, ov)
    dr = ImageDraw.Draw(out)
    dr.rectangle([x0, y0, x1 - 1, fy1 - 1], outline=(240, 200, 60, 200))
    return out


def badge(dr, xy, text, font_, fg=(255, 240, 200, 255), bg=(80, 30, 40, 220)):
    x, y = xy
    bbox = dr.textbbox((x, y), text, font=font_)
    pad = 2
    dr.rectangle([bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad], fill=bg)
    dr.text((x, y), text, fill=fg, font=font_)


def build_study_png(path: Path):
    rows = [
        ("tero_agumon.png", DMC_SLOTS, "亞古獸 Agumon", "Child · biped dino"),
        ("tero_greymon.png", DMC_SLOTS, "暴龍獸 Greymon", "Adult · biped dino"),
        ("tero_metalgreymonvirus.png", DMC_SLOTS, "機械暴龍獸 MetalGreymon (Virus)", "Perfect · metal dino"),
        ("tero_wargreymon.png", PENC_SLOTS, "戰鬥暴龍獸 WarGreymon", "Ultimate · armored"),
        ("tero_blitzgreymon.png", DMC_SLOTS, "閃光暴龍獸 BlitzGreymon", "Ultimate · armored / gun-dino"),
        ("tero_omnimon.png", PENC_SLOTS, "奧米加獸 Omegamon", "Ultimate · armored knight"),
        ("tero_koromon.png", DMC_SLOTS, "滾球獸 Koromon  (baby blob)", "Baby II · blob"),
        ("tero_ogremon.png", DMC_SLOTS, "綠魔獸 Ogremon  (humanoid + tongue)", "Adult · humanoid"),
        ("tero_garurumon.png", DMC_SLOTS, "加魯魯獸 Garurumon  (quadruped)", "Adult · quadruped"),
        ("tero_patamon.png", DMC_SLOTS, "巴達獸 Patamon  (winged)", "Child · winged"),
    ]
    cell = 96
    label_w = 250
    tag_h = 18
    header = 92
    gap = 6
    footer = 86
    W = label_w + len(STUDY_COLS) * (cell + gap) + 16
    H = header + len(rows) * (cell + tag_h + 10) + footer
    sheet = Image.new("RGB", (W, H), (236, 232, 224))
    dr = ImageDraw.Draw(sheet)
    f_title = font(18)
    f_sub = font(12)
    f_s = font(10)
    f_xs = font(9)
    dr.text((12, 8), "官方 DMC / PenC 表情研究  —  同一身體，只改臉", fill=(30, 26, 22), font=f_title)
    dr.text(
        (12, 34),
        "紅透明：與 idle0 不同的像素（臉框為金線）。資料：Bandai firmware cells，48×48 以 2× 顯示。自製格必須遵守同一套規則。",
        fill=(70, 64, 56),
        font=f_sub,
    )
    dr.text(
        (12, 54),
        "happy 必為倒 U / ^^ 眼 + 張嘴；eat 張嘴但保留正常眼；angry 常與 eat1 同格；人形 refuse 吐舌；睡為閉眼，不是 X。",
        fill=(70, 64, 56),
        font=f_sub,
    )
    for i, k in enumerate(STUDY_COLS):
        x = label_w + i * (cell + gap)
        dr.text((x + 4, header - 16), k, fill=(80, 72, 64), font=f_s)

    # badges for typical official tells
    tells = {
        "happy": "^^ 眼",
        "eat0": "小張嘴",
        "eat1": "大張嘴",
        "angry": "正常眼",
        "refuse": "低頭/舌",
        "sleep0": "閉眼",
        "hurt": "不是 X",
    }

    for r, (fn, slots, title, group) in enumerate(rows):
        y = header + r * (cell + tag_h + 10)
        cells = tero_cells(TERO / fn, slots)
        idle = cells.get("idle0")
        dr.text((8, y + 28), title, fill=(24, 22, 20), font=f_s)
        dr.text((8, y + 48), group, fill=(110, 100, 90), font=f_xs)
        for i, k in enumerate(STUDY_COLS):
            x = label_w + i * (cell + gap)
            tile = Image.new("RGB", (cell, cell), (32, 32, 36))
            src = cells.get(k)
            if src is None:
                dr.rectangle([x, y, x + cell, y + cell], fill=(32, 32, 36))
                dr.text((x + 8, y + 40), "—", fill=(160, 160, 160), font=f_s)
                continue
            if idle is not None and k != "idle0":
                # face-only tint on mostly-shared standing poses; full tint on unique bodies
                face_only = k in ("happy", "eat0", "eat1", "angry", "attack")
                shown = highlight_diffs(src, idle, face_only=face_only)
                tile = Image.new("RGBA", (cell, cell), (32, 32, 36, 255))
                tile = Image.alpha_composite(tile, shown)
                sheet.paste(tile.convert("RGB"), (x, y))
            else:
                sheet.paste(src, (x, y))
            tag = tells.get(k, "")
            if k == "refuse" and "Ogremon" in title:
                tag = "吐舌"
            if k == "happy":
                tag = "^^ 眼"
            if tag:
                dr.text((x + 2, y + cell + 1), tag, fill=(120, 50, 50), font=f_xs)

    note = (
        "亞古獸 16-grid：eat1 = angry = attack（0 px）；happy 只差 6 個眼睛像素。"
        "  idle0→happy 的 56 px 全在頭部。  WarGreymon / Omegamon 為 Pendulum Color 槽序。"
        "  機械暴龍獸取 DMC Ver.1 Virus 官方格。"
    )
    dr.text((12, H - 70), note, fill=(70, 64, 56), font=f_s)
    dr.text(
        (12, H - 50),
        "組別範例列（下四列）對應 baby blob / 人形 / 四腳 / 有翼。同一個成長階段與體型共用這套表情邏輯。",
        fill=(70, 64, 56),
        font=f_s,
    )
    # tiny legend swatch
    dr.rectangle([12, H - 28, 28, H - 16], fill=(220, 40, 70))
    dr.text((34, H - 30), "與 idle0 不同的像素", fill=(70, 64, 56), font=f_xs)
    dr.rectangle([180, H - 28, 196, H - 16], outline=(200, 160, 40))
    dr.text((202, H - 30), "臉部範圍", fill=(70, 64, 56), font=f_xs)
    sheet.save(path)
    print("wrote", path, sheet.size)
    return path


# ---------- face edits at 32×32 (preserve official body pixels) ----------

def head_box32(im: Image.Image):
    mask = R.ink_mask(im)
    if mask.sum() < 4:
        return (0, 0, im.size[0], im.size[1])
    return R.head_box(mask)


def pose_similar(a: Image.Image, b: Image.Image, iou_min=0.70) -> bool:
    aa = np.array(R.rgba(a))
    bb = np.array(R.rgba(b))
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


def face_window(im: Image.Image, front=False, include_mouth=False):
    """Tight window for the face itself, skipping horns/hats/capes and (usually) the jaw."""
    mask = R.ink_mask(im)
    if mask.sum() < 4:
        w, h = im.size
        return (0, 0, w, h)
    hx0, hy0, hx1, hy1 = R.head_box(mask)
    w, h = hx1 - hx0, hy1 - hy0
    top = 0.16 if h >= 8 else 0.08
    bot = 0.80  # snout eyes sit mid-low on dino heads; mouth is still usually lower
    fy0 = hy0 + int(h * top)
    fy1 = hy0 + max(fy0 + 3, int(h * bot))
    fy1 = min(hy1, fy1)
    # never drop into the torso: cap at mid-height of the full sprite
    ys, xs = np.where(mask)
    if len(ys):
        sprite_mid = int(ys.min() + (ys.max() - ys.min() + 1) * 0.52)
        fy1 = min(fy1, sprite_mid)
    if front:
        fx0 = hx0 + int(w * 0.08)
        fx1 = hx1 - int(w * 0.08)
    else:
        fx0 = hx0
        fx1 = hx0 + max(3, int(w * 0.72))
    fx0, fy0 = max(0, fx0), max(0, fy0)
    return fx0, fy0, max(fx0 + 2, fx1), max(fy0 + 2, fy1)


def neighbor_fill(a, ys, xs, outline):
    """Median non-outline ink color around a cluster, for filling an old eye."""
    h, w = a.shape[:2]
    cols = []
    ol = tuple(outline[:3])
    for y, x in zip(ys, xs):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = int(y) + dy, int(x) + dx
                if 0 <= ny < h and 0 <= nx < w and a[ny, nx, 3] > 20:
                    c = tuple(int(v) for v in a[ny, nx, :3])
                    if c != ol and (ny, nx) not in set(zip(ys, xs)):
                        cols.append(c)
    # drop colors that were in the eye cluster
    eye_cols = {tuple(int(v) for v in a[int(y), int(x), :3]) for y, x in zip(ys, xs)}
    cols = [c for c in cols if c not in eye_cols]
    if not cols:
        return None
    cols = np.array(cols)
    return tuple(int(v) for v in np.median(cols, axis=0))


def find_eye_clusters(im: Image.Image, outline, visor=False, front=False, twin=None):
    """Find 1–2 compact eye clusters inside the face window.

    If twin (e.g. official eat) is provided and shares the pose, prefer pixels
    that are the same in both images so we do not treat the open mouth as an eye.
    """
    a = np.array(R.rgba(im))
    mask = a[:, :, 3] > 20
    if mask.sum() < 4:
        return []
    fx0, fy0, fx1, fy1 = face_window(im, front=front, include_mouth=False)
    if fx1 <= fx0 or fy1 <= fy0:
        return []
    reg = a[fy0:fy1, fx0:fx1]
    alpha = reg[:, :, 3] > 20
    L = 0.2126 * reg[:, :, 0] + 0.7152 * reg[:, :, 1] + 0.0722 * reg[:, :, 2]
    C = np.maximum(np.maximum(reg[:, :, 0], reg[:, :, 1]), reg[:, :, 2]) - np.minimum(
        np.minimum(reg[:, :, 0], reg[:, :, 1]), reg[:, :, 2]
    )
    ol = luma(outline)
    # Prefer same-as-twin pixels (not the mouth) when a second pose is given
    same = np.ones(alpha.shape, dtype=bool)
    if twin is not None:
        b = np.array(R.rgba(twin))
        if b.shape == a.shape:
            sub_a = a[fy0:fy1, fx0:fx1]
            sub_b = b[fy0:fy1, fx0:fx1]
            same = np.all(sub_a == sub_b, axis=2)
    eye = alpha & same & (C >= 35) & (L > ol + 6) & (L < 220)
    if visor and eye.sum() < 2:
        # visor slit: dark line or bright gleam, still inside the face window
        eye = alpha & same & (((L >= 160) & (C < 90)) | ((L < 80) & (L > ol + 4)))
    if eye.sum() < 2:
        # compact mid-dark pupils / black dots
        eye = alpha & same & (L > ol + 6) & (L < 130)
    if eye.sum() < 1:
        return []
    from collections import deque
    vis = np.zeros(eye.shape, dtype=bool)
    h, w = eye.shape
    comps = []
    for y in range(h):
        for x in range(w):
            if not eye[y, x] or vis[y, x]:
                continue
            q = deque([(y, x)])
            vis[y, x] = True
            pts = []
            while q:
                cy, cx = q.popleft()
                pts.append((cy, cx))
                for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and eye[ny, nx] and not vis[ny, nx]:
                        vis[ny, nx] = True
                        q.append((ny, nx))
            if 1 <= len(pts) <= 18:
                ys = [p[0] for p in pts]
                xs = [p[1] for p in pts]
                bw = max(xs) - min(xs) + 1
                bh = max(ys) - min(ys) + 1
                # reject long cape/hair slivers and fat hatch areas
                if bw > 8 or bh > 7:
                    continue
                mean_c = float(np.mean([C[py, px] for py, px in pts]))
                comps.append({
                    "pts": [(fy0 + py, fx0 + px) for py, px in pts],
                    "cy": fy0 + int(round(sum(ys) / len(ys))),
                    "cx": fx0 + int(round(sum(xs) / len(xs))),
                    "n": len(pts),
                    "chroma": mean_c,
                    "color": tuple(int(v) for v in np.median(reg[tuple(zip(*pts))][:, :3], axis=0)),
                })
    if not comps:
        return []
    mid_y = (fy0 + fy1) / 2.0
    mid_x = (fx0 + fx1) / 2.0 if front else (fx0 + (fx1 - fx0) * 0.40)
    # Prefer mid-face compact dots (pupils) over high-chroma jewels / flames on the crown.
    comps.sort(key=lambda c: (abs(c["cy"] - mid_y) + 0.35 * abs(c["cx"] - mid_x), c["n"], -min(c["chroma"], 70)))
    if front or (len(comps) >= 2 and abs(comps[0]["cy"] - comps[1]["cy"]) <= 5
                 and abs(comps[0]["cx"] - comps[1]["cx"]) >= 3):
        picked = []
        for c in comps:
            if all(abs(c["cx"] - p["cx"]) >= 3 and abs(c["cy"] - p["cy"]) <= 6 for p in picked):
                picked.append(c)
            if len(picked) == 2:
                break
        return picked or comps[:1]
    return comps[:1]


def draw_inverted_u(px, cx, cy, color, size=2, w=32, h=32):
    """Downward-opening arc (∩ / happy ^) centered at (cx, cy). size=2 is typical at 32px."""
    col = color[:3] + (255,)
    # peak row
    for dx in range(-size, size + 1):
        x, y = cx + dx, cy
        if 0 <= x < w and 0 <= y < h:
            px[x, y] = col
    # slightly thicker peak
    for dx in range(-size + 1, size):
        x, y = cx + dx, cy - 1
        if 0 <= x < w and 0 <= y < h:
            px[x, y] = col
    # down-turned ends
    for dx, dy in ((-size, 1), (size, 1), (-size, 2), (size, 2)):
        x, y = cx + dx, cy + dy
        if 0 <= x < w and 0 <= y < h:
            px[x, y] = col


def apply_happy_eyes(im: Image.Image, src_idle: Image.Image, visor=False, front=False, twin=None) -> Image.Image:
    out = R.rgba(im).copy()
    outline, dark, mid, hi = R.pal_colors(src_idle)
    clusters = find_eye_clusters(out, outline, visor=visor, front=front, twin=twin)
    a = np.array(out)
    px = out.load()
    w, h = out.size
    if not clusters:
        # Last-resort: only if the candidate pixel is already ink inside the face window.
        fx0, fy0, fx1, fy1 = face_window(out, front=front)
        cx = fx0 + int((fx1 - fx0) * (0.40 if not front else 0.32))
        cy = fy0 + int((fy1 - fy0) * 0.45)
        if visor and hi:
            color = hi[0]
        elif dark:
            color = dark[0]
        else:
            color = outline
        if 0 <= cx < w and 0 <= cy < h and px[cx, cy][3] > 20:
            draw_inverted_u(px, cx, cy, color, size=2, w=w, h=h)
            if front:
                cx2 = fx0 + int((fx1 - fx0) * 0.68)
                if 0 <= cx2 < w and px[cx2, cy][3] > 20:
                    draw_inverted_u(px, cx2, cy, color, size=2, w=w, h=h)
        return out
    for cl in clusters:
        ys = [p[0] for p in cl["pts"]]
        xs = [p[1] for p in cl["pts"]]
        fill = neighbor_fill(a, ys, xs, outline)
        if fill is None:
            fill = mid[0][:3] if mid else outline[:3]
        # paint out the old oval
        for y, x in cl["pts"]:
            if 0 <= x < w and 0 <= y < h and px[x, y][3] > 20:
                px[x, y] = fill[:3] + (255,)
        color = cl["color"]
        # if the old "eye" was almost the fill, use a darker / highlight stroke so ^^ reads
        if abs(luma(color) - luma(fill)) < 18:
            if visor and hi:
                color = hi[0][:3]
            elif chroma(color) < 20:
                color = outline[:3]
        size = 2 if (cl["n"] >= 3 or visor or front) else 1
        draw_inverted_u(px, cl["cx"], cl["cy"], color, size=size, w=w, h=h)
    return out


def close_eyes32(im: Image.Image, src_idle: Image.Image, front=False) -> Image.Image:
    out = R.rgba(im).copy()
    outline, dark, mid, hi = R.pal_colors(src_idle)
    clusters = find_eye_clusters(out, outline, visor=False, front=front)
    a = np.array(out)
    px = out.load()
    w, h = out.size
    if not clusters:
        return out  # don't invent a line on a hidden crib eye
    for cl in clusters:
        ys = [p[0] for p in cl["pts"]]
        xs = [p[1] for p in cl["pts"]]
        fill = neighbor_fill(a, ys, xs, outline) or (mid[0][:3] if mid else outline[:3])
        for y, x in cl["pts"]:
            if 0 <= x < w and 0 <= y < h and px[x, y][3] > 20:
                px[x, y] = fill[:3] + (255,)
        cy = cl["cy"]
        xsrt = sorted(xs)
        x0, x1 = xsrt[0], xsrt[-1]
        if x1 - x0 < 2:
            x0 -= 1
            x1 += 1
        for x in range(x0, x1 + 1):
            if 0 <= x < w and 0 <= cy < h and px[x, cy][3] > 20:
                px[x, cy] = outline[:3] + (255,)
    return out


def mouth_color(im: Image.Image, outline):
    a = np.array(R.rgba(im))
    m = a[:, :, 3] > 20
    if not m.any():
        return outline
    cols = [tuple(int(v) for v in p) for p in a[m]]
    blackish = [c for c in cols if c[0] < 30 and c[1] < 30 and c[2] < 30]
    return blackish[0] if blackish else outline


def open_mouth32(im: Image.Image, src_idle: Image.Image, wide=False) -> Image.Image:
    out = R.rgba(im).copy()
    mask = R.ink_mask(out)
    if mask.sum() < 4:
        return out
    outline, dark, mid, hi = R.pal_colors(src_idle)
    mouth = mouth_color(src_idle, outline)
    hx0, hy0, hx1, hy1 = R.head_box(mask)
    mx = hx0 + max(2, int((hx1 - hx0) * 0.22))
    my = hy0 + int((hy1 - hy0) * 0.62)
    ww, hh = (6, 5) if wide else (4, 3)
    px = out.load()
    w, h = out.size
    for dy in range(-(hh // 2), hh - hh // 2):
        for dx in range(0, ww):
            x, y = mx + dx, my + dy
            if 0 <= x < w and 0 <= y < h and px[x, y][3] > 20:
                px[x, y] = mouth[:3] + (255,)
    return out


def tongue_color(im: Image.Image):
    a = np.array(R.rgba(im))
    m = a[:, :, 3] > 20
    if m.any():
        cols = [tuple(int(v) for v in p[:3]) for p in a[m]]
        reds = [c for c in cols if c[0] > c[1] + 30 and c[0] > c[2] + 10 and c[0] > 80]
        if reds:
            # pick a mid-bright red already in the sprite if any
            reds.sort(key=lambda c: -c[0])
            return reds[0]
    return (232, 88, 112)


def add_tongue32(im: Image.Image, src_idle: Image.Image) -> Image.Image:
    out = R.rgba(im).copy()
    mask = R.ink_mask(out)
    if mask.sum() < 4:
        return out
    outline, dark, mid, hi = R.pal_colors(src_idle)
    hx0, hy0, hx1, hy1 = R.head_box(mask)
    # Hang from the lower face (about 70% down the head), not the bottom of a
    # crown-to-waist head box — KingEtemon / Titamon heads include hats.
    tx = hx0 + max(2, int((hx1 - hx0) * 0.30))
    ty = hy0 + int((hy1 - hy0) * 0.70)
    pink = tongue_color(src_idle)
    edge = outline[:3]
    # slightly open a small mouth just above the tongue if that ink exists
    mouth = mouth_color(src_idle, outline)
    px = out.load()
    w, h = out.size
    for dx in range(0, 4):
        x, y = tx + dx, max(0, ty - 2)
        if 0 <= x < w and 0 <= y < h and px[x, y][3] > 20:
            px[x, y] = mouth[:3] + (255,)
    # tongue body (may extend 1–2 px below the chin)
    for dy in range(0, 6):
        half = 2 if dy < 4 else 1
        for dx in range(-half, half + 1):
            x, y = tx + 1 + dx, ty + dy
            if not (0 <= x < w and 0 <= y < h):
                continue
            is_edge = dy >= 4 or abs(dx) >= half
            px[x, y] = (edge + (255,)) if is_edge else (pink[:3] + (255,))
    return out


def shift32(im: Image.Image, dx, dy) -> Image.Image:
    return R.shift_im(R.rgba(im), dx, dy)


def frames_equal(a: Image.Image, b: Image.Image) -> bool:
    aa = np.array(R.rgba(a))
    bb = np.array(R.rgba(b))
    if aa.shape != bb.shape:
        return False
    # treat near-transparent as equal
    a_ink = aa[:, :, 3] >= 128
    b_ink = bb[:, :, 3] >= 128
    if not np.array_equal(a_ink, b_ink):
        return False
    return np.array_equal(aa[a_ink][:, :3], bb[a_ink][:, :3])


def kind_of(meta, key):
    if key in meta:
        return meta[key].get("kind", "")
    return ""


def is_official(meta, key):
    return kind_of(meta, key) in ("official_color", "official_mono_colorized", "kept_existing_idle")


def official_keys(meta):
    return [k for k, v in meta.items() if v.get("kind") in ("official_color", "official_mono_colorized")]


def pick_base(frames, meta, prefer):
    for k in prefer:
        if k in frames and is_official(meta, k):
            return k, R.rgba(frames[k]).copy(), True
    for k in prefer:
        if k in frames:
            return k, R.rgba(frames[k]).copy(), False
    return "idle0", R.rgba(frames["idle0"]).copy(), is_official(meta, "idle0")


def decode_all(entry):
    out = {}
    for name in entry["frames"]:
        out[name] = B.decode_entry(entry, name)
    return out


def apply_one(mid, frames, meta, stats):
    group = expr_group(mid)
    if group == "egg":
        return frames, meta, []
    front = group == "baby_blob"
    visor = is_visor(mid)
    tongue = uses_tongue(mid)
    idle = R.rgba(frames.get("idle0") or next(iter(frames.values())))
    changed = []

    def designed(key):
        return kind_of(meta, key) == "designed" and key in frames

    def skip_if_official_pixels(key):
        """True if this designed key is already a bit-exact official color cell (and not happy)."""
        if key == "happy":
            return False
        cur = frames[key]
        for ok in official_keys(meta):
            if ok in frames and frames_equal(cur, frames[ok]):
                return True
        return False

    # --- happy ---
    if designed("happy") and not skip_if_official_pixels("happy"):
        bk, base, official = pick_base(frames, meta, ("eat1", "eat0", "eat", "idle0"))
        # Official eat is only a valid shared-body base if it still looks like idle.
        if official and bk.startswith("eat") and not pose_similar(base, idle):
            bk, base, official = "idle0", idle.copy(), is_official(meta, "idle0")
        if bk in ("idle0", "idle1"):
            base = open_mouth32(base, idle, wide=True)
        twin = idle if official and bk.startswith("eat") else None
        happy = apply_happy_eyes(base, idle, visor=visor, front=front, twin=twin)
        frames["happy"] = happy
        meta["happy"] = {"kind": "designed", "src": f"expr-happy-from-{bk}"}
        changed.append("happy")
        stats["happy"] += 1

    # --- eat0 / eat1 / eat (designed only) ---
    if designed("eat0") and not skip_if_official_pixels("eat0"):
        frames["eat0"] = open_mouth32(idle.copy(), idle, wide=False)
        meta["eat0"] = {"kind": "designed", "src": "expr-eat0-from-idle0"}
        changed.append("eat0")
        stats["eat0"] += 1
    if designed("eat1") and not skip_if_official_pixels("eat1"):
        wide = open_mouth32(idle.copy(), idle, wide=True)
        frames["eat1"] = wide
        meta["eat1"] = {"kind": "designed", "src": "expr-eat1-from-idle0"}
        changed.append("eat1")
        stats["eat1"] += 1
    if designed("eat") and not skip_if_official_pixels("eat"):
        src = frames.get("eat1") or frames.get("eat0") or open_mouth32(idle.copy(), idle, wide=True)
        frames["eat"] = R.rgba(src).copy()
        meta["eat"] = {"kind": "designed", "src": "expr-eat-alias"}
        changed.append("eat")
        stats["eat"] += 1

    # --- angry ---
    if designed("angry") and not skip_if_official_pixels("angry"):
        bk, base, official = pick_base(frames, meta, ("eat1", "eat0", "eat", "idle0"))
        if official and bk.startswith("eat") and not pose_similar(base, idle):
            bk, base, official = "idle0", idle.copy(), is_official(meta, "idle0")
        if bk in ("idle0", "idle1"):
            base = open_mouth32(base, idle, wide=True)
            frames["angry"] = base
            meta["angry"] = {"kind": "designed", "src": "expr-angry-from-idle0"}
        elif official:
            # Official Agumon: angry is the eat/roar cell itself — only when the pose matches.
            frames["angry"] = R.rgba(base).copy()
            meta["angry"] = {"kind": "official_color", "src": f"official-reuse-{bk}"}
        else:
            frames["angry"] = base
            meta["angry"] = {"kind": "designed", "src": f"expr-angry-from-{bk}"}
        changed.append("angry")
        stats["angry"] += 1

    # --- refuse ---
    if designed("refuse") and not skip_if_official_pixels("refuse"):
        if tongue:
            ref = R.rgba(idle).copy()
            ref = add_tongue32(ref, idle)
            frames["refuse"] = ref
            meta["refuse"] = {"kind": "designed", "src": "expr-refuse-tongue"}
        else:
            if group == "baby_blob":
                # Official Koromon refuse is a slightly smaller/lower frontal, not a dino bow, no tongue.
                frames["refuse"] = shift32(idle, 0, 1)
                meta["refuse"] = {"kind": "designed", "src": "expr-refuse-baby"}
            else:
                im16 = R.to16(idle)
                bowed = R.refuse_pose(im16, im16)
                frames["refuse"] = R.to32(bowed)
                meta["refuse"] = {"kind": "designed", "src": "expr-refuse-bow"}
        changed.append("refuse")
        stats["refuse"] += 1

    # --- sleep: keep body, close eyes ---
    for sk in ("sleep0", "sleep1", "sleep"):
        if designed(sk) and not skip_if_official_pixels(sk):
            cur = R.rgba(frames[sk])
            frames[sk] = close_eyes32(cur, idle, front=front)
            meta[sk] = {"kind": "designed", "src": "expr-sleep-close-eyes"}
            changed.append(sk)
            stats[sk] += 1

    # If sleep1 should stay a 1px shift of (possibly updated) sleep0 when both designed:
    if designed("sleep1") and "sleep0" in frames and kind_of(meta, "sleep0") in ("designed", "official_color"):
        # after closing eyes on both, re-derive sleep1 as a 1px horizontal bob of sleep0 if they used to be a pair
        s0 = R.rgba(frames["sleep0"])
        frames["sleep1"] = shift32(s0, 1, 0)
        if "sleep1" not in changed and designed("sleep1"):
            changed.append("sleep1")
        meta["sleep1"] = {"kind": "designed", "src": "expr-sleep1-shift"}

    # --- hurt1 / designed hurt ---
    # Official hurt is a slump with a normal/grimace eye, never X. If official hurt
    # exists, designed hurt1 is only a 1px bob of that cell. Otherwise keep the
    # existing designed slump and do not invent new eyes.
    if designed("hurt1"):
        if "hurt" in frames and is_official(meta, "hurt"):
            frames["hurt1"] = shift32(frames["hurt"], 0, 1)
            meta["hurt1"] = {"kind": "designed", "src": "expr-hurt1-shift-official"}
            changed.append("hurt1")
            stats["hurt1"] += 1
        elif "hurt0" in frames and is_official(meta, "hurt0"):
            frames["hurt1"] = shift32(frames["hurt0"], 0, 1)
            meta["hurt1"] = {"kind": "designed", "src": "expr-hurt1-shift-official"}
            changed.append("hurt1")
            stats["hurt1"] += 1

    # --- attack designed ---
    if designed("attack") and not skip_if_official_pixels("attack"):
        bk, base, official = pick_base(frames, meta, ("eat1", "eat0", "angry", "idle0"))
        if bk in ("idle0", "idle1"):
            base = open_mouth32(base, idle, wide=True)
            base = shift32(base, -2, 0)
        frames["attack"] = base
        meta["attack"] = {"kind": "designed", "src": f"expr-attack-from-{bk}"}
        changed.append("attack")
        stats["attack"] += 1

    return frames, meta, changed


def designed_ids(cov):
    ids = []
    for mid, meta in cov["monsters"].items():
        if any(v.get("kind") == "designed" for v in meta.values()):
            ids.append(mid)
    return ids


def write_sprites(js_text, existing, new_frames):
    text = js_text
    for mid, frames in new_frames.items():
        obj = B.encode_sprite(frames)
        text = R.replace_entry(text, mid, obj)
    return text


def main():
    study_path = ROOT / "expression-study.png"
    build_study_png(study_path)

    js_text = JS_PATH.read_text()
    existing = B.parse_existing_sprites(js_text)
    cov = json.loads(COV_PATH.read_text())
    ids = designed_ids(cov)
    names = R.load_names()
    stats = Counter()
    new_frames = {}
    new_meta = {}
    changed_monsters = 0
    skipped_official = 0

    for mid in ids:
        entry = existing[mid]
        frames = decode_all(entry)
        meta = {k: dict(v) for k, v in cov["monsters"][mid].items()}
        before = {k: R.rgba(v).copy() for k, v in frames.items()}
        frames, meta, changed = apply_one(mid, frames, meta, stats)
        new_frames[mid] = frames
        new_meta[mid] = meta
        if changed:
            changed_monsters += 1
        # count official keys left untouched
        for k, im in frames.items():
            if kind_of(cov["monsters"][mid], k) == "official_color":
                if not frames_equal(before[k], im):
                    print("ERROR official mutated", mid, k)
                    # restore
                    frames[k] = before[k]
                else:
                    skipped_official += 1

    # write only monsters we may have changed
    text = write_sprites(js_text, existing, new_frames)
    JS_PATH.write_text(text)
    print("wrote", JS_PATH, "bytes", JS_PATH.stat().st_size)

    # verify official pixels still match the backup for official_color keys
    bak = B.parse_existing_sprites(Path("/tmp/pass9/sprites.js.bak").read_text())
    mismatches = 0
    for mid in ids:
        meta = cov["monsters"][mid]
        for k, v in meta.items():
            if v.get("kind") != "official_color":
                continue
            if k not in bak[mid]["frames"] or k not in existing[mid]["frames"]:
                continue
            a = B.decode_entry(bak[mid], k)
            b = B.decode_entry(B.parse_existing_sprites(text)[mid], k)
            if not frames_equal(a, b):
                mismatches += 1
                print("OFFICIAL DRIFT", mid, k)
    print("official_color drift count", mismatches)

    # coverage output
    out_cov = {"monsters": new_meta, "expr_stats": dict(stats), "changed_monsters": changed_monsters}
    (CACHE / "coverage.json").write_text(json.dumps(out_cov, indent=2, ensure_ascii=False))

    # anim-sample: need frames + meta for the 16 sample ids (including official-only)
    sample = [
        "agumon", "omegamon", "dorumon", "lasttyranomon", "titamon", "lunamon", "kingetemon", "meicoomon",
        "hackmon", "jesmon", "zubamon", "dracomon", "alphamon", "coronamon", "petitmon", "dorugamon",
    ]
    all_existing = B.parse_existing_sprites(text)
    samp_frames = {}
    samp_meta = {}
    for mid in sample:
        if mid in new_frames:
            samp_frames[mid] = new_frames[mid]
            # merge coverage kinds for official keys from original cov, updated for designed
            base_meta = {k: dict(v) for k, v in cov["monsters"].get(mid, {}).items()}
            base_meta.update(new_meta.get(mid, {}))
            samp_meta[mid] = base_meta
        else:
            samp_frames[mid] = decode_all(all_existing[mid])
            samp_meta[mid] = {k: dict(v) for k, v in cov["monsters"].get(mid, {}).items()}
    R.make_anim_sample(sample, samp_frames, samp_meta, names, ROOT / "anim-sample.png")

    qa = ["dorumon", "titamon", "lunamon", "kingetemon", "lasttyranomon", "meicoomon",
          "hackmon", "petitmon", "pinochimon", "examon", "jesmon", "alphamon"]
    qa_frames, qa_meta = {}, {}
    for mid in qa:
        qa_frames[mid] = new_frames[mid]
        qa_meta[mid] = new_meta[mid]
    R.make_anim_sample(qa, qa_frames, qa_meta, names, CACHE / "qa-expr.png")

    print("stats", dict(stats))
    print("changed_monsters", changed_monsters, "of", len(ids))
    print("official keys verified untouched", skipped_official, "drift", mismatches)


if __name__ == "__main__":
    main()
