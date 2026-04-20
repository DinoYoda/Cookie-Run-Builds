#!/usr/bin/env python3
"""
Import topping images from the Cookie Run Wiki: base rarities + resonant set.

Base (always unless --no-base):
  Wiki: Topping_<type>_<1|2|3>.png
  e.g. https://cdn.wikimg.net/.../Topping_raspberry_3.png
  Local: crk/pictures/toppings/<type>/Topping_<type>_<1|2|3>.png
  All 10 types × rarities 1–3 (30 files).

Resonant (unless --no-resonant):
  Wiki:  Topping_<type>_<resonance>.png
  e.g. https://cookierun.wiki/w/Toppings#/media/File:Topping_raspberry_crossed_fates.png
  Local: crk/pictures/toppings/<type>/Topping_<type>_<resonance>.png
  with resonance lowercased (matches crk/char-ui.js getToppingImagePath).

You maintain resonance *wiki slugs* in tools/wiki_resonant_topping_slugs.json
(JSON array of strings; normalized like crossed_fates).

Types: raspberry, chocolate, applejelly, caramel, kiwi, candy, walnut, almond, hazelnut, peanut
Missing wiki files for resonant pairs are expected sometimes — they are counted, not errors.

Same fetch/upgrade rules as other wiki importers (real PNG, upgrade if larger, WebP-as-PNG).

Usage:
  python import_wiki_resonant_toppings.py
  python import_wiki_resonant_toppings.py --dry-run
  python import_wiki_resonant_toppings.py --no-base          # resonant only
  python import_wiki_resonant_toppings.py --no-resonant      # base 1–3 only (no JSON)
  python import_wiki_resonant_toppings.py --verbose
  python import_wiki_resonant_toppings.py --fallback-hash-url

Requires: Python 3.9+
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error

import import_wiki_illustrations as illu

ROOT = illu.ROOT
TOPPINGS_ROOT = os.path.join(ROOT, "crk", "pictures", "toppings")
SLUGS_PATH = os.path.join(ROOT, "tools", "wiki_resonant_topping_slugs.json")

TOPPING_TYPES: tuple[str, ...] = (
    "raspberry",
    "chocolate",
    "applejelly",
    "caramel",
    "kiwi",
    "candy",
    "walnut",
    "almond",
    "hazelnut",
    "peanut",
)

BASE_RARITIES: tuple[str, ...] = ("1", "2", "3")


def normalize_resonance_slug(raw: str) -> str:
    s = raw.strip().lower().replace(" ", "_")
    s = re.sub(r"[^a-z0-9_]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def load_resonance_slugs() -> list[str]:
    if not os.path.isfile(SLUGS_PATH):
        print("Missing", SLUGS_PATH, file=sys.stderr)
        sys.exit(1)
    with open(SLUGS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        print("wiki_resonant_topping_slugs.json must be a JSON array of strings", file=sys.stderr)
        sys.exit(1)
    out: list[str] = []
    for item in data:
        if not item or not str(item).strip():
            continue
        slug = normalize_resonance_slug(str(item))
        if slug and slug not in out:
            out.append(slug)
    return out


def wiki_file_title(topping_type: str, resonance_slug: str) -> str:
    return f"File:Topping_{topping_type}_{resonance_slug}.png"


def local_dest(topping_type: str, resonance_slug: str) -> str:
    return os.path.join(
        TOPPINGS_ROOT,
        topping_type,
        f"Topping_{topping_type}_{resonance_slug.lower()}.png",
    )


def dest_display(dest: str) -> str:
    """Project-relative path with forward slashes (shows per-type subfolder)."""
    return os.path.relpath(dest, ROOT).replace(os.sep, "/")


def cdn_url(topping_type: str, resonance_slug: str) -> str:
    return illu.cdn_wikimg_url_for_filename(f"Topping_{topping_type}_{resonance_slug}.png")


def main() -> None:
    ap = argparse.ArgumentParser(description="Import topping PNGs from Cookie Run Wiki (base + resonant)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--verbose", action="store_true", help="Log each missing wiki file")
    ap.add_argument("--no-base", action="store_true", help="Skip base toppings (rarity 1–3)")
    ap.add_argument("--no-resonant", action="store_true", help="Skip resonant list (tools JSON)")
    ap.add_argument(
        "--fallback-hash-url",
        action="store_true",
        help="If API misses, try CDN md5 URL (often 404 if file truly absent)",
    )
    args = ap.parse_args()

    if args.no_base and args.no_resonant:
        print("Nothing to import (--no-base and --no-resonant)", file=sys.stderr)
        sys.exit(1)

    resonance_slugs: list[str] = []
    if not args.no_resonant:
        resonance_slugs = load_resonance_slugs()
        if not resonance_slugs:
            print("No resonance slugs in", SLUGS_PATH, file=sys.stderr)
            sys.exit(1)

    planned: list[tuple[str, str, str, str]] = []
    # (topping_type, resonance_slug, dest, wiki_title)
    all_titles: list[str] = []
    if not args.no_base:
        for t in TOPPING_TYPES:
            for r in BASE_RARITIES:
                title = wiki_file_title(t, r)
                dest = local_dest(t, r)
                planned.append((t, r, dest, title))
                all_titles.append(title)
    if not args.no_resonant:
        for res in resonance_slugs:
            for t in TOPPING_TYPES:
                title = wiki_file_title(t, res)
                dest = local_dest(t, res)
                planned.append((t, res, dest, title))
                all_titles.append(title)

    if not planned:
        print("No work planned", file=sys.stderr)
        sys.exit(1)

    title_to_info = illu._batch_query_titles(list(dict.fromkeys(all_titles)))

    missing_wiki = 0
    downloaded = 0
    upgraded = 0
    skipped_ok = 0
    failed = 0

    for topping_type, res_slug, dest, title in planned:
        info = title_to_info.get(title)
        url = info["url"] if illu._info_ok(info) else None
        remote_wh: tuple[int, int] | None = None
        if info and info.get("width") is not None and info.get("height") is not None:
            remote_wh = (info["width"], info["height"])

        if not url and args.fallback_hash_url:
            url = cdn_url(topping_type, res_slug)

        if not url:
            missing_wiki += 1
            if args.verbose:
                print("  [no wiki file]", topping_type, res_slug, title)
            continue

        os.makedirs(os.path.dirname(dest), exist_ok=True)

        exists_nonempty = os.path.isfile(dest) and os.path.getsize(dest) > 0
        local_wh = illu.png_dimensions_from_path(dest) if exists_nonempty else None
        local_px = illu.pixels(local_wh)
        remote_px = illu.pixels(remote_wh)

        def should_fetch() -> tuple[bool, str]:
            if args.force:
                return True, "force"
            if not exists_nonempty:
                return True, "no local file (or empty)"
            if local_wh is None:
                return True, "local file exists but is not a valid PNG (e.g. WebP renamed .png)"
            if remote_px is None:
                return True, "remote dims unknown (verify after download)"
            if remote_px > local_px:
                return True, f"upgrade {local_wh[0]}x{local_wh[1]} -> {remote_wh[0]}x{remote_wh[1]}"
            return False, "up to date"

        do_fetch, reason = should_fetch()

        label = f"{topping_type}/{res_slug}"

        if args.dry_run:
            rw, rh = remote_wh if remote_wh else ("?", "?")
            if do_fetch:
                print(
                    f"  [dry-run fetch] {label} ({reason}) wiki ~{rw}x{rh} -> {dest_display(dest)}"
                )
                downloaded += 1
            else:
                lw, lh = local_wh if local_wh else (0, 0)
                print(
                    f"  [dry-run skip] {label} local {lw}x{lh} >= wiki {rw}x{rh} ({dest_display(dest)})"
                )
                skipped_ok += 1
            continue

        if not do_fetch:
            skipped_ok += 1
            continue

        try:
            data = illu.http_bytes(url)
            if len(data) < 200:
                print("  [tiny response]", label, len(data), "bytes")
                failed += 1
                continue
            dl_wh = illu.png_dimensions_from_bytes(data)
            if dl_wh is None:
                print("  [not a PNG]", label, url)
                failed += 1
                continue
            dl_px = illu.pixels(dl_wh)
            if not args.force and exists_nonempty and local_wh is not None:
                if dl_px <= local_px:
                    print(
                        f"  [skip smaller or same] {label} local {local_wh[0]}x{local_wh[1]} kept; remote {dl_wh[0]}x{dl_wh[1]} ({dest_display(dest)})"
                    )
                    skipped_ok += 1
                    continue

            tmp = dest + ".tmp"
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, dest)
            if exists_nonempty and local_wh is not None:
                upgraded += 1
                print(f"  [upgraded] {label} {reason} -> {dest_display(dest)}")
            else:
                downloaded += 1
                print(f"  [saved] {label} {reason} -> {dest_display(dest)}")
        except urllib.error.HTTPError as e:
            print("  [http]", label, e.code, url)
            failed += 1
        except OSError as e:
            print("  [io]", label, e)
            failed += 1

    total = len(planned)
    n_base = 0 if args.no_base else len(TOPPING_TYPES) * len(BASE_RARITIES)
    n_res_pairs = 0 if args.no_resonant else len(TOPPING_TYPES) * len(resonance_slugs)
    if args.dry_run:
        print(
            f"Done (dry-run). planned={total} (base={n_base} resonant_pairs={n_res_pairs}) "
            f"would_fetch={downloaded} would_skip={skipped_ok} "
            f"missing_wiki={missing_wiki} failed={failed}"
        )
    else:
        print(
            f"Done. planned={total} (base={n_base} resonant_pairs={n_res_pairs}) "
            f"new={downloaded} upgraded={upgraded} skipped={skipped_ok} "
            f"missing_wiki={missing_wiki} failed={failed}"
        )


if __name__ == "__main__":
    main()
