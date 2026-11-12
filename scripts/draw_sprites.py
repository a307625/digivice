#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Hand-authored 32x32 color pixel-art sprites (official colors/silhouettes, original pixels)."""
from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixeldraw import Canvas, canvas_to_rgba, compact, OUTLINE
from PIL import Image, ImageDraw, ImageFont

# Palette: 0 trans, 1 outline, 2 body, 3 shadow, 4 highlight,
# 5 belly/secondary, 6 belly shadow, 7 white, 8 dark, 9 shine,
# 10 accent, 11 accent2, 12 metal, 13 metal shadow, 14 extra, 15 extra2

def pal(body, shadow, hi, belly=None, belly_sh=None, acc=None, acc2=None,
        metal=None, metal_sh=None, extra=None, extra2=None, outline=OUTLINE):
    return [
        None,
        outline,
        body, shadow, hi,
        belly or (245, 230, 190),
        belly_sh or (200, 170, 120),
        (255, 255, 255),
        (24, 18, 20),
        (255, 252, 240),
        acc or body,
        acc2 or (acc or shadow),
        metal or (168, 176, 188),
        metal_sh or (88, 96, 108),
        extra or body,
        extra2 or shadow,
    ]

def new():
    return Canvas(32, 32)

def finish(c):
    c.outline(1)
    return c

def idle2(c):
    n = c.clone()
    n.shift(0, -1)
    return n

# ---------- primitive pose helpers ----------
def blob(c, cx, cy, rx, ry, col=2, hi=4, sh=3):
    c.shade_ellipse(cx, cy, rx, ry, col, hi, sh)

def feet(c, x1, x2, y, col=3):
    c.fill_rect(x1, y, 4, 3, col)
    c.fill_rect(x2, y, 4, 3, col)

def arms_down(c, lx, rx, y, col=2, claws=10, claw=True):
    c.fill_rect(lx, y, 3, 6, col)
    c.fill_rect(rx, y, 3, 6, col)
    if claw:
        c.pset(lx, y + 6, claws)
        c.pset(lx + 2, y + 6, claws)
        c.pset(rx, y + 6, claws)
        c.pset(rx + 2, y + 6, claws)

def eyes_pair(c, x, y, gap=5, iris=8):
    c.eye(x, y, iris=iris)
    c.eye(x + gap, y, iris=iris)

def mouth(c, x, y, w=3, col=8):
    c.fill_rect(x, y, w, 1, col)

# ============================================================
# Individual sprites — official colors & key features, consistent style
# ============================================================

def egg_base(c, shell, band, mark):
    c.shade_ellipse(16, 18, 9, 11, 2, 4, 3)
    c.fill_ellipse(16, 26, 6, 3, 3)
    # cracked highlight
    c.pset(12, 12, 4)
    c.pset(13, 11, 4)
    # version mark
    c.fill_rect(14, 16, 5, 3, 10)
    c.pset(16, 15, 10)
    c.pset(16, 19, 10)

def draw_egg_v1():
    c = new()
    egg_base(c, 2, 10, 10)
    return finish(c)

# We'll register via a palettes+draw table below.

SPRITES = {}  # filled at bottom after all draw_ fns

def D(fn):
    """Decorator to collect draw functions."""
    SPRITES[fn.__name__[5:] if fn.__name__.startswith("draw_") else fn.__name__] = fn
    return fn

# ---- eggs ----
@D
def draw_egg_v1():
    c = new(); c.shade_ellipse(16, 18, 9, 11, 2, 4, 3)
    c.fill_rect(14, 16, 5, 3, 10); c.pset(16, 15, 10)
    return finish(c)

@D
def draw_egg_v2():
    c = new(); c.shade_ellipse(16, 18, 9, 11, 2, 4, 3)
    c.fill_rect(13, 17, 7, 2, 10); c.fill_rect(15, 15, 3, 6, 10)
    return finish(c)

@D
def draw_egg_v3():
    c = new(); c.shade_ellipse(16, 18, 9, 11, 2, 4, 3)
    c.fill_ellipse(16, 17, 3, 3, 10)
    return finish(c)

@D
def draw_egg_v4():
    c = new(); c.shade_ellipse(16, 18, 9, 11, 2, 4, 3)
    # sprout mark
    c.fill_rect(16, 12, 1, 4, 10); c.fill_rect(14, 13, 5, 1, 10)
    return finish(c)

@D
def draw_egg_v5():
    c = new(); c.shade_ellipse(16, 18, 9, 11, 2, 4, 3)
    c.fill_rect(12, 16, 2, 2, 10); c.fill_rect(18, 16, 2, 2, 10)
    c.fill_rect(15, 20, 3, 2, 8)
    return finish(c)

# ---- Ver.1 babies / rookies ----
@D
def draw_botamon():
    c = new()
    blob(c, 16, 20, 10, 8, 2, 4, 3)
    # fuzzy bumps
    for x, y in ((8, 16), (24, 16), (10, 12), (22, 12), (16, 11), (7, 20), (25, 20)):
        c.pset(x, y, 3)
    eyes_pair(c, 12, 18, 5, iris=10)
    c.fill_rect(14, 22, 5, 2, 11)  # pink mouth
    return finish(c)

@D
def draw_koromon():
    c = new()
    blob(c, 16, 20, 10, 9, 2, 4, 3)
    eyes_pair(c, 11, 17, 6, iris=10)
    c.fill_ellipse(16, 23, 3, 2, 11)
    c.fill_rect(10, 27, 4, 2, 3)
    c.fill_rect(18, 27, 4, 2, 3)
    return finish(c)

@D
def draw_agumon():
    c = new()
    # legs
    c.fill_rect(10, 24, 5, 6, 2); c.fill_rect(18, 24, 5, 6, 2)
    c.fill_rect(10, 29, 5, 2, 5); c.fill_rect(18, 29, 5, 2, 5)
    # body
    c.shade_ellipse(16, 21, 7, 6, 2, 4, 3)
    c.fill_ellipse(16, 22, 4, 3, 5)  # belly
    # head
    c.shade_ellipse(16, 12, 8, 7, 2, 4, 3)
    c.fill_ellipse(16, 14, 4, 3, 5)
    # snout
    c.fill_ellipse(16, 16, 5, 3, 2)
    c.fill_rect(13, 16, 7, 1, 8)  # mouth line
    # eyes green
    c.eye(11, 10, iris=10); c.eye(18, 10, iris=10)
    # arms + claws
    c.fill_rect(6, 18, 4, 5, 2); c.fill_rect(22, 18, 4, 5, 2)
    for x in (6, 8, 22, 24):
        c.pset(x, 23, 12)
    # nostril
    c.pset(14, 15, 8); c.pset(18, 15, 8)
    return finish(c)

@D
def draw_betamon():
    c = new()
    c.shade_ellipse(16, 22, 9, 7, 2, 4, 3)
    c.fill_ellipse(16, 23, 5, 3, 5)
    c.shade_ellipse(16, 14, 7, 6, 2, 4, 3)
    # yellow dorsal fin
    c.fill_poly([(16, 4), (19, 12), (13, 12)], 10)
    c.fill_poly([(16, 5), (17, 11), (15, 11)], 11)
    # arms
    c.fill_rect(6, 20, 4, 4, 2); c.fill_rect(22, 20, 4, 4, 2)
    for x in (6, 8, 22, 24):
        c.pset(x, 24, 11)
    feet(c, 10, 19, 28, 3)
    eyes_pair(c, 11, 12, 6, iris=8)
    mouth(c, 14, 17, 4)
    return finish(c)

@D
def draw_greymon():
    c = new()
    # legs / body
    c.fill_rect(9, 22, 6, 8, 2); c.fill_rect(18, 22, 6, 8, 2)
    c.fill_rect(9, 29, 6, 2, 5); c.fill_rect(18, 29, 6, 2, 5)
    c.shade_ellipse(16, 20, 9, 7, 2, 4, 3)
    c.fill_ellipse(16, 21, 5, 4, 5)
    # helmet brown
    c.shade_ellipse(16, 10, 9, 7, 10, 11, 3)
    # cream horns
    c.fill_poly([(6, 8), (11, 6), (11, 11)], 5)
    c.fill_poly([(26, 8), (21, 6), (21, 11)], 5)
    # snout
    c.fill_ellipse(16, 14, 6, 4, 2)
    c.fill_rect(12, 15, 9, 1, 8)
    c.eye(10, 9, iris=14); c.eye(19, 9, iris=14)
    # stripes
    c.fill_rect(10, 20, 2, 3, 8); c.fill_rect(20, 20, 2, 3, 8)
    # arms
    c.fill_rect(4, 18, 5, 5, 2); c.fill_rect(23, 18, 5, 5, 2)
    return finish(c)

@D
def draw_tyranomon():
    c = new()
    c.fill_rect(10, 23, 5, 7, 2); c.fill_rect(18, 23, 5, 7, 2)
    c.fill_rect(10, 29, 5, 2, 5); c.fill_rect(18, 29, 5, 2, 5)
    c.shade_ellipse(16, 20, 8, 7, 2, 4, 3)
    c.fill_ellipse(16, 21, 5, 4, 5)
    c.shade_ellipse(17, 11, 8, 7, 2, 4, 3)
    # small arms
    c.fill_rect(8, 17, 3, 4, 2); c.fill_rect(22, 17, 3, 4, 2)
    # tail
    c.fill_poly([(6, 22), (2, 18), (8, 20)], 3)
    eyes_pair(c, 14, 9, 5, iris=8)
    c.fill_rect(18, 13, 6, 1, 8)
    # back ridges
    c.pset(12, 15, 10); c.pset(14, 14, 10); c.pset(16, 14, 10)
    return finish(c)

@D
def draw_devimon():
    c = new()
    # wings blue
    c.fill_poly([(2, 10), (12, 14), (4, 22), (1, 18)], 10)
    c.fill_poly([(30, 10), (20, 14), (28, 22), (31, 18)], 10)
    # body
    c.shade_ellipse(16, 20, 6, 8, 2, 4, 3)
    c.fill_rect(11, 26, 4, 5, 2); c.fill_rect(18, 26, 4, 5, 2)
    # head + white hair
    c.shade_ellipse(16, 10, 6, 6, 2, 4, 3)
    c.fill_poly([(10, 6), (16, 1), (22, 6), (16, 8)], 7)
    c.eye(12, 9, iris=11); c.eye(18, 9, iris=11)
    # red markings / claws
    c.fill_rect(8, 18, 3, 5, 2); c.fill_rect(21, 18, 3, 5, 2)
    c.pset(8, 23, 11); c.pset(10, 23, 11); c.pset(21, 23, 11); c.pset(23, 23, 11)
    return finish(c)

@D
def draw_meramon():
    c = new()
    # flame aura
    for x, y, r in ((8, 8, 4), (16, 5, 5), (24, 8, 4), (6, 16, 3), (26, 16, 3), (16, 28, 3)):
        c.fill_ellipse(x, y, r, r + 1, 10)
        c.fill_ellipse(x, y, max(1, r - 2), r - 1, 11)
    # dark face in fire
    c.shade_ellipse(16, 16, 6, 7, 2, 4, 3)
    c.eye(12, 13, iris=10); c.eye(18, 13, iris=10)
    c.fill_rect(13, 18, 6, 1, 10)
    # arms of fire
    c.fill_ellipse(6, 20, 3, 5, 10); c.fill_ellipse(26, 20, 3, 5, 10)
    return finish(c)

@D
def draw_airdramon():
    c = new()
    # wings
    c.fill_poly([(1, 12), (14, 10), (12, 18), (2, 20)], 5)
    c.fill_poly([(31, 12), (18, 10), (20, 18), (30, 20)], 5)
    c.fill_poly([(4, 13), (12, 12), (11, 16)], 7)
    c.fill_poly([(28, 13), (20, 12), (21, 16)], 7)
    # serpentine body
    c.shade_ellipse(16, 20, 8, 6, 2, 4, 3)
    c.fill_ellipse(16, 21, 5, 3, 5)
    c.shade_ellipse(20, 12, 7, 6, 2, 4, 3)
    # yellow horn
    c.fill_poly([(20, 3), (23, 10), (18, 9)], 10)
    c.eye(18, 11, iris=11)
    c.fill_rect(24, 14, 5, 1, 8)
    # tail
    c.fill_ellipse(6, 24, 4, 3, 2)
    return finish(c)

