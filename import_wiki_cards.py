#!/usr/bin/env python3
"""
Download Cookie Run: Kingdom gacha card art from the Cookie Run Wiki CDN.

Wiki:   File:Crk_card_<slug>.png  (e.g. Crk_card_gingerbrave.png)
Local:  crk/pictures/cards/Cookie_<name_lower>_card.png
        Matches ui.js cardImageFilename for CRK: Cookie_${name.toLowerCase()}_card.png

Uses the same slug candidates as skill icons (wiki_asset_candidate_slugs): best resolution wins.

Optional: tools/wiki_card_slug_overrides.json  { "CookieName": "wiki_slug" }
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
from import_wiki_skill_icons import _pick_best_info, wiki_asset_candidate_slugs

ROOT = illu.ROOT
CARDS_DIR = os.path.join(ROOT, "crk", "pictures", "cards")
CARD_OVERRIDES_PATH = os.path.join(ROOT, "tools", "wiki_card_slug_overrides.json")


def load_card_overrides() -> dict[str, str]:
    if not os.path.isfile(CARD_OVERRIDES_PATH):
        return {}
    with open(CARD_OVERRIDES_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k): str(v) for k, v in raw.items()}


def local_card_filename(name: str) -> str:
    """Match ui.js: Cookie_${String(name).toLowerCase()}_card.png"""
    return f"Cookie_{str(name).lower()}_card.png"


def card_file_titles(slugs: list[str]) -> list[str]:
    return [f"File:Crk_card_{s}.png" for s in slugs]


def cdn_url_card_first_slug(slugs: list[str]) -> str | None:
    if not slugs:
        return None
    return illu.cdn_wikimg_url_for_filename(f"Crk_card_{slugs[0]}.png")


def main() -> None:
    ap = argparse.ArgumentParser(description="Import CRK card art from Cookie Run Wiki")
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
    card_ov = load_card_overrides()
    rows = illu.load_char_rows()
    if args.name:
        rows = [r for r in rows if r["name"] == args.name]
        if not rows:
            print("No character named", args.name, file=sys.stderr)
            sys.exit(1)

    os.makedirs(CARDS_DIR, exist_ok=True)
    display_by_name = {r["name"]: r.get("displayName") or r["name"] for r in rows}

    planned: list[tuple[str, str, list[str], list[str]]] = []
    all_titles: list[str] = []
    for r in rows:
        name = r["name"]
        slugs = wiki_asset_candidate_slugs(
            name, display_by_name[name], illustration_ov, card_ov
        )
        titles = card_file_titles(slugs)
        dest = os.path.join(CARDS_DIR, local_card_filename(name))
        planned.append((name, dest, titles, slugs))
        all_titles.extend(titles)

    title_to_info = illu._batch_query_titles(list(dict.fromkeys(all_titles)))

    missing_api: list[str] = []
    downloaded = 0
    upgraded = 0
    skipped_ok = 0
    failed = 0

    for name, dest, titles, slugs in planned:
        info, won_title = _pick_best_info(titles, title_to_info)
        url = info["url"] if info else None
        remote_wh: tuple[int, int] | None = None
        if info and info.get("width") is not None and info.get("height") is not None:
            remote_wh = (info["width"], info["height"])

        if not url and args.fallback_hash_url:
            url = cdn_url_card_first_slug(slugs)

        if not url:
            missing_api.append(name)
            print("  [no wiki file]", name, " ; ".join(titles))
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
