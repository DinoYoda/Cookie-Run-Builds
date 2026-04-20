#!/usr/bin/env python3
"""
Download Cookie Run: Kingdom status effect icons from the Cookie Run Wiki.

Wiki files follow Template:Status: [[File:Status <Name>.png|…]]
(API lists them as names like Status_<Name>.png with underscores.)

Saved under crk/pictures/icons/status/ as:
  status_<Basename>.png
where Basename matches char-ui.js (each underscore segment: first char uppercased, rest unchanged).

Also picks up overlay icons such as Status_Undispellable_Buff.png → status_Undispellable_Buff.png.

Optional: tools/wiki_status_icon_overrides.json maps wiki image name (e.g. Status_Earth27s_Protection.png)
to a local filename (e.g. status_Earth's_Protection.png) when the wiki filename encoding does not
match the site status{…} id.

Usage:
  python import_wiki_status_icons.py
  python import_wiki_status_icons.py --dry-run
  python import_wiki_status_icons.py --force
  python import_wiki_status_icons.py --max 20 # first N wiki images only (testing)

Requires: Python 3.9+
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse

import import_wiki_illustrations as illu

ROOT = illu.ROOT
STATUS_ICON_DIR = os.path.join(ROOT, "crk", "pictures", "icons", "status")
OVERRIDES_PATH = os.path.join(ROOT, "tools", "wiki_status_icon_overrides.json")
WIKI_NAME_PREFIX = "Status_"


def load_overrides() -> dict[str, str]:
    if not os.path.isfile(OVERRIDES_PATH):
        return {}
    with open(OVERRIDES_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k).strip(): str(v).strip() for k, v in raw.items()}


def site_status_icon_basename(status_id: str) -> str:
    """Match char-ui.js segment casing for status_* icon filenames."""
    parts = status_id.split("_")
    out: list[str] = []
    for w in parts:
        if not w:
            out.append(w)
        else:
            out.append(w[0].upper() + w[1:])
    return "_".join(out)


def wiki_middle_from_api_name(name: str) -> str | None:
    """API 'name' is like Status_Burn.png → middle part used as status id stem."""
    if not name.lower().endswith(".png"):
        return None
    stem = name[:-4]
    if not stem.startswith(WIKI_NAME_PREFIX):
        return None
    return stem[len(WIKI_NAME_PREFIX) :]


def local_dest_for_wiki_name(wiki_name: str, overrides: dict[str, str]) -> str | None:
    mid = wiki_middle_from_api_name(wiki_name)
    if mid is None:
        return None
    if wiki_name in overrides:
        base = overrides[wiki_name]
        if not base.lower().endswith(".png"):
            base = f"{base}.png"
        return os.path.join(STATUS_ICON_DIR, base)
    b = site_status_icon_basename(mid)
    return os.path.join(STATUS_ICON_DIR, f"status_{b}.png")


def iter_allimages_status_png(aiprefix: str) -> list[dict]:
    """allimages with url/size; paginate via continue."""
    out: list[dict] = []
    cont: dict[str, str] = {}
    while True:
        params: dict[str, str] = {
            "action": "query",
            "format": "json",
            "list": "allimages",
            "aiprefix": aiprefix,
            "ailimit": "500",
            "aiprop": "url|size",
        }
        params.update(cont)
        req_url = illu.API + "?" + urllib.parse.urlencode(params)
        data = illu.http_json(req_url)
        batch = (data.get("query") or {}).get("allimages") or []
        out.extend(batch)
        if "continue" not in data:
            break
        cont = data["continue"]
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Import CRK status icons from Cookie Run Wiki")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument(
        "--prefix",
        default=WIKI_NAME_PREFIX,
        help=f"allimages aiprefix (default: {WIKI_NAME_PREFIX!r})",
    )
    ap.add_argument(
        "--max",
        type=int,
        default=0,
        help="Only process first N images (0 = all)",
    )
    args = ap.parse_args()

    overrides = load_overrides()
    os.makedirs(STATUS_ICON_DIR, exist_ok=True)

    print("Listing wiki images…", file=sys.stderr)
    rows = iter_allimages_status_png(args.prefix)
    if args.max and args.max > 0:
        rows = rows[: args.max]

    planned: list[tuple[str, str, dict]] = []
    for ai in rows:
        name = ai.get("name") or ""
        dest = local_dest_for_wiki_name(name, overrides)
        if dest is None:
            continue
        planned.append((name, dest, ai))

    downloaded = 0
    upgraded = 0
    skipped_ok = 0
    failed = 0
    missing_url = 0

    for wiki_name, dest, ai in planned:
        url = ai.get("url")
        if not url:
            missing_url += 1
            print("  [no url]", wiki_name, file=sys.stderr)
            continue
        rw, rh = ai.get("width"), ai.get("height")
        remote_wh: tuple[int, int] | None = None
        if rw is not None and rh is not None:
            remote_wh = (int(rw), int(rh))
        remote_px = illu.pixels(remote_wh)

        exists_nonempty = os.path.isfile(dest) and os.path.getsize(dest) > 0
        local_wh = illu.png_dimensions_from_path(dest) if exists_nonempty else None
        local_px = illu.pixels(local_wh)

        def should_fetch() -> tuple[bool, str]:
            if args.force:
                return True, "force"
            if not exists_nonempty:
                return True, "no local file (or empty)"
            if local_wh is None:
                return True, "local file exists but is not a valid PNG"
            if remote_px is None:
                return True, "remote dims unknown (verify after download)"
            if remote_px > local_px:
                return True, f"upgrade {local_wh[0]}x{local_wh[1]} -> {remote_wh[0]}x{remote_wh[1]}"
            return False, "up to date"

        do_fetch, reason = should_fetch()
        label = f"{wiki_name} -> {os.path.basename(dest)}"

        if args.dry_run:
            if do_fetch:
                rw2, rh2 = remote_wh if remote_wh else ("?", "?")
                print(f"  [dry-run fetch] {label} ({reason}) wiki ~{rw2}x{rh2}")
                downloaded += 1
            else:
                lw, lh = local_wh if local_wh else (0, 0)
                rrw, rrh = remote_wh if remote_wh else ("?", "?")
                print(f"  [dry-run skip] {label} local {lw}x{lh} wiki {rrw}x{rrh}")
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
                        f"  [skip smaller or same] {label} local {local_wh[0]}x{local_wh[1]} kept; "
                        f"remote {dl_wh[0]}x{dl_wh[1]}"
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
                print(f"  [upgraded] {label} ({reason})")
            else:
                downloaded += 1
                print(f"  [saved] {label} ({reason})")
        except urllib.error.HTTPError as e:
            print("  [http]", label, e.code, url)
            failed += 1
        except OSError as e:
            print("  [io]", label, e)
            failed += 1

    if args.dry_run:
        print(
            f"Done (dry-run). would_fetch={downloaded} would_skip={skipped_ok} "
            f"missing_url={missing_url} failed={failed} total_listed={len(planned)}"
        )
    else:
        print(
            f"Done. new={downloaded} upgraded={upgraded} skipped={skipped_ok} "
            f"missing_url={missing_url} failed={failed} total={len(planned)}"
        )


if __name__ == "__main__":
    main()