@D
def draw_seadramon():
    c = new()
    # coiled sea serpent
    c.shade_ellipse(12, 22, 8, 5, 2, 4, 3)
    c.shade_ellipse(20, 18, 7, 5, 2, 4, 3)
    c.shade_ellipse(18, 11, 7, 6, 2, 4, 3)
    c.fill_ellipse(18, 13, 4, 3, 5)
    # red antenna orb
    c.thick_line(18, 5, 18, 8, 11, 1)
    c.fill_circle(18, 4, 2, 10)
    c.eye(16, 10, iris=10)
    c.fill_rect(22, 12, 5, 1, 8)
    c.fill_ellipse(5, 24, 3, 3, 2)
    return finish(c)

@D
def draw_numemon():
    c = new()
    c.shade_ellipse(16, 22, 11, 7, 2, 4, 3)
    # head bump
    c.shade_ellipse(16, 15, 7, 6, 2, 4, 3)
    c.eye(11, 14, iris=10); c.eye(18, 14, iris=10)
    # drool
    c.pset(15, 20, 14); c.pset(15, 21, 14); c.pset(15, 22, 7)
    c.fill_ellipse(16, 24, 3, 2, 11)
    return finish(c)

@D
def draw_metalgreymon():
    c = new()
    # metal legs / body (virus: blue metal + brown organic)
    c.fill_rect(8, 22, 7, 8, 12); c.fill_rect(18, 22, 7, 8, 12)
    c.fill_rect(8, 29, 7, 2, 13); c.fill_rect(18, 29, 7, 2, 13)
    c.shade_ellipse(16, 18, 10, 7, 12, 4, 13)
    # organic brown upper
    c.shade_ellipse(16, 12, 8, 6, 2, 4, 3)
    # metal jaw
    c.fill_rect(11, 14, 11, 4, 12)
    c.fill_rect(12, 16, 9, 1, 8)
    # trident hair / cables
    c.fill_rect(14, 4, 2, 6, 10); c.fill_rect(17, 3, 2, 7, 10)
    c.fill_rect(11, 6, 2, 5, 10)
    c.eye(11, 10, iris=11); c.eye(18, 10, iris=11)
    # missile arm
    c.fill_rect(2, 16, 7, 5, 12); c.fill_rect(1, 17, 2, 3, 10)
    c.fill_rect(24, 16, 6, 5, 2)
    return finish(c)

@D
def draw_mamemon():
    c = new()
    c.shade_ellipse(16, 16, 9, 9, 12, 4, 13)
    # fuse
    c.fill_rect(15, 4, 2, 4, 8)
    c.fill_ellipse(16, 3, 2, 2, 10)
    # face
    c.eye(11, 14, iris=8); c.eye(18, 14, iris=8)
    c.fill_rect(14, 18, 5, 1, 8)
    c.pset(13, 17, 8); c.pset(19, 17, 8)  # smile
    # gloves
    c.fill_circle(6, 22, 4, 7)
    c.fill_circle(26, 22, 4, 7)
    c.fill_rect(14, 25, 5, 4, 12)
    return finish(c)

@D
def draw_monzaemon():
    c = new()
    # teddy body yellow
    c.shade_ellipse(16, 20, 9, 9, 2, 4, 3)
    c.shade_ellipse(16, 10, 7, 7, 2, 4, 3)
    # ears
    c.fill_circle(8, 6, 4, 2); c.fill_circle(24, 6, 4, 2)
    c.fill_circle(8, 6, 2, 11); c.fill_circle(24, 6, 2, 11)
    # black muzzle
    c.fill_ellipse(16, 12, 4, 3, 8)
    c.pset(16, 12, 7)
    c.eye(11, 9, iris=8); c.eye(18, 9, iris=8)
    # heart
    c.fill_rect(14, 20, 5, 4, 10)
    c.pset(14, 19, 10); c.pset(18, 19, 10)
    # red claws
    c.fill_rect(5, 18, 4, 5, 2); c.fill_rect(23, 18, 4, 5, 2)
    c.pset(5, 23, 10); c.pset(7, 23, 10); c.pset(24, 23, 10); c.pset(26, 23, 10)
    feet(c, 10, 19, 28)
    return finish(c)

@D
def draw_blitzgreymon():
    c = new()
    # heavy crimson armor, guns, yellow chest
    c.fill_rect(7, 22, 8, 8, 2); c.fill_rect(18, 22, 8, 8, 2)
    c.shade_ellipse(16, 17, 11, 8, 2, 4, 3)
    c.fill_ellipse(16, 18, 5, 4, 10)  # yellow core
    c.fill_rect(14, 16, 5, 2, 11)
    # head / visor
    c.shade_ellipse(16, 8, 8, 6, 2, 4, 3)
    c.fill_rect(10, 8, 13, 3, 12)
    c.fill_rect(11, 9, 11, 1, 11)
    # shoulder cannons
    c.fill_rect(1, 11, 7, 5, 13)
    c.fill_rect(24, 11, 7, 5, 13)
    c.fill_rect(0, 12, 2, 3, 10)
    c.fill_rect(30, 12, 2, 3, 10)
    # horns
    c.fill_poly([(8, 3), (12, 7), (9, 8)], 12)
    c.fill_poly([(24, 3), (20, 7), (23, 8)], 12)
    return finish(c)

@D
def draw_banchomamemon():
    c = new()
    c.shade_ellipse(16, 12, 8, 8, 12, 4, 13)
    # blonde swoop
    c.fill_poly([(10, 5), (20, 3), (22, 8), (10, 8)], 10)
    c.eye(11, 11, iris=8); c.eye(18, 11, iris=8)
    c.fill_rect(14, 15, 4, 1, 8)
    # black gakuran
    c.fill_rect(10, 19, 13, 10, 8)
    c.fill_rect(15, 19, 3, 10, 7)  # shirt
    c.pset(13, 22, 11); c.pset(13, 25, 11)  # gold buttons
    c.pset(20, 22, 11); c.pset(20, 25, 11)
    # wooden sword
    c.fill_rect(3, 16, 3, 14, 14)
    c.fill_rect(2, 15, 5, 3, 5)
    return finish(c)

print("part1 defs ok", len(SPRITES))

# ---- Ver.2 ----
@D
def draw_punimon():
    c = new()
    blob(c, 16, 20, 9, 8, 2, 4, 3)
    c.fill_ellipse(12, 12, 3, 3, 2)
    c.fill_ellipse(20, 12, 3, 3, 2)
    eyes_pair(c, 11, 18, 6, iris=8)
    c.fill_ellipse(16, 23, 3, 2, 11)
    return finish(c)

@D
def draw_tsunomon():
    c = new()
    blob(c, 16, 21, 9, 8, 2, 4, 3)
    # brown horn tuft
    c.fill_poly([(16, 6), (19, 14), (13, 14)], 10)
    c.fill_poly([(16, 7), (17, 13), (15, 13)], 11)
    eyes_pair(c, 11, 18, 6, iris=8)
    feet(c, 10, 18, 28, 3)
    return finish(c)

@D
def draw_gabumon():
    c = new()
    c.fill_rect(10, 24, 5, 6, 5); c.fill_rect(18, 24, 5, 6, 5)
    c.shade_ellipse(16, 20, 7, 6, 5, 4, 6)  # blue-grey skin
    # yellow pelt
    c.shade_ellipse(16, 14, 8, 7, 2, 4, 3)
    c.fill_poly([(8, 8), (16, 4), (24, 8), (16, 12)], 2)
    # red horn
    c.fill_poly([(16, 2), (18, 8), (14, 8)], 10)
    c.eye(12, 12, iris=8); c.eye(19, 12, iris=8)
    c.fill_rect(6, 18, 4, 5, 2); c.fill_rect(22, 18, 4, 5, 2)
    c.pset(6, 23, 10); c.pset(8, 23, 10); c.pset(22, 23, 10); c.pset(24, 23, 10)
    return finish(c)

@D
def draw_elecmon():
    c = new()
    c.shade_ellipse(16, 20, 8, 7, 2, 4, 3)
    c.shade_ellipse(16, 12, 6, 6, 2, 4, 3)
    # ears
    c.fill_poly([(8, 4), (12, 12), (7, 12)], 2)
    c.fill_poly([(24, 4), (20, 12), (25, 12)], 2)
    # yellow stripes
    c.fill_rect(12, 18, 2, 4, 10); c.fill_rect(18, 18, 2, 4, 10)
    # striped tail
    c.fill_rect(25, 20, 5, 3, 2); c.pset(28, 20, 10); c.pset(27, 21, 10)
    eyes_pair(c, 12, 11, 5)
    feet(c, 10, 18, 27)
    return finish(c)

@D
def draw_kabuterimon():
    c = new()
    c.shade_ellipse(16, 18, 10, 9, 2, 4, 3)
    # horn
    c.fill_rect(15, 2, 3, 8, 12)
    c.fill_poly([(7, 6), (16, 3), (16, 8)], 12)
    c.fill_poly([(25, 6), (16, 3), (16, 8)], 12)
    # red eyes
    c.fill_rect(8, 12, 5, 3, 10); c.fill_rect(20, 12, 5, 3, 10)
    c.pset(10, 13, 8); c.pset(22, 13, 8)
    # legs
    for x in (6, 11, 19, 24):
        c.fill_rect(x, 26, 3, 5, 3)
    return finish(c)

@D
def draw_garurumon():
    c = new()
    # wolf quadruped-ish, standing
    c.shade_ellipse(16, 22, 10, 6, 2, 4, 3)
    c.shade_ellipse(22, 14, 7, 6, 2, 4, 3)
    # blue stripes
    c.fill_rect(10, 20, 2, 4, 10); c.fill_rect(14, 19, 2, 4, 10)
    c.fill_rect(20, 16, 2, 4, 10)
    # ears
    c.fill_poly([(18, 5), (21, 12), (17, 12)], 2)
    c.fill_poly([(26, 5), (27, 12), (23, 12)], 2)
    c.eye(20, 12, iris=11)
    c.fill_rect(26, 16, 5, 2, 7)  # snout
    # legs
    for x in (8, 13, 18, 23):
        c.fill_rect(x, 27, 3, 4, 3)
    c.fill_rect(4, 20, 5, 3, 2)  # tail
    return finish(c)

@D
def draw_angemon():
    c = new()
    # six wings
    for x, flip in ((1, 1), (22, 0)):
        c.fill_ellipse(5 if flip else 27, 12, 5, 4, 7)
        c.fill_ellipse(4 if flip else 28, 18, 5, 4, 7)
        c.fill_ellipse(6 if flip else 26, 23, 4, 3, 5)
    c.shade_ellipse(16, 20, 5, 8, 5, 4, 6)
    # gold chest
    c.fill_rect(13, 18, 7, 4, 10)
    c.shade_ellipse(16, 10, 5, 5, 5, 4, 6)
    # blue hair
    c.fill_poly([(11, 6), (16, 2), (21, 6), (16, 8)], 14)
    c.eye(13, 9, iris=8); c.eye(17, 9, iris=8)
    c.fill_rect(15, 28, 3, 3, 5)
    return finish(c)

@D
def draw_yukidarumon():
    c = new()
    c.shade_ellipse(16, 22, 9, 7, 2, 4, 3)
    c.shade_ellipse(16, 12, 7, 6, 2, 4, 3)
    # blue belly
    c.fill_ellipse(16, 22, 5, 4, 10)
    c.eye(12, 11, iris=8); c.eye(18, 11, iris=8)
    c.fill_rect(14, 15, 4, 1, 8)
    # ice claws / arms
    c.fill_circle(6, 20, 3, 14)
    c.fill_circle(26, 20, 3, 14)
    feet(c, 10, 18, 28)
    return finish(c)

