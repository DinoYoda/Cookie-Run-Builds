#!/usr/bin/env python3
"""
Download Cookie Run: Kingdom cookie illustrations from the Cookie Run Wiki CDN.

Wiki files follow: Crk_illustration_<slug>.png (slug is lowercase snake_case).
URLs are resolved via the MediaWiki API (returns the correct cdn.wikimg.net path).

Saved locally as: crk/pictures/chars/<data.js name>_illustration.png
(same naming as char-ui.js getPageImagePath).

By default, replaces an existing file only when the wiki image has strictly more pixels
(width * height) than the current PNG, or when the file is missing / not a valid PNG.

Usage:
  python import_wiki_illustrations.py              # fill missing + upgrade lower-res
  python import_wiki_illustrations.py --force      # replace every file regardless of size
  python import_wiki_illustrations.py --dry-run    # print plan only
  python import_wiki_illustrations.py --name Shadow_milk   # one cookie (data.js name)

Requires: Node.js (reads data.js), Python 3.9+

Optional: tools/wiki_illustration_slug_overrides.json
  { "Sonic": "sonic" }   # force wiki slug when auto guess is wrong

Awakened Ancient cookies (name starts with Awakened_): wiki slug is derived from
displayName — drop the literal " Cookie (" … ")" wrapper, concatenate the outer name
and the parenthetical, lowercase, non-alphanumerics -> underscores.
  e.g. "Dark Cacao Cookie (Dragon Lord)" -> dark_cacao_dragon_lord

If the primary File: title has no image, a second lookup uses the full displayName
(lower case, spaces/punctuation -> underscores), e.g. "Clover Cookie" -> clover_cookie.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import struct
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
CHARS_DIR = os.path.join(ROOT, "crk", "pictures", "chars")
EXTRACT_SCRIPT = os.path.join(ROOT, "tools", "extract_crk_characters.mjs")
OVERRIDES_PATH = os.path.join(ROOT, "tools", "wiki_illustration_slug_overrides.json")

API = "https://cookierun.wiki/mw/api.php"
CDN_BASE = "https://cdn.wikimg.net/en/cookierunwiki/images/"

UA = "CRK-Tierlist-site/1.0 (local import script; +https://github.com/DinoYoda/Cookie-Run-Builds)"


def http_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def http_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def cdn_wikimg_url_for_filename(filename: str) -> str:
    """
    Build cdn.wikimg.net URL for an exact wiki filename (e.g. Crk_skill_schwarzwälder.png).
    MD5 uses UTF-8 bytes of that string; the URL path must be percent-encoded — http.client
    encodes the request line as ASCII only.
    """
    h = hashlib.md5(filename.encode("utf-8")).hexdigest()
    enc = urllib.parse.quote(filename, safe="")
    return CDN_BASE + f"{h[0]}/{h[0:2]}/" + enc


def cookie_name_to_wiki_slug(name: str) -> str:
    """Map data.js `name` (e.g. Shadow_milk, Gingerbrave) to wiki file slug."""
    s = name.strip()
    s = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", s)
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    slug = s.lower()
    slug = re.sub(r"_+", "_", slug).strip("_")
    return slug


def awakened_ancient_display_to_slug(display_name: str) -> str | None:
    """
    Cookie Run Wiki awakened ancient illustrations use displayName with the
    " Cookie (Subtitle)" segment flattened: "<Name> <Subtitle>", lowercased, underscores.

    "Dark Cacao Cookie (Dragon Lord)" -> dark_cacao_dragon_lord
    """
    m = re.match(r"^(.+) Cookie \(([^)]+)\)\s*$", display_name.strip())
    if not m:
        return None
    combined = f"{m.group(1).strip()} {m.group(2).strip()}"
    s = combined.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or None


def wiki_illustration_slug(name: str, display_name: str, overrides: dict[str, str]) -> str:
    """Resolve wiki filename slug (without Crk_illustration_ / .png)."""
    if name in overrides:
        return overrides[name]
    if name.startswith("Awakened_"):
        slug = awakened_ancient_display_to_slug(display_name)
        if slug:
            return slug
    return cookie_name_to_wiki_slug(name)


def display_name_plain_slug(display_name: str) -> str:
    """Lowercase displayName with non-alphanumerics -> underscores (e.g. Clover Cookie -> clover_cookie)."""
    s = display_name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def display_name_unicode_slug(display_name: str) -> str:
    """
    Lowercase display label; separators -> underscores but keep letters outside [a-z]
    (e.g. Schwarzwälder -> schwarzwälder for Crk_skill_schwarzwälder.png on the wiki).
    """
    s = display_name.strip().lower()
    s = re.sub(r"[\W_]+", "_", s, flags=re.UNICODE)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def cdn_url_from_slug(slug: str) -> str:
    """Build CDN URL using MediaWiki's md5 hash layout (fallback if API unavailable)."""
    return cdn_wikimg_url_for_filename(f"Crk_illustration_{slug}.png")


