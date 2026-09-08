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

  Selectable UI icon (one per resonance slug):
  Wiki:  File:Topping_selectable_<resonance>.png
  Local: crk/pictures/toppings/resonant/Topping_selectable_<resonance>.png
  (matches crk/char-ui.js getResonantSelectableImagePath).

You maintain resonance *wiki slugs* in tools/resonant_toppings.json as an
object mapping each slug to { "name": "...", "cookies": [...] } (optional
"update" for version gates). The importer uses object keys only.

Types: raspberry, chocolate, applejelly, caramel, kiwi, candy, walnut, almond, hazelnut, peanut
Missing wiki files for resonant pairs are expected sometimes — they are counted, not errors.

Same fetch/upgrade rules as other wiki importers (real PNG, upgrade if larger, WebP-as-PNG).

Usage:
  python import_wiki_resonant_toppings.py
  python import_wiki_resonant_toppings.py --dry-run
  python import_wiki_resonant_toppings.py --no-base          # resonant only
  python import_wiki_resonant_toppings.py --no-resonant      # base 1–3 only (no JSON)
  python import_wiki_resonant_toppings.py --verbose
  python import_wiki_resonant_toppings.py --resize 112 158   # base + resonant + selectable only
  python import_wiki_resonant_toppings.py --no-tarts       # skip tart slot 6 images

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
SLUGS_PATH = os.path.join(ROOT, "tools", "resonant_toppings.json")

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
TART_RARITIES: tuple[str, ...] = ("1", "2", "3", "4")


def resize_png_bytes(data: bytes, width: int, height: int) -> bytes:
    from io import BytesIO

    from PIL import Image

    with Image.open(BytesIO(data)) as im:
        rgba = im.convert("RGBA")
        resized = rgba.resize((width, height), Image.Resampling.LANCZOS)
        out = BytesIO()
        resized.save(out, format="PNG", optimize=True)
        return out.getvalue()


def local_tart_dest(topping_type: str, rarity: str) -> str:
    return os.path.join(TOPPINGS_ROOT, "tart", f"Topping_tart_{topping_type}_{rarity}.png")


def wiki_tart_title(topping_type: str, rarity: str) -> str:
    return f"File:Topping_tart_{topping_type}_{rarity}.png"