@D
def draw_birdramon():
    c = new()
    c.fill_poly([(2, 14), (14, 12), (10, 22)], 2)
    c.fill_poly([(30, 14), (18, 12), (22, 22)], 2)
    c.shade_ellipse(16, 18, 7, 8, 2, 4, 3)
    c.shade_ellipse(16, 10, 6, 5, 2, 4, 3)
    c.fill_poly([(13, 10), (16, 4), (19, 10)], 10)  # crest
    c.fill_ellipse(16, 13, 3, 2, 11)  # beak
    c.eye(12, 9, iris=8); c.eye(18, 9, iris=8)
    c.fill_rect(13, 26, 3, 5, 11); c.fill_rect(17, 26, 3, 5, 11)
    return finish(c)

@D
def draw_whamon():
    c = new()
    c.shade_ellipse(16, 18, 13, 8, 2, 4, 3)
    c.fill_ellipse(16, 20, 8, 5, 5)
    # tail
    c.fill_poly([(2, 16), (0, 10), (6, 16)], 2)
    c.fill_poly([(2, 20), (0, 26), (6, 20)], 2)
    c.eye(24, 15, iris=8)
    c.fill_rect(26, 18, 4, 1, 8)
    # red markings
    c.fill_rect(12, 14, 3, 2, 10)
    c.fill_ellipse(8, 10, 4, 3, 2)  # spout bump
    return finish(c)

@D
def draw_vegimon():
    c = new()
    c.shade_ellipse(16, 20, 8, 8, 2, 4, 3)
    # leaf hair
    c.fill_poly([(8, 8), (16, 2), (24, 8), (16, 12)], 10)
    c.fill_poly([(16, 3), (20, 10), (12, 10)], 11)
    c.eye(11, 16, iris=8); c.eye(18, 16, iris=8)
    c.fill_ellipse(16, 22, 4, 3, 11)  # mouth
    c.fill_rect(8, 24, 3, 5, 2); c.fill_rect(21, 24, 3, 5, 2)
    return finish(c)

@D
def draw_skullgreymon():
    c = new()
    c.fill_rect(8, 22, 7, 8, 8); c.fill_rect(18, 22, 7, 8, 8)
    c.shade_ellipse(16, 18, 9, 6, 8, 5, 3)
    # skull head
    c.shade_ellipse(16, 9, 9, 8, 5, 7, 6)
    c.fill_rect(10, 10, 4, 3, 10); c.fill_rect(19, 10, 4, 3, 10)  # red eyes
    c.fill_rect(13, 16, 7, 2, 8)
    c.pset(14, 16, 7); c.pset(16, 16, 7); c.pset(18, 16, 7)
    # spine
    c.fill_rect(15, 2, 3, 4, 5)
    c.fill_rect(3, 16, 6, 4, 8)
    return finish(c)

@D
def draw_metalmamemon():
    c = new()
    c.shade_ellipse(16, 15, 8, 8, 12, 4, 13)
    c.fill_rect(15, 4, 2, 4, 8)
    c.fill_ellipse(16, 3, 2, 2, 10)
    c.eye(11, 13, iris=8); c.eye(18, 13, iris=8)
    c.fill_rect(14, 17, 4, 1, 8)
    # cannon arm
    c.fill_rect(1, 16, 8, 5, 13)
    c.fill_rect(0, 17, 2, 3, 10)
    c.fill_circle(26, 20, 4, 12)
    c.fill_rect(14, 23, 5, 6, 12)
    return finish(c)

@D
def draw_vademon():
    c = new()
    # big grey alien head
    c.shade_ellipse(16, 12, 11, 10, 2, 4, 3)
    c.fill_ellipse(12, 12, 3, 4, 10)
    c.fill_ellipse(20, 12, 3, 4, 10)
    c.pset(12, 13, 8); c.pset(20, 13, 8)
    # tiny body
    c.fill_rect(13, 22, 7, 6, 2)
    c.fill_rect(10, 26, 3, 5, 3); c.fill_rect(20, 26, 3, 5, 3)
    c.fill_rect(15, 20, 3, 2, 5)
    return finish(c)

@D
def draw_skullmammon():
    c = new()
    # huge skeletal mammoth
    c.shade_ellipse(16, 20, 12, 8, 2, 4, 3)
    c.shade_ellipse(22, 12, 8, 7, 5, 7, 6)
    # tusks
    c.fill_poly([(22, 16), (8, 28), (12, 18)], 7)
    c.fill_poly([(26, 16), (30, 28), (23, 18)], 7)
    c.fill_rect(18, 11, 4, 3, 10)  # red eye
    # legs
    for x in (6, 12, 18, 24):
        c.fill_rect(x, 26, 4, 5, 5)
    c.fill_poly([(2, 16), (0, 8), (6, 16)], 2)  # tail/hump
    return finish(c)

@D
def draw_cresgarurumon():
    c = new()
    # white wolf knight, gold armor, crescent blade
    c.fill_rect(10, 24, 5, 7, 12); c.fill_rect(18, 24, 5, 7, 12)
    c.shade_ellipse(16, 18, 7, 7, 2, 4, 3)
    c.fill_rect(13, 16, 7, 5, 10)  # gold chest
    c.shade_ellipse(16, 9, 6, 6, 2, 4, 3)
    c.fill_poly([(10, 3), (14, 9), (11, 10)], 2)
    c.fill_poly([(22, 3), (18, 9), (21, 10)], 2)
    c.eye(13, 8, iris=11)
    c.eye(18, 8, iris=11)
    # crescent blade
    c.fill_poly([(26, 6), (31, 16), (24, 14), (27, 10)], 10)
    c.fill_rect(23, 14, 3, 8, 12)
    c.pset(16, 16, 11)  # red gem
    return finish(c)

# ---- Ver.3 ----
@D
def draw_poyomon():
    c = new()
    c.shade_ellipse(16, 18, 9, 9, 2, 4, 4)
    # translucent bubble look: inner shine
    c.fill_ellipse(13, 14, 3, 3, 9)
    eyes_pair(c, 11, 17, 6)
    c.fill_ellipse(16, 22, 3, 2, 11)
    return finish(c)

@D
def draw_tokomon():
    c = new()
    blob(c, 16, 18, 9, 8, 2, 4, 3)
    # big toothy mouth
    c.fill_rect(10, 18, 13, 5, 7)
    for x in range(11, 22, 2):
        c.pset(x, 18, 7)
        c.pset(x, 18, 8) if False else None
        c.fill_rect(x, 18, 1, 2, 8)
    eyes_pair(c, 11, 13, 6)
    # stubby legs
    c.fill_rect(10, 26, 3, 4, 2); c.fill_rect(19, 26, 3, 4, 2)
    return finish(c)

@D
def draw_patamon():
    c = new()
    # huge ears / wings
    c.fill_ellipse(6, 14, 6, 8, 2)
    c.fill_ellipse(26, 14, 6, 8, 2)
    c.fill_ellipse(6, 14, 3, 4, 5)
    c.fill_ellipse(26, 14, 3, 4, 5)
    c.shade_ellipse(16, 18, 7, 8, 2, 4, 3)
    c.fill_ellipse(16, 20, 4, 4, 5)
    c.shade_ellipse(16, 11, 6, 5, 2, 4, 3)
    eyes_pair(c, 12, 10, 5)
    c.fill_rect(14, 14, 4, 1, 8)
    feet(c, 11, 17, 28)
    return finish(c)

@D
def draw_kunemon():
    c = new()
    c.shade_ellipse(16, 20, 11, 7, 2, 4, 3)
    c.shade_ellipse(20, 12, 6, 6, 2, 4, 3)
    # black stripes
    for x in (8, 12, 16, 22):
        c.fill_rect(x, 18, 2, 6, 8)
    c.eye(18, 10, iris=10)
    c.fill_rect(24, 13, 4, 1, 8)
    c.fill_rect(6, 26, 4, 4, 2); c.fill_rect(20, 26, 4, 4, 2)
    return finish(c)

@D
def draw_unimon():
    c = new()
    c.shade_ellipse(14, 22, 8, 6, 2, 4, 3)
    c.shade_ellipse(22, 14, 6, 6, 2, 4, 3)
    # horn
    c.fill_poly([(22, 2), (24, 12), (20, 11)], 10)
    # mane
    c.fill_poly([(16, 8), (14, 16), (18, 14)], 11)
    # wing
    c.fill_ellipse(8, 14, 6, 5, 7)
    c.eye(20, 13, iris=8)
    for x in (8, 14, 20, 24):
        c.fill_rect(x, 26, 3, 5, 3)
    return finish(c)

@D
def draw_centalmon():
    c = new()
    # horse body
    c.shade_ellipse(12, 22, 9, 6, 2, 4, 3)
    # humanoid torso armor
    c.fill_rect(18, 10, 7, 12, 12)
    c.shade_ellipse(21, 7, 4, 4, 5, 4, 6)
    c.fill_rect(24, 12, 6, 3, 13)  # gun
    c.eye(20, 6, iris=8)
    for x in (5, 10, 16, 22):
        c.fill_rect(x, 27, 3, 4, 3)
    return finish(c)

@D
def draw_ogremon():
    c = new()
    c.fill_rect(10, 24, 5, 6, 2); c.fill_rect(18, 24, 5, 6, 2)
    c.shade_ellipse(16, 20, 8, 7, 2, 4, 3)
    c.shade_ellipse(16, 10, 8, 7, 2, 4, 3)
    # orange mane
    c.fill_poly([(6, 8), (16, 1), (26, 8), (16, 10)], 10)
    c.eye(11, 10, iris=8); c.eye(18, 10, iris=8)
    c.fill_rect(13, 14, 6, 2, 8)
    # bone club
    c.fill_rect(2, 14, 4, 12, 5)
    c.fill_circle(4, 12, 3, 7)
    c.fill_rect(5, 18, 5, 5, 2); c.fill_rect(22, 18, 5, 5, 2)
    return finish(c)

@D
def draw_bakemon():
    c = new()
    c.shade_ellipse(16, 16, 10, 12, 2, 4, 3)
    # ragged bottom
    for x, h in ((8, 3), (12, 5), (16, 2), (20, 5), (24, 3)):
        c.fill_rect(x, 27, 3, h, 2)
    # black face void
    c.fill_ellipse(16, 16, 6, 5, 8)
    c.pset(12, 15, 7); c.pset(19, 15, 7)
    c.fill_rect(13, 18, 6, 1, 10)
    return finish(c)

@D
def draw_shellmon():
    c = new()
    # shell
    c.shade_ellipse(20, 16, 10, 10, 10, 11, 3)
    c.fill_ellipse(20, 16, 5, 5, 11)
    # pink soft body
    c.shade_ellipse(10, 20, 7, 7, 2, 4, 3)
    c.eye(8, 17, iris=8); c.eye(13, 17, iris=8)
    c.fill_rect(9, 21, 4, 1, 8)
    c.fill_rect(6, 26, 4, 4, 2)
    return finish(c)

@D
def draw_drimogemon():
    c = new()
    c.shade_ellipse(16, 20, 9, 8, 2, 4, 3)
    c.shade_ellipse(16, 12, 7, 6, 2, 4, 3)
    # silver drill
    c.fill_poly([(16, 1), (20, 12), (12, 12)], 12)
    c.fill_poly([(16, 2), (17, 11), (15, 11)], 13)
    eyes_pair(c, 11, 12, 6)
    c.fill_rect(6, 20, 4, 5, 2); c.fill_rect(22, 20, 4, 5, 2)
    feet(c, 10, 18, 28)
    return finish(c)

