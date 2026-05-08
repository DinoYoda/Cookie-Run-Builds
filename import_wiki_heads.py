#!/usr/bin/env python3
"""
Download Cookie Run: Kingdom cookie head / portrait icons from the Cookie Run Wiki.

Wiki:   File:Crk_head_<slug>.png
        e.g. https://cookierun.wiki/.../File:Crk_head_timekeeper.png

Local:  crk/pictures/icons/cookie/<data.js name>_head.png
        Matches char-ui.js / teams.js: .../icons/cookie/${name}_head.png

Uses the same slug candidates as cards and skill icons (wiki_asset_candidate_slugs).
For **Awakened_*** ancients, prefers any head whose slug is not the base cookie’s
(e.g. `Crk_head_awakened_dark_cacao.png` before `Crk_head_dark_cacao.png`), because
the base file is often larger and would otherwise win on pixel count alone.
Within each tier, best resolution wins.

Slug overrides (optional):
  - tools/wiki_card_slug_overrides.json  (shared with import_wiki_cards.py)
  - tools/wiki_head_slug_overrides.json { "CookieName": "wiki_slug" }  (head-specific; wins over card)

Also respects tools/wiki_illustration_slug_overrides.json in candidate (3).

Same upgrade rules as import_wiki_illustrations.py (PNG dims, WebP-as-PNG, etc.).

Requires: Node.js, Python 3.9+
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error

import import_wiki_illustrations as illu
from import_wiki_skill_icons import (
    _pick_best_info_ordered_groups,
    wiki_asset_candidate_slugs,
    wiki_crk_asset_file_title_groups,
)

ROOT = illu.ROOT
HEADS_DIR = os.path.join(ROOT, "crk", "pictures", "icons", "cookie")
CARD_OVERRIDES_PATH = os.path.join(ROOT, "tools", "wiki_card_slug_overrides.json")
HEAD_OVERRIDES_PATH = os.path.join(ROOT, "tools", "wiki_head_slug_overrides.json")


def _load_json_slug_map(path: str) -> dict[str, str]:
    if not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k): str(v) for k, v in raw.items()}


def load_head_slug_overrides() -> dict[str, str]:
    """Merge card overrides with optional head-specific overrides (head wins)."""
    card = _load_json_slug_map(CARD_OVERRIDES_PATH)
    head = _load_json_slug_map(HEAD_OVERRIDES_PATH)
    return {**card, **head}


def local_head_filename(name: str) -> str:
    """Match UI: <data.js name>_head.png"""
    return f"{name}_head.png"


def cdn_url_head_first_slug(slugs: list[str]) -> str | None:
    if not slugs:
        return None
    return illu.cdn_wikimg_url_for_filename(f"Crk_head_{slugs[0]}.png")


def main() -> None:
    ap = argparse.ArgumentParser(description="Import CRK head icons from Cookie Run Wiki")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--name", help="Only this data.js cookie name")
    ap.add_argument(
        "--fallback-hash-url",
        action="store_true",
        help="If API finds nothing, try CDN md5 URL for first candidate slug",
    )
    args = ap.parse_args()

    illustration_ov = illu.load_overrides()
    slug_ov = load_head_slug_overrides()
    rows = illu.load_char_rows()
    if args.name:
        rows = [r for r in rows if r["name"] == args.name]
        if not rows:
            print("No character named", args.name, file=sys.stderr)
            sys.exit(1)

    os.makedirs(HEADS_DIR, exist_ok=True)
    display_by_name = {r["name"]: r.get("displayName") or r["name"] for r in rows}

    planned: list[tuple[str, str, list[list[str]], list[str]]] = []
    all_titles: list[str] = []
    for r in rows:
        name = r["name"]
        slugs = wiki_asset_candidate_slugs(
            name, display_by_name[name], illustration_ov, slug_ov
        )
        title_groups = wiki_crk_asset_file_title_groups(name, slugs, "Crk_head")
        dest = os.path.join(HEADS_DIR, local_head_filename(name))
        planned.append((name, dest, title_groups, slugs))
        for g in title_groups:
            all_titles.extend(g)

    title_to_info = illu._batch_query_titles(list(dict.fromkeys(all_titles)))

    missing_api: list[str] = []
    downloaded = 0
    upgraded = 0
    skipped_ok = 0
    failed = 0

    for name, dest, title_groups, slugs in planned:
        info, won_title = _pick_best_info_ordered_groups(title_groups, title_to_info)
        url = info["url"] if info else None
        remote_wh: tuple[int, int] | None = None
        if info and info.get("width") is not None and info.get("height") is not None:
            remote_wh = (info["width"], info["height"])

        if not url and args.fallback_hash_url:
            url = cdn_url_head_first_slug(slugs)

        if not url:
            missing_api.append(name)
            titles_try = [t for g in title_groups for t in g]
            print("  [no wiki file]", name, " ; ".join(titles_try))
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
                    f"  [dry-run fetch] {name} ({reason}) wiki ~{rw}x{rh} via {won_short} -> {os.path.basename(dest)}"
                )
            else:
                lw, lh = local_wh if local_wh else (0, 0)
                print(f"  [dry-run skip] {name} local {lw}x{lh} >= wiki {rw}x{rh}")
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
                print("  [tiny response]", name, len(data), "bytes", url)
                failed += 1
                continue
            dl_wh = illu.png_dimensions_from_bytes(data)
            if dl_wh is None:
                print("  [not a PNG]", name, url)
                failed += 1
                continue
            dl_px = illu.pixels(dl_wh)
            if not args.force and exists_nonempty and local_wh is not None:
                if dl_px <= local_px:
                    print(
                        f"  [skip smaller or same] {name} local {local_wh[0]}x{local_wh[1]} kept; remote {dl_wh[0]}x{dl_wh[1]}"
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
                print(f"  [upgraded] {name} {reason} ({won_short})")
            else:
                downloaded += 1
                print(f"  [saved] {name} {reason} ({won_short})")
        except urllib.error.HTTPError as e:
            print("  [http]", name, e.code, url)
            failed += 1
        except OSError as e:
            print("  [io]", name, e)
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
