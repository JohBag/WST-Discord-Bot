# Draws the role icons for the sign-up post (blue shield, green cross, steel sword with a red hilt)
# into assets/role-icons/. Bold shapes with a dark outline, so they read at Discord's 22px emoji size,
# shaded like WoW's ready check marks that sit next to them. Drawn at 512px, saved at 128px.
#
# Needs Python with Pillow: python scripts/role-icons.py
# The bot uploads an icon once by name, so a redrawn icon needs a new name in emoji.ts (markIcons).
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 512
OUT_SIZE = 128
OUTLINE = 34  # at 512px, about 1.5px at 22px
MARGIN = OUTLINE + 24  # room for the outline and the shadow
assert MARGIN > OUTLINE, 'dilate() wraps around the edges, so shapes must stay further in than the outline'

BLUE = ((110, 170, 255), (30, 80, 200))
GREEN = ((120, 240, 110), (25, 150, 40))
RED = ((255, 110, 90), (190, 25, 20))
STEEL = ((245, 248, 255), (150, 160, 180))


def bezier(p0, p1, p2, n=40):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))]


def to_px(points):
    k = S - 2 * MARGIN
    return [(MARGIN + x * k, MARGIN + y * k) for x, y in points]


def shield_mask():
    left = [(0.10, 0.10), (0.10, 0.48)] + bezier((0.10, 0.48), (0.12, 0.80), (0.50, 0.97))[1:]
    right = [(1 - x, y) for x, y in reversed(left)]
    top = bezier((0.90, 0.10), (0.50, 0.00), (0.10, 0.10))[1:-1]
    im = Image.new('L', (S, S), 0)
    ImageDraw.Draw(im).polygon(to_px(left + right + top), fill=255)
    return im


def left_half(mask):
    cut = Image.new('L', (S, S), 0)
    ImageDraw.Draw(cut).rectangle((0, 0, S // 2, S), fill=255)
    return ImageChops.multiply(mask, cut)


def cross_mask():
    # A little inside the margin: a full-width cross looks bigger than the shield and sword, and its
    # shadow would be cut at the edge
    im = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(im)
    inset = MARGIN + 0.05 * (S - 2 * MARGIN)
    k = S - 2 * inset
    t = 0.36 * k
    r = 0.07 * k
    c = S / 2
    d.rounded_rectangle((c - t / 2, inset, c + t / 2, S - inset), r, fill=255)
    d.rounded_rectangle((inset, c - t / 2, S - inset, c + t / 2), r, fill=255)
    return im


def sword_masks():
    # Drawn upright on a bigger canvas, then turned 45 degrees so the tip points up and right
    L = int(S * 1.42)
    k = (L - 2 * MARGIN * 1.42) * 0.86
    o = (L - k) / 2
    c = L / 2

    def box(x0, y0, x1, y1):
        return (c + x0 * k, o + y0 * k, c + x1 * k, o + y1 * k)

    blade = Image.new('L', (L, L), 0)
    hilt = Image.new('L', (L, L), 0)
    bw = 0.085
    ImageDraw.Draw(blade).polygon([(c, o), (c + bw * k, o + 0.11 * k), (c + bw * k, o + 0.64 * k),
                                   (c - bw * k, o + 0.64 * k), (c - bw * k, o + 0.11 * k)], fill=255)
    d = ImageDraw.Draw(hilt)
    d.rounded_rectangle(box(-0.27, 0.62, 0.27, 0.72), 0.04 * k, fill=255)  # crossguard
    d.rounded_rectangle(box(-0.055, 0.70, 0.055, 0.89), 0.02 * k, fill=255)  # grip
    d.ellipse(box(-0.08, 0.85, 0.08, 1.00), fill=255)  # pommel

    def turn(im):
        im = im.rotate(-45, resample=Image.BICUBIC, center=(c, c))
        off = (L - S) // 2
        return im.crop((off, off, off + S, off + S))

    return turn(blade), turn(hilt)


def dilate(mask, px):
    # Grown by a round brush, so slanted edges get the same outline as straight ones
    out = mask
    step = 2
    for dy in range(-px, px + 1, step):
        for dx in range(-px, px + 1, step):
            if dx * dx + dy * dy <= px * px:
                out = ImageChops.lighter(out, ImageChops.offset(mask, dx, dy))
    return out


def gradient(top, bottom):
    g = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(g)
    for y in range(S):
        t = y / (S - 1)
        d.line((0, y, S, y), fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    return g


def lighten(color, f):
    return tuple(min(255, int(v + (255 - v) * f)) for v in color)


def compose(layers, shape, outline_color):
    outline = dilate(shape, OUTLINE)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    shadow.putalpha(outline.filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.6)))
    im.alpha_composite(shadow, (0, 8))
    edge = Image.new('RGBA', (S, S), outline_color + (255,))
    edge.putalpha(outline)
    im.alpha_composite(edge)
    for fill, mask in layers:
        fill = fill.copy()
        fill.putalpha(ImageChops.multiply(fill.getchannel('A'), mask))
        im.alpha_composite(fill)
    return im


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'role-icons')
    os.makedirs(out, exist_ok=True)
    shield = shield_mask()
    cross = cross_mask()
    blade, hilt = sword_masks()
    icons = {
        'tank': compose([(gradient(*BLUE), shield), (gradient(lighten(BLUE[0], 0.35), lighten(BLUE[1], 0.25)), left_half(shield))],
                        shield, (8, 25, 70)),
        'heal': compose([(gradient(*GREEN), cross)], cross, (10, 60, 15)),
        'dps': compose([(gradient(*STEEL), blade), (gradient(*RED), hilt)], ImageChops.lighter(blade, hilt), (40, 15, 15)),
    }
    for name, im in icons.items():
        im.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS).save(os.path.join(out, f'{name}.png'), optimize=True)
        print(f'assets/role-icons/{name}.png')


if __name__ == '__main__':
    main()