@D
def draw_sukamon():
    c = new()
    c.shade_ellipse(16, 20, 10, 9, 2, 4, 3)
    c.shade_ellipse(16, 12, 7, 5, 2, 4, 3)
    eyes_pair(c, 11, 12, 6)
    c.fill_rect(13, 16, 6, 1, 8)
    c.pset(12, 15, 8); c.pset(19, 15, 8)
    # flies
    c.pset(6, 8, 8); c.pset(7, 9, 8); c.pset(24, 6, 8); c.pset(25, 7, 8)
    return finish(c)

@D
def draw_andromon():
    c = new()
    c.fill_rect(11, 22, 4, 8, 12); c.fill_rect(18, 22, 4, 8, 12)
    c.fill_rect(10, 12, 13, 12, 12)
    c.fill_rect(13, 14, 7, 6, 10)  # yellow visor/chest
    c.shade_ellipse(16, 7, 6, 6, 12, 4, 13)
    c.fill_rect(12, 7, 9, 2, 10)
    c.fill_rect(5, 14, 5, 8, 12); c.fill_rect(22, 14, 5, 8, 12)
    return finish(c)

@D
def draw_giromon():
    c = new()
    c.shade_ellipse(16, 16, 10, 10, 2, 4, 3)
    # spikes
    for ang, p in enumerate([(16, 3), (26, 7), (29, 16), (26, 25), (16, 29), (6, 25), (3, 16), (6, 7)]):
        c.fill_circle(p[0], p[1], 2, 10)
    c.eye(11, 14, iris=8); c.eye(19, 14, iris=8)
    c.fill_rect(13, 19, 7, 2, 8)
    return finish(c)

@D
def draw_etemon():
    c = new()
    c.fill_rect(11, 24, 4, 6, 2); c.fill_rect(18, 24, 4, 6, 2)
    c.shade_ellipse(16, 18, 7, 7, 2, 4, 3)
    c.shade_ellipse(16, 9, 6, 6, 2, 4, 3)
    # sunglasses
    c.fill_rect(11, 9, 11, 3, 8)
    c.pset(13, 10, 7); c.pset(19, 10, 7)
    # pink shirt / gold chain
    c.fill_rect(12, 16, 9, 6, 10)
    c.fill_rect(13, 15, 7, 1, 11)
    # mic
    c.fill_rect(25, 14, 2, 10, 12)
    c.fill_circle(26, 12, 2, 13)
    return finish(c)

@D
def draw_hiandromon():
    c = new()
    c.fill_rect(10, 22, 5, 8, 12); c.fill_rect(18, 22, 5, 8, 12)
    c.fill_rect(9, 12, 15, 12, 12)
    c.fill_rect(12, 14, 9, 6, 10)  # gold
    c.shade_ellipse(16, 6, 7, 6, 12, 4, 13)
    c.fill_rect(11, 6, 11, 3, 14)  # blue visor
    c.fill_rect(3, 12, 6, 9, 10); c.fill_rect(23, 12, 6, 9, 10)
    return finish(c)

@D
def draw_kingetemon():
    c = new()
    # cape
    c.fill_poly([(6, 12), (16, 10), (26, 12), (28, 28), (4, 28)], 10)
    c.fill_rect(11, 24, 4, 6, 2); c.fill_rect(18, 24, 4, 6, 2)
    c.shade_ellipse(16, 16, 6, 6, 2, 4, 3)
    c.shade_ellipse(16, 8, 6, 5, 2, 4, 3)
    c.fill_rect(11, 8, 11, 3, 8)
    # crown
    c.fill_rect(11, 2, 11, 4, 11)
    c.pset(11, 1, 11); c.pset(16, 0, 11); c.pset(21, 1, 11)
    return finish(c)

print("part2", len(SPRITES))

# ---- Ver.4 ----
@D
def draw_yuramon():
    c = new()
    blob(c, 16, 18, 9, 9, 2, 4, 3)
    # spikes
    for p in ((16, 6), (8, 10), (24, 10), (6, 18), (26, 18), (10, 8), (22, 8)):
        c.fill_circle(p[0], p[1], 2, 10)
    eyes_pair(c, 11, 17, 6)
    return finish(c)

@D
def draw_tanemon():
    c = new()
    blob(c, 16, 22, 8, 7, 2, 4, 3)
    # sprout
    c.fill_rect(16, 8, 2, 8, 10)
    c.fill_ellipse(12, 8, 4, 3, 10)
    c.fill_ellipse(22, 8, 4, 3, 11)
    eyes_pair(c, 12, 20, 5)
    c.fill_rect(11, 28, 3, 3, 3); c.fill_rect(19, 28, 3, 3, 3)
    return finish(c)

@D
def draw_piyomon():
    c = new()
    c.shade_ellipse(16, 20, 7, 7, 2, 4, 3)
    c.shade_ellipse(16, 12, 6, 6, 2, 4, 3)
    c.fill_poly([(14, 6), (16, 1), (20, 7)], 10)  # crest
    c.fill_ellipse(16, 14, 3, 2, 11)  # beak
    c.fill_poly([(6, 16), (12, 14), (10, 22)], 2)
    c.fill_poly([(26, 16), (20, 14), (22, 22)], 2)
    eyes_pair(c, 12, 10, 5)
    c.fill_rect(13, 26, 3, 5, 11); c.fill_rect(17, 26, 3, 5, 11)
    return finish(c)

@D
def draw_palmon():
    c = new()
    c.shade_ellipse(16, 20, 6, 8, 2, 4, 3)
    c.fill_ellipse(16, 21, 3, 4, 5)
    # leafy hair
    c.fill_ellipse(16, 8, 7, 6, 10)
    c.fill_ellipse(10, 10, 4, 4, 11)
    c.fill_ellipse(22, 10, 4, 4, 11)
    c.shade_ellipse(16, 14, 5, 4, 2, 4, 3)
    eyes_pair(c, 12, 13, 5)
    # purple claws
    c.fill_rect(7, 20, 3, 6, 14); c.fill_rect(22, 20, 3, 6, 14)
    feet(c, 11, 17, 28)
    return finish(c)

@D
def draw_monochromon():
    c = new()
    c.shade_ellipse(16, 20, 12, 8, 2, 4, 3)
    c.fill_ellipse(16, 22, 7, 5, 5)
    c.shade_ellipse(22, 14, 7, 6, 2, 4, 3)
    # white horn
    c.fill_poly([(22, 3), (26, 13), (20, 12)], 7)
    c.eye(20, 13, iris=8)
    # back plates
    c.fill_rect(8, 14, 4, 3, 10); c.fill_rect(13, 12, 4, 3, 10)
    for x in (6, 12, 18, 24):
        c.fill_rect(x, 27, 4, 4, 3)
    return finish(c)

@D
def draw_cockatrimon():
    c = new()
    c.shade_ellipse(16, 20, 7, 7, 2, 4, 3)
    c.shade_ellipse(16, 11, 6, 6, 2, 4, 3)
    # red comb
    c.fill_poly([(12, 6), (16, 1), (20, 6), (16, 8)], 10)
    c.fill_ellipse(16, 13, 2, 3, 11)
    c.fill_poly([(4, 12), (14, 14), (8, 22)], 14)
    c.fill_poly([(28, 12), (18, 14), (24, 22)], 14)
    eyes_pair(c, 12, 10, 5)
    c.fill_rect(13, 26, 3, 5, 11); c.fill_rect(17, 26, 3, 5, 11)
    return finish(c)

@D
def draw_leomon():
    c = new()
    c.fill_rect(10, 24, 5, 6, 2); c.fill_rect(18, 24, 5, 6, 2)
    c.shade_ellipse(16, 19, 7, 7, 2, 4, 3)
    c.fill_ellipse(16, 20, 4, 4, 5)
    # mane
    c.fill_circle(16, 10, 8, 7)
    c.fill_circle(16, 10, 6, 2)
    c.shade_ellipse(16, 11, 5, 5, 2, 4, 3)
    eyes_pair(c, 12, 10, 5)
    # sword
    c.fill_rect(3, 8, 2, 16, 12)
    c.fill_rect(1, 22, 6, 3, 5)
    c.fill_rect(6, 18, 4, 5, 2); c.fill_rect(22, 18, 4, 5, 2)
    return finish(c)

@D
def draw_kuwagamon():
    c = new()
    c.shade_ellipse(16, 20, 9, 8, 2, 4, 3)
    # huge pincers
    c.fill_poly([(2, 6), (14, 14), (8, 16), (1, 12)], 10)
    c.fill_poly([(30, 6), (18, 14), (24, 16), (31, 12)], 10)
    c.fill_rect(10, 12, 4, 3, 8); c.fill_rect(19, 12, 4, 3, 8)
    for x in (6, 12, 18, 24):
        c.fill_rect(x, 27, 3, 4, 3)
    return finish(c)

@D
def draw_coelamon():
    c = new()
    c.shade_ellipse(16, 18, 11, 7, 2, 4, 3)
    c.fill_ellipse(16, 19, 6, 4, 5)
    # red fins
    c.fill_poly([(16, 6), (20, 14), (12, 14)], 10)
    c.fill_poly([(4, 14), (8, 18), (4, 22)], 10)
    c.fill_poly([(28, 14), (24, 18), (28, 22)], 10)
    # helmet head
    c.shade_ellipse(24, 14, 5, 5, 12, 4, 13)
    c.eye(24, 13, iris=8)
    c.fill_ellipse(6, 20, 4, 3, 2)
    return finish(c)

@D
def draw_mojyamon():
    c = new()
    # shaggy white yeti
    c.shade_ellipse(16, 18, 10, 10, 2, 4, 3)
    for p in ((8, 10), (24, 10), (8, 20), (24, 20), (16, 8), (6, 16), (26, 16)):
        c.fill_circle(p[0], p[1], 3, 2)
    c.fill_ellipse(16, 16, 4, 4, 11)  # pink face
    eyes_pair(c, 12, 14, 5)
    c.fill_rect(7, 24, 4, 4, 10); c.fill_rect(21, 24, 4, 4, 10)
    return finish(c)

@D
def draw_nanimon():
    c = new()
    # punching bag
    c.shade_ellipse(16, 16, 9, 12, 2, 4, 3)
    c.fill_rect(14, 2, 5, 4, 12)
    c.eye(11, 12, iris=8); c.eye(18, 12, iris=8)
    c.fill_rect(13, 17, 7, 3, 8)
    c.fill_circle(6, 20, 4, 10)
    c.fill_circle(26, 20, 4, 10)
    return finish(c)

@D
def draw_megadramon():
    c = new()
    c.fill_rect(8, 22, 7, 8, 12); c.fill_rect(18, 22, 7, 8, 12)
    c.shade_ellipse(16, 16, 10, 8, 2, 4, 3)
    c.shade_ellipse(20, 8, 7, 6, 2, 4, 3)
    c.fill_rect(18, 7, 8, 2, 10)  # red eyes/visor
    # wing / cannon
    c.fill_poly([(2, 8), (14, 12), (6, 18)], 13)
    c.fill_rect(1, 10, 6, 4, 12)
    c.fill_poly([(30, 10), (24, 14), (30, 20)], 2)
    return finish(c)

@D
def draw_piccolomon():
    c = new()
    # tiny fairy, leave space
    c.fill_ellipse(10, 16, 4, 5, 10)  # leaf wing
    c.fill_ellipse(22, 16, 4, 5, 10)
    c.shade_ellipse(16, 18, 4, 6, 2, 4, 3)
    c.shade_ellipse(16, 12, 4, 4, 2, 4, 3)
    c.fill_poly([(16, 6), (18, 11), (14, 11)], 10)
    eyes_pair(c, 13, 11, 3)
    c.fill_rect(24, 10, 2, 12, 11)  # staff
    c.fill_circle(25, 8, 2, 14)
    return finish(c)

@D
def draw_digitamamon():
    c = new()
    c.shade_ellipse(16, 18, 11, 11, 2, 4, 3)
    # belt
    c.fill_rect(6, 18, 21, 4, 10)
    c.fill_rect(14, 17, 5, 6, 11)
    c.eye(10, 14, iris=7); c.eye(20, 14, iris=7)
    c.fill_rect(13, 16, 7, 1, 10)
    return finish(c)