def load_char_rows() -> list[dict]:
    if not os.path.isfile(EXTRACT_SCRIPT):
        print("Missing", EXTRACT_SCRIPT, file=sys.stderr)
        sys.exit(1)
    proc = subprocess.run(
        ["node", EXTRACT_SCRIPT],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        sys.exit(proc.returncode)
    return json.loads(proc.stdout)


def load_overrides() -> dict[str, str]:
    if not os.path.isfile(OVERRIDES_PATH):
        return {}
    with open(OVERRIDES_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k): str(v) for k, v in raw.items()}


def api_query_image_info(titles: list[str]) -> dict[str, dict | None]:
    """Map each *requested* File: title to {url, width, height} or None. Handles normalization."""
    params = {
        "action": "query",
        "format": "json",
        "titles": "|".join(titles),
        "prop": "imageinfo",
        "iiprop": "url|size",
    }
    req_url = API + "?" + urllib.parse.urlencode(params)
    data = http_json(req_url)
    query = data.get("query", {})
    norm = {n["from"]: n["to"] for n in (query.get("normalized") or [])}

    canonical_to_info: dict[str, dict | None] = {}
    for _pid, page in query.get("pages", {}).items():
        t = page.get("title", "")
        if page.get("missing") or "imageinfo" not in page:
            canonical_to_info[t] = None
            continue
        infos = page["imageinfo"]
        if not infos:
            canonical_to_info[t] = None
            continue
        ii = infos[0]
        u = ii.get("url")
        if not u:
            canonical_to_info[t] = None
            continue
        w = ii.get("width")
        h = ii.get("height")
        canonical_to_info[t] = {
            "url": u,
            "width": int(w) if w is not None else None,
            "height": int(h) if h is not None else None,
        }

    out: dict[str, dict | None] = {}
    for req in titles:
        canon = norm.get(req, req)
        out[req] = canonical_to_info.get(canon)
    return out


def png_dimensions_from_bytes(data: bytes) -> tuple[int, int] | None:
    """Read width, height from PNG IHDR; returns None if not a PNG."""
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    # First chunk: 4-byte length, 4-byte type, then IHDR payload
    if data[12:16] != b"IHDR":
        return None
    w, h = struct.unpack(">II", data[16:24])
    if w <= 0 or h <= 0:
        return None
    return w, h


def png_dimensions_from_path(path: str) -> tuple[int, int] | None:
    try:
        with open(path, "rb") as f:
            head = f.read(32 * 1024)
    except OSError:
        return None
    return png_dimensions_from_bytes(head)


def pixels(wh: tuple[int, int] | None) -> int | None:
    if wh is None:
        return None
    return wh[0] * wh[1]


def _info_ok(info: dict | None) -> bool:
    return bool(info and info.get("url"))