def normalize_resonance_slug(raw: str) -> str:
    """Lowercase slug for local paths; hyphens kept (e.g. research-driven), like Super Epic naming."""
    s = raw.strip().lower().replace(" ", "_")
    s = re.sub(r"[^a-z0-9_-]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def _resonance_slug_wiki_variants(slug: str) -> list[str]:
    """Wiki filenames may use hyphens or underscores; try both when resolving File: titles."""
    s = slug.strip().lower()
    if not s:
        return []
    out: list[str] = []
    for v in (s, s.replace("-", "_"), s.replace("_", "-")):
        if v and v not in out:
            out.append(v)
    return out


def _resolve_wiki_info(
    title_to_info: dict[str, dict], candidates: list[str]
) -> tuple[dict | None, str | None]:
    for title in candidates:
        info = title_to_info.get(title)
        if illu._info_ok(info):
            return info, title
    return None, None


def load_resonance_slugs() -> list[str]:
    if not os.path.isfile(SLUGS_PATH):
        print("Missing", SLUGS_PATH, file=sys.stderr)
        sys.exit(1)
    with open(SLUGS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        print(
            "resonant_toppings.json must be an object { slug: { name, cookies, update? } }",
            file=sys.stderr,
        )
        sys.exit(1)
    out: list[str] = []
    for key in data:
        if key is None or not str(key).strip():
            continue
        slug = normalize_resonance_slug(str(key))
        if slug and slug not in out:
            out.append(slug)
    return out


def wiki_file_title(topping_type: str, resonance_slug: str) -> str:
    return f"File:Topping_{topping_type}_{resonance_slug}.png"


def wiki_file_title_candidates(topping_type: str, resonance_slug: str) -> list[str]:
    return [wiki_file_title(topping_type, v) for v in _resonance_slug_wiki_variants(resonance_slug)]


def wiki_selectable_title(resonance_slug: str) -> str:
    return f"File:Topping_selectable_{resonance_slug}.png"


def wiki_selectable_title_candidates(resonance_slug: str) -> list[str]:
    return [wiki_selectable_title(v) for v in _resonance_slug_wiki_variants(resonance_slug)]


def local_selectable_dest(resonance_slug: str) -> str:
    slug = resonance_slug.strip().lower()
    return os.path.join(TOPPINGS_ROOT, "resonant", f"Topping_selectable_{slug}.png")


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


def cdn_selectable_url(resonance_slug: str) -> str:
    return illu.cdn_wikimg_url_for_filename(f"Topping_selectable_{resonance_slug}.png")


def main() -> None:
    ap = argparse.ArgumentParser(description="Import topping PNGs from Cookie Run Wiki (base + resonant)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--verbose", action="store_true", help="Log each missing wiki file")
    ap.add_argument("--no-base", action="store_true", help="Skip base toppings (rarity 1–3)")
    ap.add_argument("--no-tarts", action="store_true", help="Skip tart toppings (slot 6, rarities 1–4)")
    ap.add_argument("--no-resonant", action="store_true", help="Skip resonant list (tools JSON)")
    ap.add_argument(
        "--resize",
        nargs=2,
        type=int,
        metavar=("WIDTH", "HEIGHT"),
        help="Resize saved PNGs to exact dimensions (base, resonant, selectable only; tarts stay wiki size)",
    )
    ap.add_argument(
        "--fallback-hash-url",
        action="store_true",
        help="If API misses, try CDN md5 URL (often 404 if file truly absent)",
    )
    args = ap.parse_args()

    if args.no_base and args.no_resonant and args.no_tarts:
        print("Nothing to import (--no-base, --no-resonant, and --no-tarts)", file=sys.stderr)
        sys.exit(1)

    resize_target: tuple[int, int] | None = None
    if args.resize:
        rw, rh = args.resize
        if rw <= 0 or rh <= 0:
            print("--resize WIDTH HEIGHT must be positive", file=sys.stderr)
            sys.exit(1)
        resize_target = (rw, rh)

    resonance_slugs: list[str] = []
    if not args.no_resonant:
        resonance_slugs = load_resonance_slugs()
        if not resonance_slugs:
            print("No resonance slugs in", SLUGS_PATH, file=sys.stderr)
            sys.exit(1)

    planned: list[tuple[str, str, str, str, list[str]]] = []
    # (kind, a, b, dest, wiki_title_candidates) — base: a=type b=rarity; resonant: a=type b=slug; selectable: a=b=slug
    all_titles: list[str] = []
    if not args.no_base:
        for t in TOPPING_TYPES:
            for r in BASE_RARITIES:
                titles = [wiki_file_title(t, r)]
                dest = local_dest(t, r)
                planned.append(("base", t, r, dest, titles))
                all_titles.extend(titles)
    if not args.no_tarts:
        for t in TOPPING_TYPES:
            for r in TART_RARITIES:
                titles = [wiki_tart_title(t, r)]
                dest = local_tart_dest(t, r)
                planned.append(("tart", t, r, dest, titles))
                all_titles.extend(titles)
    if not args.no_resonant:
        for res in resonance_slugs:
            for t in TOPPING_TYPES:
                titles = wiki_file_title_candidates(t, res)
                dest = local_dest(t, res)
                planned.append(("resonant", t, res, dest, titles))
                all_titles.extend(titles)
        for res in resonance_slugs:
            titles = wiki_selectable_title_candidates(res)
            dest = local_selectable_dest(res)
            planned.append(("selectable", res, res, dest, titles))
            all_titles.extend(titles)

    if not planned:
        print("No work planned", file=sys.stderr)
        sys.exit(1)

    title_to_info = illu._batch_query_titles(list(dict.fromkeys(all_titles)))

    missing_wiki = 0
    downloaded = 0
    upgraded = 0
    skipped_ok = 0
    failed = 0

    for kind, a, b, dest, title_candidates in planned:
        info, _ = _resolve_wiki_info(title_to_info, title_candidates)
        url = info["url"] if illu._info_ok(info) else None
        remote_wh: tuple[int, int] | None = None
        if info and info.get("width") is not None and info.get("height") is not None:
            remote_wh = (info["width"], info["height"])

        if not url and args.fallback_hash_url:
            if kind == "selectable":
                url = cdn_selectable_url(a)
            elif kind == "tart":
                url = illu.cdn_wikimg_url_for_filename(f"Topping_tart_{a}_{b}.png")
            else:
                url = cdn_url(a, b)

        if not url:
            missing_wiki += 1
            if args.verbose:
                print("  [no wiki file]", kind, a, b, title_candidates)
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
            if resize_target and kind != "tart":
                if local_wh != resize_target:
                    tw, th = resize_target
                    return True, f"resize {local_wh[0]}x{local_wh[1]} -> {tw}x{th}"
                return False, "target size"
            if remote_px is None:
                return True, "remote dims unknown (verify after download)"
            if remote_px > local_px:
                return True, f"upgrade {local_wh[0]}x{local_wh[1]} -> {remote_wh[0]}x{remote_wh[1]}"
            return False, "up to date"

        do_fetch, reason = should_fetch()

        if kind == "selectable":
            label = f"selectable/{a}"
        elif kind == "tart":
            label = f"tart/{a}/{b}"
        else:
            label = f"{a}/{b}"

        if args.dry_run:
            if kind == "tart" or not resize_target:
                rw, rh = remote_wh if remote_wh else ("?", "?")
            else:
                rw, rh = resize_target
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
            if resize_target and kind != "tart":
                try:
                    data = resize_png_bytes(data, resize_target[0], resize_target[1])
                except OSError as e:
                    print("  [resize]", label, e)
                    failed += 1
                    continue
                dl_wh = resize_target
            dl_px = illu.pixels(dl_wh)
            use_resize_rules = resize_target and kind != "tart"
            if not args.force and not use_resize_rules and exists_nonempty and local_wh is not None:
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
    n_tarts = 0 if args.no_tarts else len(TOPPING_TYPES) * len(TART_RARITIES)
    n_res_by_type = 0 if args.no_resonant else len(TOPPING_TYPES) * len(resonance_slugs)
    n_res_selectable = 0 if args.no_resonant else len(resonance_slugs)
    size_note = f" resize={resize_target[0]}x{resize_target[1]}" if resize_target else ""
    if args.dry_run:
        print(
            f"Done (dry-run). planned={total} (base={n_base} tarts={n_tarts} "
            f"resonant_by_type={n_res_by_type} selectable={n_res_selectable}){size_note} "
            f"would_fetch={downloaded} would_skip={skipped_ok} "
            f"missing_wiki={missing_wiki} failed={failed}"
        )
    else:
        print(
            f"Done. planned={total} (base={n_base} tarts={n_tarts} "
            f"resonant_by_type={n_res_by_type} selectable={n_res_selectable}){size_note} "
            f"new={downloaded} upgraded={upgraded} skipped={skipped_ok} "
            f"missing_wiki={missing_wiki} failed={failed}"
        )


if __name__ == "__main__":
    main()