@D
def draw_aegisdramon():
    c = new()
    # blue mechanical sea dragon, gold shield
    c.shade_ellipse(16, 18, 9, 8, 2, 4, 3)
    c.shade_ellipse(20, 10, 7, 6, 2, 4, 3)
    c.fill_ellipse(16, 20, 5, 4, 5)
    # gold aegis
    c.fill_ellipse(8, 16, 6, 8, 10)
    c.fill_ellipse(8, 16, 3, 4, 11)
    c.fill_rect(18, 9, 8, 2, 11)
    c.eye(18, 9, iris=11)
    c.fill_poly([(2, 24), (8, 28), (12, 24)], 2)
    c.fill_rect(18, 26, 5, 5, 12)
    return finish(c)

@D
def draw_titamon():
    c = new()
    c.fill_rect(9, 24, 6, 7, 2); c.fill_rect(18, 24, 6, 7, 2)
    c.shade_ellipse(16, 18, 9, 8, 2, 4, 3)
    c.shade_ellipse(16, 8, 8, 7, 2, 4, 3)
    # skulls on shoulders
    c.fill_circle(6, 14, 4, 5); c.fill_circle(26, 14, 4, 5)
    c.pset(5, 13, 8); c.pset(7, 13, 8); c.pset(25, 13, 8); c.pset(27, 13, 8)
    # horns
    c.fill_poly([(8, 2), (12, 8), (9, 9)], 8)
    c.fill_poly([(24, 2), (20, 8), (23, 9)], 8)
    c.eye(12, 8, iris=10); c.eye(18, 8, iris=10)
    return finish(c)

# ---- Ver.5 ----
@D
def draw_zurumon():
    c = new()
    blob(c, 16, 20, 9, 8, 2, 4, 3)
    # angry blobs / pustules
    c.fill_circle(8, 14, 3, 10)
    c.fill_circle(24, 16, 3, 10)
    c.eye(11, 18, iris=10); c.eye(18, 18, iris=10)
    c.fill_rect(13, 23, 6, 2, 8)
    return finish(c)

@D
def draw_pagumon():
    c = new()
    # large ears
    c.fill_ellipse(7, 12, 6, 8, 2)
    c.fill_ellipse(25, 12, 6, 8, 2)
    c.fill_ellipse(7, 12, 3, 4, 11)
    c.fill_ellipse(25, 12, 3, 4, 11)
    blob(c, 16, 20, 7, 7, 2, 4, 3)
    eyes_pair(c, 12, 17, 5, iris=10)
    feet(c, 11, 17, 27)
    return finish(c)

@D
def draw_gazimon():
    c = new()
    c.fill_rect(10, 24, 5, 6, 2); c.fill_rect(18, 24, 5, 6, 2)
    c.shade_ellipse(16, 20, 7, 6, 2, 4, 3)
    c.shade_ellipse(16, 12, 6, 6, 2, 4, 3)
    # yellow tufts / ears
    c.fill_poly([(8, 4), (12, 12), (7, 12)], 10)
    c.fill_poly([(24, 4), (20, 12), (25, 12)], 10)
    eyes_pair(c, 12, 11, 5, iris=11)
    c.fill_rect(6, 18, 4, 5, 2); c.fill_rect(22, 18, 4, 5, 2)
    c.pset(6, 23, 11); c.pset(8, 23, 11); c.pset(22, 23, 11); c.pset(24, 23, 11)
    return finish(c)

@D
def draw_gizamon():
    c = new()
    c.shade_ellipse(16, 20, 9, 7, 2, 4, 3)
    c.fill_ellipse(16, 22, 5, 3, 5)
    c.shade_ellipse(16, 12, 7, 6, 2, 4, 3)
    c.fill_poly([(16, 3), (19, 11), (13, 11)], 10)  # fin
    eyes_pair(c, 11, 11, 6, iris=10)
    c.fill_rect(6, 20, 4, 5, 2); c.fill_rect(22, 20, 4, 5, 2)
    feet(c, 10, 18, 27)
    return finish(c)

@D
def draw_darktyranomon():
    c = new()
    c.fill_rect(10, 23, 5, 7, 2); c.fill_rect(18, 23, 5, 7, 2)
    c.shade_ellipse(16, 20, 8, 7, 2, 4, 3)
    c.shade_ellipse(17, 11, 8, 7, 2, 4, 3)
    # red stripes / eyes
    c.fill_rect(12, 18, 2, 4, 10); c.fill_rect(19, 18, 2, 4, 10)
    c.eye(14, 9, iris=10); c.eye(19, 9, iris=10)
    c.fill_rect(18, 13, 6, 1, 8)
    c.fill_poly([(5, 22), (1, 18), (8, 20)], 3)
    c.fill_rect(8, 17, 3, 4, 2); c.fill_rect(22, 17, 3, 4, 2)
    return finish(c)

@D
def draw_cyclomon():
    c = new()
    c.fill_rect(10, 24, 5, 6, 2); c.fill_rect(18, 24, 5, 6, 2)
    c.shade_ellipse(16, 20, 8, 7, 2, 4, 3)
    c.shade_ellipse(16, 10, 8, 7, 2, 4, 3)
    # one horn, one eye
    c.fill_poly([(16, 1), (19, 10), (13, 10)], 10)
    c.fill_ellipse(16, 11, 3, 3, 7)
    c.pset(16, 11, 11)
    c.fill_rect(13, 15, 7, 1, 8)
    c.fill_rect(6, 18, 4, 5, 2); c.fill_rect(22, 18, 5, 6, 2)  # bigger right arm
    return finish(c)

@D
def draw_devidramon():
    c = new()
    c.fill_poly([(1, 8), (14, 12), (6, 20)], 10)
    c.fill_poly([(31, 8), (18, 12), (26, 20)], 10)
    c.shade_ellipse(16, 18, 7, 8, 2, 4, 3)
    c.shade_ellipse(16, 8, 6, 6, 2, 4, 3)
    c.fill_poly([(10, 2), (16, 0), (22, 2), (16, 6)], 8)
    c.eye(12, 8, iris=11); c.eye(18, 8, iris=11)
    c.fill_rect(11, 25, 4, 6, 2); c.fill_rect(18, 25, 4, 6, 2)
    return finish(c)

@D
def draw_tuskmon():
    c = new()
    c.fill_rect(10, 24, 5, 6, 2); c.fill_rect(18, 24, 5, 6, 2)
    c.shade_ellipse(16, 20, 8, 7, 2, 4, 3)
    c.shade_ellipse(18, 12, 8, 7, 2, 4, 3)
    # huge tusks
    c.fill_poly([(16, 16), (8, 28), (14, 16)], 7)
    c.fill_poly([(22, 16), (28, 28), (24, 16)], 7)
    c.eye(16, 10, iris=10); c.eye(21, 10, iris=10)
    return finish(c)

@D
def draw_flymon():
    c = new()
    # wings
    c.fill_ellipse(8, 10, 7, 5, 7)
    c.fill_ellipse(24, 10, 7, 5, 7)
    c.shade_ellipse(16, 18, 7, 8, 2, 4, 3)
    # yellow-black stripes
    c.fill_rect(10, 16, 13, 2, 8)
    c.fill_rect(10, 21, 13, 2, 8)
    c.shade_ellipse(16, 10, 5, 4, 2, 4, 3)
    eyes_pair(c, 12, 9, 5, iris=10)
    c.fill_rect(15, 26, 3, 5, 8)
    return finish(c)

@D
def draw_deltamon():
    c = new()
    # three heads
    for cx, cy in ((8, 12), (16, 8), (24, 12)):
        c.shade_ellipse(cx, cy, 5, 5, 2, 4, 3)
        c.eye(cx - 1, cy, iris=10)
    c.shade_ellipse(16, 20, 9, 7, 2, 4, 3)
    c.fill_rect(10, 26, 4, 5, 2); c.fill_rect(19, 26, 4, 5, 2)
    c.fill_poly([(2, 18), (8, 22), (6, 16)], 2)
    return finish(c)

@D
def draw_raremon():
    c = new()
    # melting flesh
    c.shade_ellipse(16, 16, 11, 9, 2, 4, 3)
    for x, h in ((6, 8), (11, 12), (16, 6), (21, 11), (26, 7)):
        c.fill_rect(x, 22, 4, h, 2)
        c.pset(x + 1, 22 + h, 10)
    c.eye(10, 12, iris=10); c.eye(20, 12, iris=10)
    c.fill_ellipse(16, 18, 4, 3, 11)
    return finish(c)

@D
def draw_metaltyranomon():
    c = new()
    c.fill_rect(8, 22, 7, 8, 12); c.fill_rect(18, 22, 7, 8, 12)
    c.shade_ellipse(16, 18, 10, 7, 12, 4, 13)
    c.shade_ellipse(18, 9, 8, 6, 12, 4, 13)
    c.fill_rect(14, 8, 10, 2, 10)  # visor
    c.fill_rect(3, 14, 6, 5, 13)
    c.fill_rect(24, 14, 6, 5, 13)
    c.fill_poly([(4, 22), (0, 16), (8, 18)], 13)
    return finish(c)

@D
def draw_nanomon():
    c = new()
    # cube computer (Datamon)
    c.fill_rect(8, 8, 16, 16, 2)
    c.fill_rect(9, 9, 14, 14, 10)
    c.fill_rect(11, 11, 10, 8, 8)
    c.fill_ellipse(16, 15, 3, 3, 11)  # eye
    c.pset(16, 15, 7)
    # cables
    c.thick_line(8, 20, 4, 28, 13, 1)
    c.thick_line(24, 20, 28, 28, 13, 1)
    c.fill_rect(10, 24, 12, 4, 12)
    return finish(c)

@D
def draw_extyranomon():
    c = new()
    c.fill_rect(10, 24, 5, 6, 2); c.fill_rect(18, 24, 5, 6, 2)
    c.shade_ellipse(16, 20, 8, 7, 2, 4, 3)
    c.shade_ellipse(16, 11, 7, 6, 2, 4, 3)
    # stitches
    c.fill_rect(12, 12, 9, 1, 8)
    c.pset(14, 11, 8); c.pset(16, 13, 8); c.pset(18, 11, 8)
    eyes_pair(c, 12, 9, 5)
    c.fill_rect(7, 18, 4, 5, 5); c.fill_rect(21, 18, 4, 5, 5)
    return finish(c)

@D
def draw_mugendramon():
    c = new()
    # massive machine dragon
    c.fill_rect(6, 20, 9, 10, 12); c.fill_rect(18, 20, 9, 10, 12)
    c.shade_ellipse(16, 16, 12, 8, 12, 4, 13)
    c.shade_ellipse(20, 8, 8, 6, 12, 4, 13)
    c.fill_rect(16, 7, 12, 3, 10)  # red visor
    # cannons
    c.fill_rect(0, 12, 8, 6, 13)
    c.fill_rect(1, 14, 3, 2, 10)
    c.fill_poly([(2, 8), (12, 12), (6, 16)], 13)
    return finish(c)

@D
def draw_pinochimon():
    c = new()
    c.fill_rect(11, 24, 4, 6, 2); c.fill_rect(18, 24, 4, 6, 2)
    c.fill_rect(12, 24, 8, 3, 10)  # red shorts
    c.shade_ellipse(16, 18, 6, 7, 2, 4, 3)
    c.shade_ellipse(16, 10, 5, 5, 2, 4, 3)
    # leaf hair
    c.fill_ellipse(16, 6, 6, 4, 11)
    # long nose
    c.fill_rect(16, 12, 8, 2, 2)
    eyes_pair(c, 12, 9, 4)
    c.fill_rect(6, 16, 3, 6, 2); c.fill_rect(23, 16, 3, 6, 2)
    return finish(c)

