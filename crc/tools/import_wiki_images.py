#!/usr/bin/env python3
"""
Download Cookie Run: Crumble assets from the Cookie Run Wiki CDN.

Wiki files (Gallery / character pages):
  File:Cc_illustration_<slug>.png
  File:Cc_head_<slug>.png
  File:Cc_skill_<slug>.png
  File:Cc_thumbnail_<slug>.png   (rectangular list/tier card art)

Local paths (match char-ui.js / ui.js):
  crc/pictures/cards/<name>_card.png
  crc/pictures/chars/<name>_illustration.png
  crc/pictures/icons/cookie/<name>_head.png
  crc/pictures/skills/<name>_skill.png

By default, only cookies already listed in crc/data.js are imported.
Use --from-wiki-list to discover cookies from List of Cookies/Crumble.

Usage:
  python crc/tools/import_wiki_images.py
  python crc/tools/import_wiki_images.py --dry-run
  python crc/tools/import_wiki_images.py --name Strawberry
  python crc/tools/import_wiki_images.py --only card head skill
  python crc/tools/import_wiki_images.py --from-wiki-list --force

Requires: Node.js, Python 3.9+

Optional: crc/tools/wiki_image_slug_overrides.json  { "CookieName": "wiki_slug" }
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
import urllib.error
from typing import Callable

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CRC_TOOLS = os.path.dirname(os.path.abspath(__file__))
CRK_TOOLS = os.path.join(ROOT, "crk", "tools")
if CRK_TOOLS not in sys.path:
    sys.path.insert(0, CRK_TOOLS)

import import_wiki_illustrations as illu

SLUG_OVERRIDES_PATH = os.path.join(CRC_TOOLS, "wiki_image_slug_overrides.json")
IMPORT_COOKIE_DATA = os.path.join(CRC_TOOLS, "import_wiki_cookie_data.py")

ASSET_KINDS: dict[str, dict[str, str]] = {
    "card": {
        "wiki_prefix": "Cc_thumbnail_",
        "dest_dir": os.path.join(ROOT, "crc", "pictures", "cards"),
        "local_suffix": "_card.png",
    },
    "illustration": {
        "wiki_prefix": "Cc_illustration_",
        "dest_dir": os.path.join(ROOT, "crc", "pictures", "chars"),
        "local_suffix": "_illustration.png",
    },
    "head": {
        "wiki_prefix": "Cc_head_",
        "dest_dir": os.path.join(ROOT, "crc", "pictures", "icons", "cookie"),
        "local_suffix": "_head.png",
    },
    "skill": {
        "wiki_prefix": "Cc_skill_",
        "dest_dir": os.path.join(ROOT, "crc", "pictures", "skills"),
        "local_suffix": "_skill.png",
    },
}


def load_cookie_rows(*, from_data: bool = True) -> list[dict]:
    spec = importlib.util.spec_from_file_location("crc_import_wiki_cookie_data", IMPORT_COOKIE_DATA)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {IMPORT_COOKIE_DATA}")
    imp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(imp)
    return imp.load_char_rows(from_data=from_data)


def load_slug_overrides() -> dict[str, str]:
    if not os.path.isfile(SLUG_OVERRIDES_PATH):
        return {}
    with open(SLUG_OVERRIDES_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k): str(v) for k, v in raw.items()}


def display_name_short(display_name: str) -> str:
    s = (display_name or "").strip()
    if s.lower().endswith(" cookie"):
        return s[: -len(" Cookie")].strip()
    return s


def wiki_cc_slug_candidates(
    name: str,
    display_name: str,
    overrides: dict[str, str],
) -> list[str]:
    if name in overrides:
        return [overrides[name]]
    out: list[str] = []

    def add(slug: str) -> None:
        slug = (slug or "").strip().lower()
        slug = slug.strip("_")
        if slug and slug not in out:
            out.append(slug)

    short = display_name_short(display_name)
    add(illu.display_name_unicode_slug(short))
    add(illu.display_name_plain_slug(short))
    if short != display_name:
        add(illu.display_name_unicode_slug(display_name))
        add(illu.display_name_plain_slug(display_name))
    add(illu.cookie_name_to_wiki_slug(name))
    for slug in list(out):
        if slug.endswith("_cookie"):
            add(slug[: -len("_cookie")])
    return out


def file_titles_for_slugs(slugs: list[str], wiki_prefix: str) -> list[str]:
    return [f"File:{wiki_prefix}{slug}.png" for slug in slugs]


def pick_first_info(
    titles: list[str], title_to_info: dict[str, dict | None]
) -> tuple[dict | None, str | None]:
    for title in titles:
        info = title_to_info.get(title)
        if illu._info_ok(info):
            return info, title
    return None, None


def cdn_url_for_slug(slug: str, wiki_prefix: str) -> str:
    return illu.cdn_wikimg_url_for_filename(f"{wiki_prefix}{slug}.png")


def fetch_first_cdn_png(slugs: list[str], wiki_prefix: str) -> tuple[bytes, str] | None:
    for slug in slugs:
        url = cdn_url_for_slug(slug, wiki_prefix)
        try:
            data = illu.http_bytes(url)
        except urllib.error.HTTPError:
            continue
        except OSError:
            continue
        if len(data) < 200 or illu.png_dimensions_from_bytes(data) is None:
            continue
        return data, url
    return None


def should_fetch(
    *,
    force: bool,
    dest: str,
    remote_wh: tuple[int, int] | None,
) -> tuple[bool, str]:
    exists_nonempty = os.path.isfile(dest) and os.path.getsize(dest) > 0
    local_wh = illu.png_dimensions_from_path(dest) if exists_nonempty else None
    local_px = illu.pixels(local_wh)
    remote_px = illu.pixels(remote_wh)

    if force:
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


def download_asset(
    *,
    name: str,
    dest: str,
    slugs: list[str],
    wiki_prefix: str,
    title_to_info: dict[str, dict | None],
    dry_run: bool,
    force: bool,
    fallback_hash_url: bool,
    log_missing: Callable[[str, list[str]], None],
) -> tuple[str, bool]:
    titles = file_titles_for_slugs(slugs, wiki_prefix)
    info, won_title = pick_first_info(titles, title_to_info)
    url = info["url"] if info else None
    remote_wh: tuple[int, int] | None = None
    if info and info.get("width") is not None and info.get("height") is not None:
        remote_wh = (info["width"], info["height"])

    if not url and fallback_hash_url:
        hit = fetch_first_cdn_png(slugs, wiki_prefix)
        if hit:
            data, url = hit
            if not dry_run:
                tmp = dest + ".tmp"
                with open(tmp, "wb") as f:
                    f.write(data)
                os.replace(tmp, dest)
            return "saved" if not dry_run else "would_fetch", True

    if not url:
        log_missing(name, titles)
        return "missing", False

    do_fetch, reason = should_fetch(force=force, dest=dest, remote_wh=remote_wh)

    if dry_run:
        rw, rh = remote_wh if remote_wh else ("?", "?")
        if do_fetch:
            print(
                f"  [dry-run fetch] {name} ({reason}) {won_title} ~{rw}x{rh} -> {os.path.basename(dest)}"
            )
            return "would_fetch", True
        local_wh = illu.png_dimensions_from_path(dest) if os.path.isfile(dest) else None
        lw, lh = local_wh if local_wh else (0, 0)
        print(f"  [dry-run skip] {name} local {lw}x{lh} >= wiki {rw}x{rh}")
        return "skipped", True

    if not do_fetch:
        return "skipped", True

    try:
        data = illu.http_bytes(url)
        if len(data) < 200:
            print("  [tiny response]", name, len(data), "bytes", url)
            return "failed", False
        dl_wh = illu.png_dimensions_from_bytes(data)
        if dl_wh is None:
            print("  [not a PNG]", name, url)
            return "failed", False
        dl_px = illu.pixels(dl_wh)
        exists_nonempty = os.path.isfile(dest) and os.path.getsize(dest) > 0
        local_wh = illu.png_dimensions_from_path(dest) if exists_nonempty else None
        local_px = illu.pixels(local_wh)
        if not force and exists_nonempty and local_wh is not None and dl_px <= local_px:
            print(
                f"  [skip smaller or same] {name} local {local_wh[0]}x{local_wh[1]} kept; remote {dl_wh[0]}x{dl_wh[1]}"
            )
            return "skipped", True
        tmp = dest + ".tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, dest)
        if exists_nonempty and local_wh is not None:
            print(f"  [upgraded] {name} {reason}")
            return "upgraded", True
        print(f"  [saved] {name} {reason}")
        return "saved", True
    except urllib.error.HTTPError as e:
        print("  [http]", name, e.code, url)
        return "failed", False
    except OSError as e:
        print("  [io]", name, e)
        return "failed", False


def import_kind(
    kind: str,
    rows: list[dict],
    *,
    dry_run: bool,
    force: bool,
    fallback_hash_url: bool,
) -> dict[str, int]:
    cfg = ASSET_KINDS[kind]
    wiki_prefix = cfg["wiki_prefix"]
    dest_dir = cfg["dest_dir"]
    os.makedirs(dest_dir, exist_ok=True)

    overrides = load_slug_overrides()
    display_by_name = {r["name"]: r.get("displayName") or r["name"] for r in rows}

    planned: list[tuple[str, str, list[str]]] = []
    all_titles: list[str] = []
    for row in rows:
        name = row["name"]
        slugs = wiki_cc_slug_candidates(name, display_by_name[name], overrides)
        dest = os.path.join(dest_dir, f"{name}{cfg['local_suffix']}")
        planned.append((name, dest, slugs))
        all_titles.extend(file_titles_for_slugs(slugs, wiki_prefix))

    title_to_info = illu._batch_query_titles(list(dict.fromkeys(all_titles)))

    stats = {
        "saved": 0,
        "upgraded": 0,
        "skipped": 0,
        "would_fetch": 0,
        "missing": 0,
        "failed": 0,
    }
    missing_names: list[str] = []

    def log_missing(name: str, titles: list[str]) -> None:
        missing_names.append(name)
        print("  [no wiki file]", name, " ; ".join(titles))

    for name, dest, slugs in planned:
        outcome, _ok = download_asset(
            name=name,
            dest=dest,
            slugs=slugs,
            wiki_prefix=wiki_prefix,
            title_to_info=title_to_info,
            dry_run=dry_run,
            force=force,
            fallback_hash_url=fallback_hash_url,
            log_missing=log_missing,
        )
        if outcome in stats:
            stats[outcome] += 1

    label = kind if not dry_run else f"{kind} (dry-run)"
    print(
        f"{label}: "
        f"new={stats['saved']} upgraded={stats['upgraded']} "
        f"skipped={stats['skipped']} would_fetch={stats['would_fetch']} "
        f"missing={stats['missing']} failed={stats['failed']}"
    )
    if missing_names and not fallback_hash_url:
        print("  Tip: retry with --fallback-hash-url for files the API does not list yet", file=sys.stderr)
    return stats


def main() -> None:
    ap = argparse.ArgumentParser(description="Import Crumble wiki images (illustration, head, skill)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--name", help="Only this crc/data.js name")
    ap.add_argument(
        "--from-wiki-list",
        action="store_true",
        help="Discover cookies from List of Cookies/Crumble instead of crc/data.js",
    )
    ap.add_argument(
        "--only",
        nargs="+",
        choices=sorted(ASSET_KINDS),
        metavar="KIND",
        help=f"Asset type(s) to import (default: all). Choices: {', '.join(sorted(ASSET_KINDS))}",
    )
    ap.add_argument(
        "--fallback-hash-url",
        action="store_true",
        help="If the API finds nothing, try CDN md5 URLs for slug candidates",
    )
    args = ap.parse_args()

    rows = load_cookie_rows(from_data=not args.from_wiki_list)
    if args.name:
        rows = [r for r in rows if r["name"] == args.name]
        if not rows:
            print("No character named", args.name, file=sys.stderr)
            sys.exit(1)

    kinds = args.only or sorted(ASSET_KINDS)
    print(f"Importing {len(rows)} cookie(s): {', '.join(kinds)}")
    for kind in kinds:
        import_kind(
            kind,
            rows,
            dry_run=args.dry_run,
            force=args.force,
            fallback_hash_url=args.fallback_hash_url,
        )


if __name__ == "__main__":
    main()
