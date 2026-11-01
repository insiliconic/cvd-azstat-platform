"""Builds the site's raster brand assets from the logo mark in
frontend/favicon.svg (a white heartbeat line that turns into a rising trend,
ending in a dot, on a rounded blue square):

  frontend/apple-touch-icon.png   180 x 180, full-bleed blue (iOS rounds it)
  frontend/og-image.png           1200 x 630 link-preview card
  frontend/logo-light.png         mark + wordmark for light backgrounds (transparent)
  frontend/logo-dark.png          mark + wordmark for dark backgrounds (transparent)

The mark's geometry (MARK_POINTS, END_DOT, STROKE) mirrors favicon.svg; the
mobile app icons use the same geometry (app/scripts/make-icons.mjs).

Run from the repo root:  python scripts/make_site_assets.py
Needs Pillow and the Inter font (falls back to DejaVu Sans if Inter is missing).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BLUE = (42, 120, 214)        # #2a78d6, the site's --series-1
LIGHT_BLUE = (111, 177, 240)  # #6fb1f0, the dark-mode accent
INK = (11, 11, 11)
NEAR_WHITE = (244, 244, 242)
NIGHT = (13, 13, 13)
WHITE = (255, 255, 255)
SOFT_WHITE = (214, 230, 250)

# Mark geometry on a 100 x 100 grid (same numbers as frontend/favicon.svg).
MARK_POINTS = [(15, 58), (31, 58), (38, 46), (46, 72), (56, 27), (63, 56), (73, 44), (83, 32)]
END_DOT = (83, 32, 7.4)      # x, y, radius
STROKE = 7.5
CORNER = 22                  # rounded-square radius on the 100 grid

OUT = Path(__file__).resolve().parent.parent / "frontend"
SS = 4  # supersampling factor for smooth edges


def font(size, bold=True, medium=False):
    inter = "/usr/share/fonts/opentype/inter/Inter-{}.otf"
    dejavu = "/usr/share/fonts/truetype/dejavu/DejaVuSans{}.ttf"
    name = "Bold" if bold else ("Medium" if medium else "Regular")
    for path in (inter.format(name), dejavu.format("-Bold" if bold else "")):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_mark(draw, x0, y0, size, color):
    """Draw the line + end dot inside the square slice (x0, y0, size)."""
    k = size / 100
    pts = [(x0 + px * k, y0 + py * k) for px, py in MARK_POINTS]
    width = round(STROKE * k)
    draw.line(pts, fill=color, width=width, joint="curve")
    r = width / 2  # round caps at both ends and round joins
    for px, py in pts:
        draw.ellipse([px - r, py - r, px + r, py + r], fill=color)
    ex, ey, er = END_DOT
    ex, ey, er = x0 + ex * k, y0 + ey * k, er * k
    draw.ellipse([ex - er, ey - er, ex + er, ey + er], fill=color)


def mark_tile(size, bg, fg, rounded=True):
    """RGBA square with the mark on a (rounded) background."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=CORNER / 100 * s, fill=bg)
    else:
        d.rectangle([0, 0, s, s], fill=bg)
    draw_mark(d, 0, 0, s, fg)
    return img


def apple_touch_icon():
    mark_tile(180, BLUE, WHITE, rounded=False).resize((180, 180), Image.LANCZOS).convert("RGB").save(
        OUT / "apple-touch-icon.png", optimize=True)


def og_image():
    w, h = 1200 * SS, 630 * SS
    img = Image.new("RGB", (w, h), BLUE)
    draw = ImageDraw.Draw(img)
    # The mark's blue-on-white tile sits on the left (white tile, blue line), wordmark and taglines right.
    tile = 280 * SS
    tile_img = mark_tile(280, WHITE, BLUE)
    img.paste(tile_img, (96 * SS, (h - tile) // 2), tile_img)
    x = 450 * SS
    name, room = "Cardiostatistics", (1200 - 60) * SS - x
    size = 112 * SS
    while size > 40 * SS and draw.textlength(name, font=font(size)) > room:
        size -= SS
    draw.text((x, 215 * SS), name, font=font(size), fill=WHITE)
    draw.text((x, 345 * SS), "Ürək-damar xəstəlikləri", font=font(46 * SS, bold=False), fill=WHITE)
    draw.text((x, 405 * SS), "Azərbaycan statistikası", font=font(46 * SS, bold=False), fill=WHITE)
    draw.text((x, 480 * SS), "Cardiovascular disease statistics · Azerbaijan", font=font(30 * SS, bold=False), fill=SOFT_WHITE)
    img.resize((1200, 630), Image.LANCZOS).save(OUT / "og-image.png", optimize=True)


def lockup(path, tile_bg, tile_fg, word1, word2):
    """Mark + two-tone wordmark on a transparent background, 1000 x 240 px."""
    h, tile = 240 * SS, 200 * SS
    f1, f2 = font(112 * SS), font(112 * SS, bold=False, medium=True)
    probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    gap, pad = 36 * SS, 20 * SS
    w1, w2 = probe.textlength("Cardio", font=f1), probe.textlength("statistics", font=f2)
    w = int(pad + tile + gap + w1 + w2 + pad)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    tile_img = mark_tile(200, tile_bg, tile_fg)
    img.paste(tile_img, (pad, (h - tile) // 2), tile_img)
    d = ImageDraw.Draw(img)
    ty = (h - 112 * SS) // 2 - 14 * SS
    d.text((pad + tile + gap, ty), "Cardio", font=f1, fill=word1)
    d.text((pad + tile + gap + w1, ty), "statistics", font=f2, fill=word2)
    img.resize((w // SS, h // SS), Image.LANCZOS).save(path, optimize=True)


def logos():
    lockup(OUT / "logo-light.png", BLUE, WHITE, INK, BLUE)
    lockup(OUT / "logo-dark.png", LIGHT_BLUE, NIGHT, NEAR_WHITE, LIGHT_BLUE)


if __name__ == "__main__":
    apple_touch_icon()
    og_image()
    logos()
    print("wrote apple-touch-icon.png, og-image.png, logo-light.png, logo-dark.png in", OUT)