# ---- jogress / special ----
@D
def draw_omegamon_alters():
    c = new()
    c.fill_rect(10, 24, 5, 7, 12); c.fill_rect(18, 24, 5, 7, 12)
    c.fill_rect(11, 12, 11, 13, 7)
    # red and gold cannons (Blitz + Cres)
    c.fill_rect(1, 10, 9, 8, 2)
    c.fill_rect(2, 12, 6, 4, 10)
    c.fill_rect(22, 10, 9, 8, 12)
    c.fill_rect(24, 12, 6, 4, 11)
    c.shade_ellipse(16, 8, 5, 6, 7, 4, 5)
    c.fill_rect(13, 7, 7, 2, 8)
    return finish(c)

@D
def draw_lasttyranomon():
    c = new()
    c.fill_rect(8, 22, 7, 8, 2); c.fill_rect(18, 22, 7, 8, 2)
    c.shade_ellipse(16, 18, 10, 8, 2, 4, 3)
    c.fill_ellipse(16, 19, 5, 4, 10)
    c.shade_ellipse(18, 9, 8, 7, 2, 4, 3)
    c.fill_rect(14, 8, 10, 2, 11)
    c.fill_poly([(8, 2), (14, 8), (10, 9)], 11)
    c.fill_poly([(28, 2), (22, 8), (26, 9)], 11)
    c.fill_rect(1, 14, 7, 5, 12)
    return finish(c)

@D
def draw_metalgreymon_va():
    c = new()
    c.fill_rect(8, 22, 7, 8, 12); c.fill_rect(18, 22, 7, 8, 12)
    c.shade_ellipse(16, 18, 10, 7, 12, 4, 13)
    # orange organic (vaccine)
    c.shade_ellipse(16, 11, 8, 6, 2, 4, 3)
    c.fill_rect(11, 14, 11, 4, 12)
    c.fill_rect(12, 16, 9, 1, 8)
    c.fill_rect(14, 4, 2, 6, 10); c.fill_rect(17, 3, 2, 7, 10)
    c.eye(11, 10, iris=14); c.eye(18, 10, iris=14)
    c.fill_rect(2, 16, 7, 5, 12)
    return finish(c)

@D
def draw_weregarurumon():
    c = new()
    c.fill_rect(10, 24, 5, 6, 5); c.fill_rect(18, 24, 5, 6, 5)
    c.shade_ellipse(16, 18, 7, 8, 5, 4, 6)
    c.shade_ellipse(16, 9, 6, 6, 5, 4, 6)
    c.fill_poly([(10, 2), (14, 8), (10, 9)], 7)
    c.fill_poly([(22, 2), (18, 8), (22, 9)], 7)
    # white mane
    c.fill_poly([(16, 4), (12, 12), (20, 12)], 7)
    c.eye(12, 8, iris=11); c.eye(18, 8, iris=11)
    c.fill_rect(6, 16, 4, 6, 5); c.fill_rect(22, 16, 4, 6, 5)
    c.pset(6, 22, 7); c.pset(8, 22, 7); c.pset(22, 22, 7); c.pset(24, 22, 7)
    return finish(c)

@D
def draw_wargreymon():
    c = new()
    c.fill_rect(10, 24, 5, 6, 2); c.fill_rect(18, 24, 5, 6, 2)
    c.shade_ellipse(16, 18, 7, 7, 2, 4, 3)
    c.fill_ellipse(16, 19, 4, 4, 5)
    # gold helmet / Dramon Destroyers
    c.shade_ellipse(16, 9, 6, 6, 12, 4, 13)
    c.fill_rect(2, 8, 8, 6, 10)
    c.fill_rect(22, 8, 8, 6, 10)
    c.fill_poly([(16, 2), (18, 8), (14, 8)], 11)  # crest
    c.fill_rect(12, 8, 9, 2, 14)  # green eyes?
    c.pset(14, 8, 14); c.pset(18, 8, 14)
    return finish(c)

@D
def draw_metalgarurumon():
    c = new()
    c.shade_ellipse(16, 22, 10, 6, 12, 4, 13)
    c.shade_ellipse(22, 14, 7, 6, 12, 4, 13)
    c.fill_poly([(18, 5), (21, 12), (17, 12)], 12)
    c.fill_poly([(26, 5), (27, 12), (23, 12)], 12)
    c.fill_rect(20, 12, 6, 2, 10)
    c.eye(20, 12, iris=11)
    c.fill_rect(26, 15, 5, 3, 10)  # muzzle cannon
    for x in (8, 13, 18, 23):
        c.fill_rect(x, 27, 3, 4, 13)
    c.fill_rect(2, 18, 6, 4, 13)
    return finish(c)

@D
def draw_omegamon():
    c = new()
    c.fill_rect(10, 24, 5, 7, 12); c.fill_rect(18, 24, 5, 7, 12)
    c.fill_rect(11, 12, 11, 13, 7)
    c.fill_rect(13, 14, 7, 6, 10)  # gold belt/chest
    # Grey (orange-red) and Garuru (blue) cannons
    c.fill_rect(0, 10, 10, 8, 2)
    c.fill_rect(2, 12, 6, 4, 14)
    c.fill_rect(22, 10, 10, 8, 15)
    c.fill_rect(24, 12, 6, 4, 11)
    c.shade_ellipse(16, 8, 5, 6, 7, 4, 5)
    c.fill_rect(13, 7, 7, 2, 8)
    return finish(c)

print("draw fns", len(SPRITES))

