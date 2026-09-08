#!/usr/bin/env python3
"""Bake #e7a765 outline bounds for topping PNGs → tools/topping_graphic_bounds.json"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOPPINGS_ROOT = os.path.join(ROOT, "crk", "pictures", "toppings")
OUT_PATH = os.path.join(ROOT, "tools", "topping_graphic_bounds.json")

OUTLINE_R, OUTLINE_G, OUTLINE_B = 0xE7, 0xA7, 0x65
TOLERANCE = 16
ALPHA_THRESHOLD = 8


def matches_outline(r: int, g: int, b: int, a: int) -> bool:
    if a < 20:
        return False
    return (
        abs(r - OUTLINE_R) <= TOLERANCE
        and abs(g - OUTLINE_G) <= TOLERANCE
        and abs(b - OUTLINE_B) <= TOLERANCE
    )


def measure_bounds(path: str) -> dict | None:
    from PIL import Image

    im = Image.open(path).convert("RGBA")
    nw, nh = im.size
    px = im.load()

    outline_min_x, outline_min_y = nw, nh
    outline_max_x = outline_max_y = 0
    outline_found = False

    alpha_min_x, alpha_min_y = nw, nh
    alpha_max_x = alpha_max_y = 0
    alpha_found = False

    for y in range(nh):
        for x in range(nw):
            r, g, b, a = px[x, y]
            if a > ALPHA_THRESHOLD:
                alpha_found = True
                alpha_min_x = min(alpha_min_x, x)
                alpha_min_y = min(alpha_min_y, y)
                alpha_max_x = max(alpha_max_x, x)
                alpha_max_y = max(alpha_max_y, y)
            if matches_outline(r, g, b, a):
                outline_found = True
                outline_min_x = min(outline_min_x, x)
                outline_min_y = min(outline_min_y, y)
                outline_max_x = max(outline_max_x, x)
                outline_max_y = max(outline_max_y, y)

    if outline_found:
        return {
            "x": outline_min_x,
            "y": outline_min_y,
            "w": outline_max_x - outline_min_x + 1,
            "h": outline_max_y - outline_min_y + 1,
            "nw": nw,
            "nh": nh,
            "method": "outline",
        }
    if alpha_found:
        return {
            "x": alpha_min_x,
            "y": alpha_min_y,
            "w": alpha_max_x - alpha_min_x + 1,
            "h": alpha_max_y - alpha_min_y + 1,
            "nw": nw,
            "nh": nh,
            "method": "alpha",
        }
    return None


def main() -> int:
    out: dict[str, dict] = {}
    skipped = 0
    for dirpath, _, filenames in os.walk(TOPPINGS_ROOT):
        for name in filenames:
            if not name.lower().endswith(".png"):
                continue
            if not name.startswith("Topping_"):
                continue
            if name.startswith("Topping_tart_") or name.startswith("Topping_selectable_"):
                continue
            full = os.path.join(dirpath, name)
            bounds = measure_bounds(full)
            if bounds:
                out[name] = bounds
            else:
                skipped += 1

    payload = {
        "_comment": "Pre-baked outline bounds (#e7a765). Regenerate: python tools/bake_topping_bounds.py",
        "bounds": out,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write("\n")
    print(f"Wrote {len(out)} bounds to {OUT_PATH} ({skipped} skipped)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
