# -*- coding: utf-8 -*-
"""Tiny 32x32 pixel canvas with auto-outline for a consistent sprite style."""
from __future__ import annotations

class Canvas:
    def __init__(self, w=32, h=32):
        self.w = w
        self.h = h
        self.px = [[0] * w for _ in range(h)]

    def inside(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def pset(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if c and self.inside(x, y):
            self.px[y][x] = c

    def pget(self, x, y):
        x, y = int(round(x)), int(round(y))
        if not self.inside(x, y):
            return 0
        return self.px[y][x]

    def fill_rect(self, x, y, w, h, c):
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                self.pset(xx, yy, c)

    def fill_circle(self, cx, cy, r, c):
        self.fill_ellipse(cx, cy, r, r, c)

    def fill_ellipse(self, cx, cy, rx, ry, c):
        rx, ry = max(0.5, rx), max(0.5, ry)
        minx, maxx = int(cx - rx - 1), int(cx + rx + 1)
        miny, maxy = int(cy - ry - 1), int(cy + ry + 1)
        for y in range(miny, maxy + 1):
            for x in range(minx, maxx + 1):
                dx = (x + 0.5 - cx) / rx
                dy = (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1.0:
                    self.pset(x, y, c)

    def fill_poly(self, pts, c):
        if len(pts) < 3:
            return
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        miny, maxy = int(min(ys)), int(max(ys))
        for y in range(miny, maxy + 1):
            inter = []
            for i in range(len(pts)):
                x1, y1 = pts[i]
                x2, y2 = pts[(i + 1) % len(pts)]
                if y1 == y2:
                    continue
                if (y1 <= y < y2) or (y2 <= y < y1):
                    t = (y - y1) / (y2 - y1)
                    inter.append(x1 + t * (x2 - x1))
            inter.sort()
            for i in range(0, len(inter), 2):
                if i + 1 < len(inter):
                    a, b = inter[i], inter[i + 1]
                    for x in range(int(round(a)), int(round(b)) + 1):
                        self.pset(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        dx, dy = abs(x1 - x0), abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy
        while True:
            self.pset(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x0 += sx
            if e2 < dx:
                err += dx
                y0 += sy

    def thick_line(self, x0, y0, x1, y1, c, r=1):
        x0, y0, x1, y1 = float(x0), float(y0), float(x1), float(y1)
        steps = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(steps + 1):
            t = i / steps
            self.fill_circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c)

    def shade_ellipse(self, cx, cy, rx, ry, base, hi, sh):
        """Filled ellipse with simple upper-left highlight and lower-right shadow."""
        self.fill_ellipse(cx, cy, rx, ry, base)
        self.fill_ellipse(cx - rx * 0.25, cy - ry * 0.3, rx * 0.55, ry * 0.5, hi)
        # punch highlight only inside? already inside. Add shadow crescent.
        rx, ry = max(0.5, rx), max(0.5, ry)
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                dx = (x + 0.5 - cx) / rx
                dy = (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1.0 and (dx + dy) > 0.75:
                    if self.pget(x, y) in (base, hi):
                        self.pset(x, y, sh)

    def eye(self, x, y, oc=None, iris=None, shine=True):
        """Tiny consistent eye: white, dark pupil, optional shine."""
        # oc unused; iris is pupil color (default dark)
        iris = iris or 8
        self.pset(x, y, 7)  # white
        self.pset(x + 1, y, 7)
        self.pset(x, y + 1, 7)
        self.pset(x + 1, y + 1, iris)
        if shine:
            self.pset(x, y, 9)  # shine

    def outline(self, color=1):
        """1px outline around any non-zero, non-outline pixel."""
        marks = []
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x] not in (0, color):
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        nx, ny = x + dx, y + dy
                        if self.inside(nx, ny) and self.px[ny][nx] == 0:
                            marks.append((nx, ny))
                        elif not self.inside(nx, ny):
                            pass
        for x, y in marks:
            self.px[y][x] = color

    def shift(self, dx, dy, fill=0):
        src = [row[:] for row in self.px]
        self.px = [[fill] * self.w for _ in range(self.h)]
        for y in range(self.h):
            for x in range(self.w):
                c = src[y][x]
                if c:
                    self.pset(x + dx, y + dy, c)

    def clone(self):
        o = Canvas(self.w, self.h)
        o.px = [row[:] for row in self.px]
        return o

    def rows(self):
        return [row[:] for row in self.px]


# Palette index convention used by all monsters for consistency:
# 0 transparent
# 1 outline (dark)
# 2 body main
# 3 body shadow
# 4 body highlight
# 5 secondary / belly / cloth
# 6 secondary shadow
# 7 white / tooth / eye white
# 8 dark (pupil, claws, pattern)
# 9 shine / pale
# 10 accent A (crest, fire, cloth)
# 11 accent B
# 12 metal / grey
# 13 metal shadow
# 14 unique extra
# 15 unique extra 2

OUTLINE = (28, 20, 18)


def rgba(rgb, a=255):
    if rgb is None:
        return (0, 0, 0, 0)
    if len(rgb) == 4:
        return rgb
    return (rgb[0], rgb[1], rgb[2], a)


def canvas_to_rgba(canvas, pal):
    """pal is list of RGB or RGBA, index 0 = transparent."""
    from PIL import Image
    im = Image.new("RGBA", (canvas.w, canvas.h), (0, 0, 0, 0))
    pix = im.load()
    for y in range(canvas.h):
        for x in range(canvas.w):
            i = canvas.px[y][x]
            if i and i < len(pal):
                pix[x, y] = rgba(pal[i])
    return im


def compact(canvas, pal):
    """Return {pal: [#hex...], rows: [str,...]} using 0-9a-v digits."""
    digits = "0123456789abcdefghijklmnopqrstuv"
    hexpal = []
    for i, c in enumerate(pal):
        if i == 0 or c is None:
            hexpal.append("#00000000")
        else:
            r, g, b = c[:3]
            hexpal.append(f"#{r:02x}{g:02x}{b:02x}")
    rows = []
    for y in range(canvas.h):
        s = []
        for x in range(canvas.w):
            i = canvas.px[y][x]
            s.append(digits[i] if i < len(digits) else "0")
        rows.append("".join(s))
    return hexpal, rows