# Official-inspired palettes (body, shadow, highlight, belly, belly_sh, acc, acc2, metal, metal_sh, extra, extra2)
PAL = {
    "egg_v1": pal((240, 228, 190), (200, 170, 120), (255, 250, 230), acc=(196, 88, 32)),
    "egg_v2": pal((240, 228, 190), (200, 170, 120), (255, 250, 230), acc=(50, 100, 180)),
    "egg_v3": pal((240, 228, 190), (200, 170, 120), (255, 250, 230), acc=(140, 80, 180)),
    "egg_v4": pal((240, 228, 190), (200, 170, 120), (255, 250, 230), acc=(48, 150, 70)),
    "egg_v5": pal((240, 228, 190), (200, 170, 120), (255, 250, 230), acc=(80, 80, 90)),
    "botamon": pal((24, 22, 28), (12, 10, 14), (60, 55, 65), acc=(240, 180, 40), acc2=(230, 100, 140)),
    "koromon": pal((240, 150, 170), (190, 90, 120), (255, 200, 210), acc=(200, 40, 50), acc2=(230, 80, 110)),
    "agumon": pal((236, 150, 40), (180, 90, 20), (255, 200, 90), (245, 220, 160), (210, 170, 110), acc=(40, 140, 60), metal=(200, 200, 210)),
    "betamon": pal((80, 190, 70), (40, 120, 40), (150, 230, 120), (230, 220, 150), acc=(240, 210, 50), acc2=(220, 120, 40)),
    "greymon": pal((232, 140, 40), (170, 80, 20), (255, 190, 80), (240, 220, 170), acc=(120, 70, 36), acc2=(160, 100, 50), extra=(40, 130, 60)),
    "tyranomon": pal((200, 48, 40), (130, 24, 24), (230, 100, 80), (240, 210, 170), acc=(80, 30, 30)),
    "devimon": pal((28, 28, 50), (12, 12, 24), (60, 60, 90), acc=(60, 80, 160), acc2=(200, 40, 40)),
    "meramon": pal((40, 24, 20), (16, 10, 8), (80, 50, 30), acc=(255, 90, 20), acc2=(255, 210, 40)),
    "airdramon": pal((70, 150, 210), (30, 80, 140), (150, 200, 240), (245, 245, 250), acc=(240, 200, 50), acc2=(200, 40, 40)),
    "seadramon": pal((40, 150, 160), (20, 90, 100), (100, 210, 200), (240, 210, 80), acc=(200, 40, 40), acc2=(180, 40, 40)),
    "numemon": pal((170, 110, 110), (110, 60, 70), (210, 160, 160), acc=(200, 30, 40), acc2=(180, 70, 90), extra=(160, 210, 200)),
    "metalgreymon": pal((140, 70, 40), (90, 40, 20), (180, 110, 70), acc=(40, 80, 160), acc2=(200, 40, 40), metal=(80, 120, 180), metal_sh=(30, 50, 90)),
    "mamemon": pal((160, 165, 175), (90, 95, 105), (220, 225, 230), acc=(255, 80, 30)),
    "monzaemon": pal((240, 200, 50), (180, 140, 20), (255, 230, 120), acc=(210, 40, 50), acc2=(230, 140, 150)),
    "blitzgreymon": pal((180, 30, 36), (100, 16, 20), (230, 80, 70), acc=(240, 200, 40), acc2=(255, 230, 80)),
    "banchomamemon": pal((40, 36, 40), (16, 14, 16), (80, 70, 70), acc=(240, 200, 60), acc2=(220, 170, 40), extra=(160, 100, 50)),
    "punimon": pal((230, 80, 90), (160, 40, 50), (255, 140, 150), acc2=(200, 50, 70)),
    "tsunomon": pal((240, 210, 120), (190, 150, 70), (255, 240, 180), acc=(120, 70, 30), acc2=(160, 100, 50)),
    "gabumon": pal((240, 200, 60), (180, 140, 30), (255, 230, 120), (120, 140, 170), (70, 80, 110), acc=(200, 40, 40)),
    "elecmon": pal((220, 70, 80), (150, 30, 40), (255, 130, 140), acc=(240, 200, 50)),
    "kabuterimon": pal((40, 80, 170), (20, 40, 110), (80, 130, 210), acc=(200, 30, 40)),
    "garurumon": pal((230, 235, 240), (160, 170, 190), (255, 255, 255), acc=(40, 80, 170), acc2=(40, 80, 180)),
    "angemon": pal((240, 230, 210), (190, 170, 140), (255, 250, 240), (245, 240, 230), acc=(220, 180, 50), extra=(50, 90, 180)),
    "yukidarumon": pal((240, 245, 250), (180, 190, 200), (255, 255, 255), acc=(70, 130, 200), extra=(180, 230, 250)),
    "birdramon": pal((220, 60, 30), (140, 30, 16), (255, 130, 50), acc=(255, 180, 40), acc2=(255, 200, 60)),
    "whamon": pal((50, 110, 190), (24, 60, 120), (110, 170, 230), (230, 220, 190), acc=(200, 40, 40)),
    "vegimon": pal((80, 170, 50), (40, 100, 30), (140, 210, 90), acc=(40, 130, 40), acc2=(50, 150, 50), extra=(180, 40, 40)),
    "skullgreymon": pal((50, 48, 52), (24, 22, 24), (80, 78, 82), (230, 225, 210), (180, 170, 150), acc=(200, 30, 30)),
    "metalmamemon": pal((180, 185, 195), (100, 105, 115), (230, 235, 240), acc=(255, 80, 30)),
    "vademon": pal((150, 155, 150), (90, 95, 90), (200, 205, 195), acc=(40, 80, 40)),
    "skullmammon": pal((120, 90, 70), (70, 50, 40), (170, 140, 110), (230, 220, 200), acc=(200, 30, 30)),
    "cresgarurumon": pal((240, 245, 250), (170, 180, 200), (255, 255, 255), acc=(220, 180, 50), acc2=(180, 30, 40)),
    "poyomon": pal((170, 220, 240), (100, 160, 190), (230, 250, 255), acc2=(230, 80, 120)),
    "tokomon": pal((245, 240, 230), (200, 180, 160), (255, 255, 250)),
    "patamon": pal((230, 170, 80), (180, 110, 40), (255, 210, 140), (245, 220, 170)),
    "kunemon": pal((200, 210, 60), (130, 140, 30), (230, 240, 120), acc=(200, 30, 40)),
    "unimon": pal((240, 240, 245), (180, 180, 190), (255, 255, 255), acc=(220, 190, 80), acc2=(200, 80, 80)),
    "centalmon": pal((170, 120, 70), (110, 70, 40), (210, 170, 120), (230, 200, 160)),
    "ogremon": pal((70, 150, 50), (30, 90, 30), (130, 200, 90), acc=(220, 100, 30)),
    "bakemon": pal((240, 240, 245), (180, 180, 190), (255, 255, 255), acc=(180, 30, 40)),
    "shellmon": pal((240, 150, 170), (180, 90, 110), (255, 200, 210), acc=(150, 90, 180), acc2=(180, 120, 200)),
    "drimogemon": pal((180, 110, 50), (120, 60, 30), (220, 160, 90)),
    "sukamon": pal((180, 150, 50), (120, 90, 30), (220, 190, 90)),
    "andromon": pal((160, 165, 175), (90, 95, 105), (220, 225, 230), acc=(230, 200, 50)),
    "giromon": pal((180, 80, 160), (110, 40, 100), (230, 140, 200), acc=(220, 200, 80)),
    "etemon": pal((140, 80, 40), (90, 45, 20), (190, 130, 80), acc=(230, 100, 150), acc2=(220, 180, 50)),
    "hiandromon": pal((170, 175, 185), (90, 95, 110), (230, 235, 240), acc=(220, 180, 50), extra=(40, 90, 180)),
    "kingetemon": pal((140, 80, 40), (90, 45, 20), (190, 130, 80), acc=(180, 30, 40), acc2=(230, 190, 50)),
    "yuramon": pal((180, 110, 190), (120, 60, 140), (230, 170, 230), acc=(140, 70, 160)),
    "tanemon": pal((170, 220, 120), (100, 150, 70), (210, 240, 170), acc=(50, 150, 60), acc2=(80, 180, 70)),
    "piyomon": pal((240, 130, 150), (180, 70, 90), (255, 190, 200), acc=(220, 40, 50), acc2=(240, 180, 40)),
    "palmon": pal((240, 170, 170), (180, 100, 110), (255, 210, 210), (245, 220, 190), acc=(50, 160, 60), acc2=(80, 190, 80), extra=(140, 60, 180)),
    "monochromon": pal((230, 160, 40), (170, 100, 20), (255, 210, 90), (240, 220, 170), acc=(140, 80, 30)),
    "cockatrimon": pal((80, 160, 60), (40, 100, 30), (140, 210, 100), acc=(200, 30, 40), acc2=(230, 180, 40), extra=(200, 200, 80)),
    "leomon": pal((220, 140, 50), (160, 80, 20), (250, 190, 100), (245, 230, 200)),
    "kuwagamon": pal((180, 30, 30), (110, 16, 16), (230, 80, 70), acc=(140, 20, 20)),
    "coelamon": pal((200, 205, 210), (130, 140, 150), (240, 245, 250), acc=(200, 40, 40)),
    "mojyamon": pal((240, 245, 250), (180, 190, 200), (255, 255, 255), acc=(200, 40, 40), acc2=(240, 160, 170)),
    "nanimon": pal((230, 200, 50), (170, 140, 20), (255, 230, 100), acc=(200, 40, 40)),
    "megadramon": pal((70, 60, 90), (30, 24, 45), (120, 110, 140), acc=(200, 30, 40)),
    "piccolomon": pal((80, 170, 70), (40, 110, 40), (140, 210, 120), acc=(50, 140, 50), acc2=(180, 140, 50), extra=(200, 40, 60)),
    "digitamamon": pal((24, 22, 26), (8, 8, 10), (60, 55, 65), acc=(200, 30, 40), acc2=(230, 190, 40)),
    "aegisdramon": pal((40, 100, 180), (20, 50, 110), (90, 160, 230), (220, 230, 240), acc=(220, 180, 50), acc2=(240, 210, 80)),
    "titamon": pal((90, 100, 70), (45, 50, 35), (140, 150, 110), (230, 220, 200), acc=(180, 30, 30)),
    "zurumon": pal((120, 50, 150), (70, 24, 90), (170, 90, 200), acc=(180, 40, 80)),
    "pagumon": pal((140, 130, 160), (80, 70, 100), (190, 180, 210), acc=(180, 40, 50), acc2=(180, 140, 190)),
    "gazimon": pal((50, 36, 60), (24, 16, 30), (90, 70, 100), acc=(230, 200, 50), acc2=(200, 40, 40)),
    "gizamon": pal((90, 120, 140), (50, 70, 85), (140, 170, 190), (200, 210, 200), acc=(200, 40, 40)),
    "darktyranomon": pal((40, 30, 45), (16, 12, 20), (80, 60, 90), acc=(200, 30, 40)),
    "cyclomon": pal((110, 120, 140), (60, 70, 85), (160, 170, 190), acc=(180, 150, 60), acc2=(200, 40, 40)),
    "devidramon": pal((80, 20, 30), (40, 8, 12), (130, 40, 50), acc=(40, 16, 20), acc2=(200, 30, 40)),
    "tuskmon": pal((70, 140, 60), (35, 80, 30), (120, 190, 100), acc=(200, 30, 40)),
    "flymon": pal((230, 200, 50), (170, 140, 20), (255, 230, 100), acc=(200, 30, 40)),
    "deltamon": pal((50, 30, 60), (24, 12, 30), (90, 60, 110), acc=(200, 30, 40)),
    "raremon": pal((160, 170, 80), (90, 100, 40), (200, 210, 120), acc=(200, 40, 60), acc2=(200, 100, 140)),
    "metaltyranomon": pal((60, 65, 75), (30, 32, 40), (110, 120, 130), acc=(200, 40, 40)),
    "nanomon": pal((180, 100, 40), (120, 60, 20), (220, 150, 80), acc=(220, 140, 50), acc2=(40, 180, 80)),
    "extyranomon": pal((230, 180, 180), (180, 120, 130), (255, 220, 220), (245, 210, 200)),
    "mugendramon": pal((70, 75, 85), (30, 32, 40), (120, 130, 140), acc=(200, 30, 40)),
    "pinochimon": pal((180, 120, 60), (120, 70, 30), (220, 170, 110), acc=(180, 30, 40), acc2=(60, 150, 50)),
    "omegamon_alters": pal((180, 30, 36), (100, 16, 20), (230, 80, 70), acc=(220, 180, 50), acc2=(200, 40, 40)),
    "lasttyranomon": pal((200, 40, 40), (120, 16, 16), (240, 90, 80), acc=(220, 180, 50), acc2=(240, 210, 80)),
    "metalgreymon_va": pal((236, 140, 40), (180, 80, 20), (255, 190, 80), acc=(40, 140, 60), acc2=(40, 130, 60), extra=(40, 140, 60)),
    "weregarurumon": pal((90, 120, 170), (50, 70, 110), (140, 170, 210), (230, 235, 240), acc=(200, 40, 50)),
    "wargreymon": pal((232, 140, 40), (170, 80, 20), (255, 190, 80), (240, 220, 170), acc=(220, 180, 50), acc2=(240, 200, 60), extra=(40, 160, 70)),
    "metalgarurumon": pal((80, 140, 200), (40, 70, 120), (140, 190, 240), acc=(230, 200, 50), acc2=(200, 40, 40)),
    "omegamon": pal((236, 140, 40), (180, 80, 20), (255, 190, 80), acc=(220, 180, 50), acc2=(50, 110, 190), extra=(200, 60, 40), extra2=(50, 110, 190)),
}

# UI icons 16x16 color pixel art
def icon_canvas(draw_fn):
    c = Canvas(16, 16)
    draw_fn(c)
    c.outline(1)
    return c

def draw_icons():
    icons = {}
    def I(name, pal_, fn):
        c = Canvas(16, 16)
        fn(c)
        c.outline(1)
        icons[name] = (pal_, c)
    food_pal = pal((200, 60, 40), (120, 30, 20), (240, 120, 80), acc=(240, 200, 80))
    I("food", food_pal, lambda c: (c.shade_ellipse(8, 9, 6, 5, 2, 4, 3), c.fill_rect(7, 3, 2, 4, 10)))
    prot_pal = pal((80, 140, 200), (40, 70, 120), (140, 190, 240), acc=(230, 220, 80))
    I("protein", prot_pal, lambda c: (c.fill_rect(5, 3, 6, 11, 2), c.fill_rect(6, 4, 4, 2, 10), c.fill_rect(6, 8, 4, 4, 4)))
    train_pal = pal((180, 80, 30), (110, 40, 16), (230, 140, 70), acc=(200, 200, 210))
    I("train", train_pal, lambda c: (c.fill_rect(3, 11, 10, 3, 12), c.fill_poly([(8, 2), (12, 11), (4, 11)], 2)))
    bat_pal = pal((200, 40, 40), (110, 16, 16), (240, 90, 80), acc=(240, 200, 50))
    I("battle", bat_pal, lambda c: (c.fill_poly([(3, 3), (8, 8), (3, 13)], 2), c.fill_poly([(13, 3), (8, 8), (13, 13)], 10)))
    st_pal = pal((50, 90, 160), (24, 40, 90), (100, 140, 210), acc=(230, 200, 50))
    I("status", st_pal, lambda c: (c.fill_rect(3, 3, 10, 11, 2), c.fill_rect(5, 5, 6, 1, 10), c.fill_rect(5, 8, 6, 1, 7), c.fill_rect(5, 11, 4, 1, 7)))
    fl_pal = pal((80, 160, 200), (40, 90, 120), (140, 210, 240), acc=(180, 110, 70))
    I("flush", fl_pal, lambda c: (c.fill_ellipse(8, 8, 5, 4, 2), c.fill_rect(11, 3, 2, 6, 12), c.fill_circle(8, 11, 2, 10)))
    li_pal = pal((240, 200, 50), (180, 130, 20), (255, 240, 140), acc=(40, 40, 60))
    I("lights", li_pal, lambda c: (c.fill_circle(8, 7, 4, 2), c.fill_rect(7, 11, 2, 3, 12), c.pset(3, 7, 4), c.pset(13, 7, 4), c.pset(8, 2, 4)))
    med_pal = pal((230, 230, 240), (160, 160, 180), (255, 255, 255), acc=(200, 40, 40))
    I("medicine", med_pal, lambda c: (c.fill_rect(6, 3, 4, 11, 2), c.fill_rect(3, 6, 10, 4, 2), c.fill_rect(7, 4, 2, 9, 10), c.fill_rect(4, 7, 8, 2, 10)))
    set_pal = pal((140, 145, 155), (80, 85, 95), (200, 205, 215), acc=(80, 180, 200))
    I("settings", set_pal, lambda c: (c.fill_circle(8, 8, 6, 2), c.fill_circle(8, 8, 2, 10)))
    call_pal = pal((220, 50, 50), (140, 20, 20), (255, 120, 100))
    I("call", call_pal, lambda c: (c.fill_circle(8, 8, 6, 2), c.fill_rect(7, 4, 2, 5, 7), c.fill_rect(7, 11, 2, 2, 7)))
    poop_pal = pal((140, 90, 40), (90, 50, 20), (180, 130, 70))
    I("poop", poop_pal, lambda c: (c.fill_ellipse(8, 11, 5, 3, 2), c.fill_ellipse(8, 8, 3, 3, 2), c.fill_circle(8, 5, 2, 2)))
    heart_pal = pal((200, 40, 50), (120, 16, 20), (255, 110, 120))
    I("heart", heart_pal, lambda c: (c.fill_circle(5, 6, 3, 2), c.fill_circle(10, 6, 3, 2), c.fill_poly([(2, 7), (8, 14), (14, 7)], 2)))
    I("heart_empty", pal((80, 70, 70), (40, 35, 35), (140, 130, 130)), lambda c: (c.fill_circle(5, 6, 3, 2), c.fill_circle(10, 6, 3, 2), c.fill_poly([(2, 7), (8, 14), (14, 7)], 2)))
    save_pal = pal((50, 140, 90), (24, 80, 50), (90, 200, 130), acc=(230, 220, 80))
    I("save", save_pal, lambda c: (c.fill_rect(3, 3, 10, 11, 2), c.fill_rect(5, 3, 6, 5, 10), c.fill_rect(5, 10, 6, 3, 7)))
    inst_pal = pal((60, 100, 180), (30, 50, 110), (120, 160, 230), acc=(240, 220, 80))
    I("install", inst_pal, lambda c: (c.fill_rect(4, 10, 8, 4, 2), c.fill_poly([(8, 2), (12, 8), (4, 8)], 10), c.fill_rect(7, 7, 2, 5, 10)))
    return icons


