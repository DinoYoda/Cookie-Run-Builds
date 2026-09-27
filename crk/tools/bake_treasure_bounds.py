#!/usr/bin/env python3
"""Bake opaque-pixel bounds for treasure PNGs → crk/tools/treasure_graphic_bounds.json"""

from __future__ import annotations

import json
import os
import sys

CRK_TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(CRK_TOOLS))
TREASURES_ROOT = os.path.join(ROOT, "crk", "pictures", "treasures")
OUT_PATH = os.path.join(CRK_TOOLS, "treasure_graphic_bounds.json")

ALPHA_THRESHOLD = 8


def measure_bounds(path: str) -> dict | None:
    from PIL import Image

    im = Image.open(path).convert("RGBA")
    nw, nh = im.size
    px = im.load()

    alpha_min_x, alpha_min_y = nw, nh
    alpha_max_x = alpha_max_y = 0
    alpha_found = False

    for y in range(nh):
        for x in range(nw):
            _r, _g, _b, a = px[x, y]
            if a > ALPHA_THRESHOLD:
                alpha_found = True
                alpha_min_x = min(alpha_min_x, x)
                alpha_min_y = min(alpha_min_y, y)
                alpha_max_x = max(alpha_max_x, x)
                alpha_max_y = max(alpha_max_y, y)

    if not alpha_found:
        return None
    return {
        "x": alpha_min_x,
        "y": alpha_min_y,
        "w": alpha_max_x - alpha_min_x + 1,
        "h": alpha_max_y - alpha_min_y + 1,
        "nw": nw,
        "nh": nh,
        "method": "alpha",
    }


def main() -> int:
    out: dict[str, dict] = {}
    skipped = 0
    for name in sorted(os.listdir(TREASURES_ROOT)):
        if not name.lower().endswith(".png"):
            continue
        if not name.startswith("Treasure_"):
            continue
        full = os.path.join(TREASURES_ROOT, name)
        bounds = measure_bounds(full)
        if bounds:
            out[name] = bounds
        else:
            skipped += 1

    payload = {
        "_comment": "Pre-baked alpha bounds for treasure icons. Regenerate: python crk/tools/bake_treasure_bounds.py",
        "bounds": out,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write("\n")
    print(f"Wrote {len(out)} bounds to {OUT_PATH} ({skipped} skipped)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