def _batch_query_titles(titles: list[str], batch_size: int = 50) -> dict[str, dict | None]:
    out: dict[str, dict | None] = {}
    for i in range(0, len(titles), batch_size):
        out.update(api_query_image_info(titles[i : i + batch_size]))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Import CRK illustrations from Cookie Run Wiki CDN")
    ap.add_argument("--dry-run", action="store_true", help="Do not download; print actions")
    ap.add_argument("--force", action="store_true", help="Overwrite existing PNGs")
    ap.add_argument("--name", help="Only this data.js cookie name (e.g. Shadow_milk)")
    ap.add_argument("--fallback-hash-url", action="store_true", help="If API misses, try md5 CDN URL")
    args = ap.parse_args()

    overrides = load_overrides()
    rows = load_char_rows()
    if args.name:
        rows = [r for r in rows if r["name"] == args.name]
        if not rows:
            print("No character named", args.name, file=sys.stderr)
            sys.exit(1)

    os.makedirs(CHARS_DIR, exist_ok=True)

    display_by_name = {r["name"]: r.get("displayName") or r["name"] for r in rows}

    # (name, dest, primary File:title, alt File:title or None)
    planned: list[tuple[str, str, str, str | None]] = []
    for r in rows:
        name = r["name"]
        display_name = display_by_name[name]
        primary_slug = wiki_illustration_slug(name, display_name, overrides)
        primary_title = f"File:Crk_illustration_{primary_slug}.png"
        alt_slug = display_name_plain_slug(display_name)
        alt_title = (
            f"File:Crk_illustration_{alt_slug}.png"
            if alt_slug != primary_slug
            else None
        )
        dest = os.path.join(CHARS_DIR, f"{name}_illustration.png")
        planned.append((name, dest, primary_title, alt_title))

    primary_titles = [p[2] for p in planned]
    title_to_info = _batch_query_titles(primary_titles)

    alt_needed: list[str] = []
    for _name, _dest, primary_title, alt_title in planned:
        if not _info_ok(title_to_info.get(primary_title)) and alt_title:
            alt_needed.append(alt_title)
    if alt_needed:
        title_to_info.update(_batch_query_titles(list(dict.fromkeys(alt_needed))))

    missing_api: list[str] = []
    downloaded = 0
    upgraded = 0
    skipped_ok = 0
    failed = 0

    for name, dest, primary_title, alt_title in planned:
        info = title_to_info.get(primary_title)
        if not _info_ok(info) and alt_title:
            alt_info = title_to_info.get(alt_title)
            if _info_ok(alt_info):
                info = alt_info
        url = info["url"] if info else None
        remote_wh: tuple[int, int] | None = None
        if info and info.get("width") is not None and info.get("height") is not None:
            remote_wh = (info["width"], info["height"])

        if not url and args.fallback_hash_url:
            slug = wiki_illustration_slug(name, display_by_name[name], overrides)
            url = cdn_url_from_slug(slug)

        if not url:
            missing_api.append(name)
            tried = primary_title + (f" ; {alt_title}" if alt_title else "")
            print("  [no wiki file]", name, tried)
            continue

        exists_nonempty = os.path.isfile(dest) and os.path.getsize(dest) > 0
        local_wh = png_dimensions_from_path(dest) if exists_nonempty else None
        local_px = pixels(local_wh)
        remote_px = pixels(remote_wh)

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

        if args.dry_run:
            rw, rh = remote_wh if remote_wh else ("?", "?")
            if do_fetch:
                print(
                    f"  [dry-run fetch] {name} ({reason}) wiki ~{rw}x{rh} -> {os.path.basename(dest)}"
                )
            else:
                lw, lh = local_wh if local_wh else (0, 0)
                print(
                    f"  [dry-run skip] {name} local {lw}x{lh} >= wiki {rw}x{rh}"
                )
            if do_fetch:
                downloaded += 1
            else:
                skipped_ok += 1
            continue

        if not do_fetch:
            skipped_ok += 1
            continue

        try:
            data = http_bytes(url)
            if len(data) < 200:
                print("  [tiny response]", name, len(data), "bytes", url)
                failed += 1
                continue
            dl_wh = png_dimensions_from_bytes(data)
            if dl_wh is None:
                print("  [not a PNG]", name, url)
                failed += 1
                continue
            dl_px = pixels(dl_wh)
            # If API had no dimensions, decide upgrade using downloaded bytes only
            if not args.force and exists_nonempty and local_wh is not None:
                if dl_px <= local_px:
                    print(
                        f"  [skip smaller or same] {name} local {local_wh[0]}x{local_wh[1]} kept; remote file {dl_wh[0]}x{dl_wh[1]}"
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
                print(f"  [upgraded] {name} {reason}")
            else:
                downloaded += 1
                print(f"  [saved] {name} {reason}")
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
    if missing_api and not args.fallback_hash_url:
        print("Tip: retry with --fallback-hash-url for pages API does not list yet", file=sys.stderr)


if __name__ == "__main__":
    main()