def render_sprite(name):
    fn = SPRITES.get(name) or SPRITES.get(name.replace("-", "_"))
    if not fn:
        raise KeyError(name)
    p = PAL.get(name)
    if p is None:
        raise KeyError("palette " + name)
    c0 = fn()
    c1 = idle2(c0)
    return p, c0, c1


def export_js(all_data, path):
    digits = "0123456789abcdefghijklmnopqrstuv"
    lines = [
        "/** Hand-authored 32x32 color pixel art. Palettes + indexed rows. Not official bitmap dumps. */",
        "(function (root) {",
        "  'use strict';",
        "  var SPRITES = {",
    ]
    for name, (pal_, frames) in all_data.items():
        hexpal = []
        for i, col in enumerate(pal_):
            if i == 0 or col is None:
                hexpal.append("#00000000")
            else:
                hexpal.append("#%02x%02x%02x" % col[:3])
        lines.append(f"    {name}: {{ w: 32, h: 32, pal: {hexpal!r}, frames: {{")
        for fname, canvas in frames.items():
            rows = []
            for y in range(canvas.h):
                rows.append("".join(digits[canvas.px[y][x]] for x in range(canvas.w)))
            lines.append(f"      {fname}: {rows!r},")
        lines.append("    } },")
    lines.append("  };")
    lines.append("  function decodeIndex(ch) { var d='0123456789abcdefghijklmnopqrstuv'; return d.indexOf(ch); }")
    lines.append("  function renderToImageData(sprite, frame, scale) {")
    lines.append("    scale = scale || 1;")
    lines.append("    var rows = sprite.frames[frame] || sprite.frames.idle0;")
    lines.append("    var w = sprite.w, h = sprite.h;")
    lines.append("    var cw = document.createElement('canvas'); cw.width = w; cw.height = h;")
    lines.append("    var ctx = cw.getContext('2d');")
    lines.append("    var img = ctx.createImageData(w, h);")
    lines.append("    var pal = sprite.pal;")
    lines.append("    for (var y=0;y<h;y++){ for(var x=0;x<w;x++){")
    lines.append("      var i = decodeIndex(rows[y][x]);")
    lines.append("      var hex = pal[i] || '#00000000';")
    lines.append("      var p = (y*w+x)*4;")
    lines.append("      if (!hex || hex.length < 7 || hex === '#00000000') { img.data[p+3]=0; continue; }")
    lines.append("      img.data[p]=parseInt(hex.slice(1,3),16);")
    lines.append("      img.data[p+1]=parseInt(hex.slice(3,5),16);")
    lines.append("      img.data[p+2]=parseInt(hex.slice(5,7),16);")
    lines.append("      img.data[p+3]=255;")
    lines.append("    } }")
    lines.append("    ctx.putImageData(img,0,0);")
    lines.append("    if (scale===1) return cw;")
    lines.append("    var out=document.createElement('canvas'); out.width=w*scale; out.height=h*scale;")
    lines.append("    var octx=out.getContext('2d'); octx.imageSmoothingEnabled=false;")
    lines.append("    octx.drawImage(cw,0,0,out.width,out.height);")
    lines.append("    return out;")
    lines.append("  }")
    lines.append("  var api={ SPRITES:SPRITES, renderToImageData:renderToImageData, decodeIndex:decodeIndex };")
    lines.append("  if (typeof module!=='undefined' && module.exports) module.exports=api;")
    lines.append("  root.SpriteAtlas=api;")
    lines.append("})(typeof globalThis!=='undefined'?globalThis:this);")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def contact_sheet(all_data, monsters_meta, path):
    # group by version then stage
    stage_order = ["egg", "baby1", "baby2", "rookie", "champion", "ultimate", "mega", "super"]
    items = []
    for name, (pal_, frames) in all_data.items():
        if name in ("food",) or name.startswith("icon_"):
            continue
        meta = monsters_meta.get(name, {})
        items.append((meta.get("version", 99), stage_order.index(meta.get("stage", "mega")) if meta.get("stage") in stage_order else 99, name, pal_, frames))
    items.sort(key=lambda t: (str(t[0]), t[1], t[2]))
    scale = 3
    cell = 32 * scale + 8
    label_h = 28
    cols = 8
    rows = (len(items) + cols - 1) // cols
    pad = 16
    header = 56
    W = pad * 2 + cols * cell
    H = header + pad + rows * (cell + label_h) + pad
    im = Image.new("RGBA", (W, H), (24, 26, 32, 255))
    dr = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc", 14)
        font_s = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc", 11)
        font_t = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc", 20)
    except Exception:
        font = font_s = font_t = ImageFont.load_default()
    title = "數碼怪獸對打機  —  手繪 32×32 彩色點陣（供校對）"
    dr.text((pad, 14), title, fill=(240, 230, 200, 255), font=font_t)
    dr.text((pad, 36), "Hand-authored color pixel art for review. Not official sprite dumps.", fill=(160, 170, 180, 255), font=font_s)
    for i, (ver, st, name, pal_, frames) in enumerate(items):
        r, c = divmod(i, cols)
        x = pad + c * cell
        y = header + pad + r * (cell + label_h)
        sprite = canvas_to_rgba(frames["idle0"], pal_).resize((32 * scale, 32 * scale), Image.Resampling.NEAREST)
        # cell bg
        dr.rectangle([x, y, x + 32 * scale + 4, y + 32 * scale + 4], fill=(18, 20, 26, 255))
        im.alpha_composite(sprite, (x + 2, y + 2))
        meta = monsters_meta.get(name, {})
        zh = meta.get("nameZh", name)
        en = meta.get("nameEn", "")
        dr.text((x, y + 32 * scale + 6), zh, fill=(230, 220, 200, 255), font=font_s)
        dr.text((x, y + 32 * scale + 16), en, fill=(140, 150, 160, 255), font=font_s)
    im.convert("RGB").save(path, "PNG", optimize=True)
    print("contact sheet", path, im.size)


def load_monster_meta():
    # parse loosely from evolution-data.js
    import re, json
    text = (ROOT / "js" / "evolution-data.js").read_text(encoding="utf-8")
    meta = {}
    # nameZh / nameEn / stage / version near id
    for m in re.finditer(r"    ([a-z0-9_]+): \{ id: \"([^\"]+)\", version: ([^ ,]+), stage: \"([^\"]+)\", nameZh: \"([^\"]+)\", nameEn: \"([^\"]+)\"", text):
        meta[m.group(1)] = {"id": m.group(2), "version": m.group(3).strip("'\""), "stage": m.group(4), "nameZh": m.group(5), "nameEn": m.group(6)}
    return meta


def draw_app_icon(size=64):
    """Original device-themed pixel-art icon (not a Bandai logo copy)."""
    # draw at 64 then scale
    from PIL import ImageDraw
    im = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = im.load()
    def box(x, y, w, h, col):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < 64 and 0 <= yy < 64:
                    px[xx, yy] = col
    navy = (28, 48, 72, 255)
    navy2 = (18, 32, 50, 255)
    teal = (40, 90, 110, 255)
    hi = (70, 120, 140, 255)
    screen_bg = (40, 90, 80, 255)
    orange = (236, 150, 40, 255)
    cream = (245, 220, 160, 255)
    dark = (28, 20, 18, 255)
    btn = (200, 80, 70, 255)
    gold = (220, 180, 60, 255)
    # body
    box(8, 6, 48, 52, navy)
    box(10, 8, 44, 48, teal)
    box(10, 8, 44, 3, hi)
    # screen bezel
    box(14, 12, 36, 28, navy2)
    box(16, 14, 32, 24, screen_bg)
    # tiny monster on screen (agumon-like, original pixels)
    box(26, 26, 12, 8, orange)
    box(28, 20, 10, 8, orange)
    box(30, 24, 6, 3, cream)
    box(28, 22, 2, 2, (40, 140, 60, 255))
    box(36, 22, 2, 2, (40, 140, 60, 255))
    box(24, 28, 4, 4, orange)
    box(38, 28, 4, 4, orange)
    box(26, 32, 5, 3, orange)
    box(35, 32, 5, 3, orange)
    # outline-ish dark around screen
    # buttons
    box(22, 44, 8, 8, btn)
    box(36, 44, 8, 8, gold)
    box(22, 44, 8, 2, (240, 140, 130, 255))
    # scale
    return im.resize((size, size), Image.Resampling.NEAREST)


def make_maskable(base: Image.Image, size: int) -> Image.Image:
    # Safe zone: center 80% (actually maskable safe is ~80% diameter / 40% padding each side? 
    # Spec: important content in central 80% (10% pad each side).
    # Extra padding for safety: content in central 70%.
    out = Image.new("RGBA", (size, size), (28, 48, 72, 255))
    inner = int(size * 0.70)
    icon = base.resize((inner, inner), Image.Resampling.NEAREST)
    xy = ((size - inner) // 2, (size - inner) // 2)
    out.alpha_composite(icon, xy)
    return out


def make_splash(path, w, h):
    im = Image.new("RGB", (w, h), (18, 32, 50))
    icon = draw_app_icon(256)
    x = (w - 256) // 2
    y = (h - 256) // 2 - 20
    im.paste(icon, (x, y), icon)
    dr = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc", 36)
    except Exception:
        font = ImageFont.load_default()
    text = "數碼怪獸對打機"
    # center text
    bbox = dr.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    dr.text(((w - tw) // 2, y + 270), text, fill=(230, 220, 180), font=font)
    im.save(path, "PNG", optimize=True)


def export_icons():
    icon_dir = ROOT / "icons"
    icon_dir.mkdir(exist_ok=True)
    src64 = draw_app_icon(64)
    for size in (192, 512):
        im = src64.resize((size, size), Image.Resampling.NEAREST)
        im.save(icon_dir / f"icon-{size}.png", "PNG")
        make_maskable(src64, size).save(icon_dir / f"icon-{size}-maskable.png", "PNG")
    src64.resize((180, 180), Image.Resampling.NEAREST).save(icon_dir / "apple-touch-icon.png", "PNG")
    # favicon 32
    src64.resize((32, 32), Image.Resampling.NEAREST).save(icon_dir / "favicon.png", "PNG")
    make_splash(icon_dir / "splash-1290x2796.png", 1290, 2796)  # portrait iPhone fallback
    make_splash(icon_dir / "splash-1280x800.png", 1280, 800)  # landscape
    print("icons written")


def main():
    meta = load_monster_meta()
    missing = []
    all_data = {}
    for name in sorted(SPRITES.keys()):
        if name not in PAL:
            missing.append(("pal", name))
            continue
        try:
            pal_, c0, c1 = render_sprite(name)
        except Exception as e:
            missing.append((name, str(e)))
            continue
        all_data[name] = (pal_, {"idle0": c0, "idle1": c1})
    # expected ids
    expected = set(meta.keys())
    got = set(all_data.keys())
    if expected - got:
        print("MISSING SPRITES", expected - got)
    if got - expected:
        print("EXTRA SPRITES", got - expected)
    if missing:
        print("ERRORS", missing)
        raise SystemExit(1)
    icons = draw_icons()
    icon_payload = {}
    for iname, (ipal, icanvas) in icons.items():
        icon_payload["icon_" + iname] = (ipal, {"idle0": icanvas, "idle1": icanvas})
    export_js({**all_data, **icon_payload}, ROOT / "js" / "sprites.js")
    contact_sheet(all_data, meta, ROOT / "sprites-sheet.png")
    export_icons()
    print("sprites", len(all_data), "icons", len(icon_payload), "ok")


if __name__ == "__main__":
    main()
