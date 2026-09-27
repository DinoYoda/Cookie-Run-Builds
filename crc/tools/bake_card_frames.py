#!/usr/bin/env python3
"""Bake soft Crumble card background art (PNG) from wiki-inspired palettes."""

from __future__ import annotations

import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "pictures", "cards", "frames")
SIZE = (512, 492)

# Center glow, corner tint, base (wiki Cc colors, softened for background use)
PALETTES: dict[str, tuple[tuple[int, int, int, int], tuple[int, int, int, int], tuple[int, int, int]]] = {
    "c": ((155, 194, 200, 90), (50, 110, 130, 120), (32, 64, 74)),
    "u": ((206, 207, 207, 80), (0, 175, 177, 110), (1, 80, 84)),
    "r": ((208, 221, 247, 90), (66, 141, 200, 115), (24, 58, 96)),
    "sr": ((254, 172, 145, 85), (230, 64, 219, 110), (96, 28, 88)),
    "ssr": ((255, 247, 164, 95), (249, 78, 33, 115), (120, 48, 12)),
    "tssr": ((191, 211, 255, 90), (136, 134, 230, 115), (48, 56, 120)),
}


def bake_frame(slug: str) -> None:
    glow, tint, base = PALETTES[slug]
    img = Image.new("RGBA", SIZE, base + (255,))
    draw = ImageDraw.Draw(img)
    w, h = SIZE
    draw.ellipse((-w * 0.15, h * 0.18, w * 1.15, h * 1.22), fill=tint)
    draw.ellipse((w * 0.08, h * 0.42, w * 0.92, h * 1.08), fill=glow)
    path = os.path.join(OUT_DIR, f"{slug}.png")
    img.save(path, optimize=True)
    print("Wrote", path)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for slug in PALETTES:
        bake_frame(slug)


if __name__ == "__main__":
    main()
