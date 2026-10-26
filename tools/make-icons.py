"""Draws assets/icon.png and assets/plugin-icon.png (an inbox tray with a down arrow).

Run: python3 tools/make-icons.py   (needs Pillow)
"""
from PIL import Image, ImageDraw

S, N = 4, 48
img = Image.new('LA', (N * S, N * S), (0, 0))
d = ImageDraw.Draw(img)


def line(pts, w=3.2):
    pts = [(x * S, y * S) for x, y in pts]
    d.line(pts, fill=(0, 255), width=int(w * S), joint='curve')
    r = w * S / 2
    for x, y in pts:
        d.ellipse((x - r, y - r, x + r, y + r), fill=(0, 255))


line([(7, 28), (7, 40), (41, 40), (41, 28)])
line([(7, 28), (16, 28), (18.5, 33.5), (29.5, 33.5), (32, 28), (41, 28)])
line([(24, 7), (24, 25)])
line([(16, 17.5), (24, 25.5), (32, 17.5)])
img = img.resize((N, N), Image.LANCZOS)
img.save('assets/icon.png')
img.save('assets/plugin-icon.png')
