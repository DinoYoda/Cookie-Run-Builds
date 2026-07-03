#!/usr/bin/env python3
"""
Download Cookie Run: Kingdom treasure icons from the Cookie Run Wiki.

Wiki:   File:Crk_treasure_<suffix>.png
        e.g. File:Crk_treasure_gatekeeper_ghost's_horn.png
        https://cookierun.wiki/.../File:Crk_treasure_...

Local:  crk/pictures/treasures/Treasure_<stem>.png
        Matches char-ui.js / treasure-tag-data: Treasure_${slug}.png
        Stems never include apostrophes (wiki File: may use e.g. ghost's; we save ghosts).

Which treasures:
  - All stems from tools/treasures-reference.json (slug field when set)
  - Union with stems from existing Treasure_*.png in crk/pictures/treasures/
  - Union with values from tools/wiki_treasure_slug_map.json

Wiki suffix candidates (best resolution wins):
  1) tools/wiki_treasure_wiki_filename_overrides.json  { "local_stem": "wiki_suffix" }
  2) suffix derived from tools/treasures-reference.json display name (lowercase; spaces etc. -> _; keeps ')
  3) local stem with 27 replaced by apostrophe (wiki encoding in some slugs)
  4) local stem as-is

Optional: --fallback-hash-url tries cdn.wikimg.net for each suffix in order.

Same upgrade rules as import_wiki_illustrations.py (PNG dims, WebP-as-PNG, etc.).

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
from import_wiki_skill_icons import _pick_best_info

ROOT = illu.ROOT
TREASURES_DIR = os.path.join(ROOT, "crk", "pictures", "treasures")
REFERENCE_PATH = os.path.join(ROOT, "tools", "treasures-reference.json")
SLUG_MAP_PATH = os.path.join(ROOT, "tools", "wiki_treasure_slug_map.json")
WIKI_SUFFIX_OVERRIDES_PATH = os.path.join(
    ROOT, "tools", "wiki_treasure_wiki_filename_overrides.json"
)

TREASURE_PREFIX = "Crk_treasure_"


def normalize_local_treasure_stem(stem: str) -> str:
    """Wiki filenames may contain '; local Treasure_*.png names do not."""
    s = (stem or "").strip()
    return s.replace("'", "").replace("\u2019", "")


def _load_json(path: str) -> dict:
    if not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_wiki_suffix_overrides() -> dict[str, str]:
    raw = _load_json(WIKI_SUFFIX_OVERRIDES_PATH)
    return {str(k): str(v) for k, v in raw.items()}


def load_reference_stem_to_display_name() -> dict[str, str]:
    """Map normalized treasure stem -> official display name from treasures-reference."""
    out: dict[str, str] = {}
    ref = _load_json(REFERENCE_PATH)
    for entry in ref.get("wikiKeywords") or []:
        if not isinstance(entry, dict):
            continue
        s = entry.get("slug")
        n = entry.get("name")
        if not isinstance(s, str) or not s.strip():
            continue
        if not isinstance(n, str) or not n.strip():
            continue
        stem = normalize_local_treasure_stem(s)
        out[stem] = n.strip()
    return out


def wiki_suffix_from_display_name(name: str) -> str | None:
    """Wiki File:Crk_treasure_<this>.png suffix from in-game / reference display name."""
    s = (name or "").strip()
    if not s:
        return None
    s = s.replace("\u2019", "'").lower()
    s = re.sub(r"[^a-z0-9']+", "_", s)
    s = s.strip("_")
    return s or None


def collect_treasure_stems() -> list[str]:
    stems: set[str] = set()

    ref = _load_json(REFERENCE_PATH)
    for entry in ref.get("wikiKeywords") or []:
        if not isinstance(entry, dict):
            continue
        s = entry.get("slug")
        if isinstance(s, str) and s.strip():
            stems.add(normalize_local_treasure_stem(s))

    if os.path.isdir(TREASURES_DIR):
        for fn in os.listdir(TREASURES_DIR):
            if fn.startswith("Treasure_") and fn.lower().endswith(".png"):
                stems.add(
                    normalize_local_treasure_stem(
                        fn[len("Treasure_") : -len(".png")]
                    )
                )

    slug_ov = _load_json(SLUG_MAP_PATH)
    for v in slug_ov.values():
        if isinstance(v, str) and v.strip():
            stems.add(normalize_local_treasure_stem(v))

    return sorted(stems)


def wiki_suffix_candidates(
    stem: str,
    overrides: dict[str, str],
    stem_to_display_name: dict[str, str],
) -> list[str]:
    """Unique wiki filename suffixes (without Crk_treasure_ / .png), in try order for CDN."""
    stem = normalize_local_treasure_stem(stem)
    out: list[str] = []
    seen: set[str] = set()

    def push(s: str) -> None:
        s = (s or "").strip()
        if not s or s in seen:
            return
        seen.add(s)
        out.append(s)

    if stem in overrides:
        push(overrides[stem])
    dn = stem_to_display_name.get(stem)
    if dn:
        w = wiki_suffix_from_display_name(dn)
        if w:
            push(w)
    push(stem.replace("27", "'"))
    push(stem)
    return out


def treasure_file_titles(
    stem: str,
    overrides: dict[str, str],
    stem_to_display_name: dict[str, str],
) -> list[str]:
    return [
        f"File:{TREASURE_PREFIX}{suf}.png"
        for suf in wiki_suffix_candidates(stem, overrides, stem_to_display_name)
    ]


def cdn_url_first_suffix(suffixes: list[str]) -> str | None:
    for suf in suffixes:
        if not suf:
            continue
        return illu.cdn_wikimg_url_for_filename(f"{TREASURE_PREFIX}{suf}.png")
    return None


def local_treasure_path(stem: str) -> str:
    return os.path.join(
        TREASURES_DIR, f"Treasure_{normalize_local_treasure_stem(stem)}.png"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Import CRK treasure PNGs from Cookie Run Wiki")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument(
        "--slug",
        help="Only this treasure stem (e.g. gatekeeper_ghosts_horn, matches Treasure_<slug>.png)",
    )
    ap.add_argument(
        "--fallback-hash-url",
        action="store_true",
        help="If API finds nothing, try CDN md5 URL for wiki suffix candidates in order",
    )
    args = ap.parse_args()

    suffix_ov = load_wiki_suffix_overrides()
    stem_to_name = load_reference_stem_to_display_name()
    stems = collect_treasure_stems()
    if args.slug:
        s = normalize_local_treasure_stem(args.slug)
        if not s:
            print("Empty --slug", file=sys.stderr)
            sys.exit(1)
        if s not in stems:
            print("  [note] slug not in reference/dir/slug_map; importing anyway", file=sys.stderr)
        stems = [s]

    os.makedirs(TREASURES_DIR, exist_ok=True)

    planned: list[tuple[str, str, list[str]]] = []
    all_titles: list[str] = []
    for stem in stems:
        titles = treasure_file_titles(stem, suffix_ov, stem_to_name)
        dest = local_treasure_path(stem)
        planned.append((stem, dest, titles))
        all_titles.extend(titles)

    title_to_info = illu._batch_query_titles(list(dict.fromkeys(all_titles)))

    missing_api: list[str] = []
    downloaded = 0
    upgraded = 0
    skipped_ok = 0
    failed = 0

    for stem, dest, titles in planned:
        info, won_title = _pick_best_info(titles, title_to_info)
        url = info["url"] if info else None
        remote_wh: tuple[int, int] | None = None
        if info and info.get("width") is not None and info.get("height") is not None:
            remote_wh = (info["width"], info["height"])

        if not url and args.fallback_hash_url and not args.dry_run:
            suf_list = wiki_suffix_candidates(stem, suffix_ov, stem_to_name)
            url = cdn_url_first_suffix(suf_list)
            if url:
                try:
                    data_probe = illu.http_bytes(url)
                    if len(data_probe) >= 200 and illu.png_dimensions_from_bytes(data_probe):
                        remote_wh = illu.png_dimensions_from_bytes(data_probe)
                        won_title = f"CDN:{os.path.basename(url.split('?')[0])}"
                    else:
                        url = None
                except (urllib.error.HTTPError, OSError):
                    url = None

        if not url:
            missing_api.append(stem)
            print("  [no wiki file]", stem, " ; ".join(titles))
            continue

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
        won_short = (
            os.path.basename(won_title.replace("File:", "").replace(" ", "_"))
            if won_title
            else "?"
        )

        if args.dry_run:
            rw, rh = remote_wh if remote_wh else ("?", "?")
            if do_fetch:
                print(
                    f"  [dry-run fetch] {stem} ({reason}) wiki ~{rw}x{rh} via {won_short} -> {os.path.basename(dest)}"
                )
            else:
                lw, lh = local_wh if local_wh else (0, 0)
                print(f"  [dry-run skip] {stem} local {lw}x{lh} >= wiki {rw}x{rh}")
            if do_fetch:
                downloaded += 1
            else:
                skipped_ok += 1
            continue

        if not do_fetch:
            skipped_ok += 1
            continue

        try:
            data = illu.http_bytes(url)
            if len(data) < 200:
                print("  [tiny response]", stem, len(data), "bytes", url)
                failed += 1
                continue
            dl_wh = illu.png_dimensions_from_bytes(data)
            if dl_wh is None:
                print("  [not a PNG]", stem, url)
                failed += 1
                continue
            dl_px = illu.pixels(dl_wh)
            if not args.force and exists_nonempty and local_wh is not None:
                if dl_px <= local_px:
                    print(
                        f"  [skip smaller or same] {stem} local {local_wh[0]}x{local_wh[1]} kept; remote {dl_wh[0]}x{dl_wh[1]}"
                    )
                    skipped_ok += 1
                    continue

            tmp = dest + ".tmp"
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, dest)
            is_upgrade = exists_nonempty and local_wh is not None
            if is_upgrade:
                upgraded += 1
                print(f"  [upgraded] {stem} {reason} ({won_short})")
            else:
                downloaded += 1
                print(f"  [saved] {stem} {reason} ({won_short})")
        except urllib.error.HTTPError as e:
            print("  [http]", stem, e.code, url)
            failed += 1
        except OSError as e:
            print("  [io]", stem, e)
            failed += 1

    if args.dry_run:
        print(
            "Done (dry-run). "
            f"would_fetch={downloaded} would_skip={skipped_ok} "
            f"missing_wiki={len(missing_api)} failed={failed}"
        )
    else:
        print(
            "Done. "
            f"new={downloaded} upgraded={upgraded} skipped={skipped_ok} "
            f"missing_wiki={len(missing_api)} failed={failed}"
        )


if __name__ == "__main__":
    main()
