#!/usr/bin/env python3
"""
Import Magic Candy and Crystal Jam *gallery* PNGs from the Cookie Run Wiki.

Wiki files (per cookie slug, not Crk_ skill icons):
  MC:  File:<slug>_mc_lv<n>.png
       e.g. https://cookierun.wiki/.../Tea_knight_mc_lv2.png
  CJ:  File:<slug>_cj_lv<n>.png  (wiki uses “cj”; game files on the wiki follow this)
       e.g. https://cookierun.wiki/.../Wind_archer_cj_lv3.png

Local paths (data.js `name` must match your UI paths):
  MC: crk/pictures/candy/<name>_mc_lv<n>.png
  CJ: crk/pictures/jam/<name>_mc_lv<n>.png   (**same _mc_lv* basename as candy**; only the
      folder differs. Fetched from wiki *_cj_lv*.)

For every included cookie, the script **always** requests all three gallery tiers from the wiki.

Which cookies (default — from data.js via tools/extract_crk_characters.mjs):
  MC: `hasMc`  ⇔ truthy `mcSkill` on the character in data.js
  CJ: `hasCj`  ⇔ truthy `cjSkill` on the character in data.js

Optional `--infer-extra-from-disk` **adds** cookies implied by existing pngs (candy/*_mc_lv3.png,
skills/*_cj_skill.png, jam/*_mc_lv3.png / *_cj_lv3.png) on top of data.js.

Slug candidates (same as skill/card importers — best resolution wins):
  wiki_asset_candidate_slugs + tools/wiki_skill_slug_overrides.json

If the wiki has no file for a given level, that pair is counted as missing (not a hard error).

Usage:
  python import_wiki_candy.py
  python import_wiki_candy.py --dry-run
  python import_wiki_candy.py --only mc
  python import_wiki_candy.py --only cj
  python import_wiki_candy.py --name Wind_archer
  python import_wiki_candy.py --no-cdn-fallback   # only trust wiki API URLs
  python import_wiki_candy.py --infer-extra-from-disk

Requires: Node.js, Python 3.9+
"""

from __future__ import annotations

import argparse
import glob
import os
import sys
import urllib.error

import import_wiki_illustrations as illu
from import_wiki_skill_icons import (
    _pick_best_info,
    load_skill_overrides,
    wiki_asset_candidate_slugs,
)

ROOT = illu.ROOT
CANDY_DIR = os.path.join(ROOT, "crk", "pictures", "candy")
JAM_DIR = os.path.join(ROOT, "crk", "pictures", "jam")
SKILLS_DIR = os.path.join(ROOT, "crk", "pictures", "skills")

# Gallery art exists at lv1–lv3 on the wiki; fetch all so local assets stay complete.
MC_LEVELS: tuple[int, ...] = (1, 2, 3)
CJ_LEVELS: tuple[int, ...] = (1, 2, 3)


def dest_display(dest: str) -> str:
    return os.path.relpath(dest, ROOT).replace(os.sep, "/")


def _canonical_name_from_stem(stem: str, by_lower: dict[str, str]) -> str | None:
    """Map filename stem (any casing) to data.js `name`."""
    if stem in by_lower.values():
        return stem
    return by_lower.get(stem.lower())


def names_from_candy_lv3(rows: list[dict]) -> set[str]:
    """Cookie `name` values implied by existing magic-candy card assets (lv3)."""
    by_lower = {r["name"].lower(): r["name"] for r in rows}
    out: set[str] = set()
    pattern = os.path.join(CANDY_DIR, "*_mc_lv3.png")
    for path in glob.glob(pattern):
        base = os.path.basename(path)
        suf = "_mc_lv3.png"
        if base.endswith(suf):
            stem = base[: -len(suf)]
            canon = _canonical_name_from_stem(stem, by_lower)
            if canon:
                out.add(canon)
    return out


def names_from_jam_lv3(rows: list[dict]) -> set[str]:
    """CJ cookies implied by existing jam assets (site uses _mc_lv3; older runs may have _cj_lv3)."""
    by_lower = {r["name"].lower(): r["name"] for r in rows}
    out: set[str] = set()
    if not os.path.isdir(JAM_DIR):
        return out
    for suf in ("_mc_lv3.png", "_cj_lv3.png"):
        pattern = os.path.join(JAM_DIR, f"*{suf}")
        for path in glob.glob(pattern):
            base = os.path.basename(path)
            if base.endswith(suf):
                stem = base[: -len(suf)]
                canon = _canonical_name_from_stem(stem, by_lower)
                if canon:
                    out.add(canon)
    return out


def names_from_cj_skill_png(rows: list[dict]) -> set[str]:
    """CJ cookies implied by existing Crk CJ skill icons (matches import_wiki_skill_icons output)."""
    by_lower = {r["name"].lower(): r["name"] for r in rows}
    out: set[str] = set()
    if not os.path.isdir(SKILLS_DIR):
        return out
    pattern = os.path.join(SKILLS_DIR, "*_cj_skill.png")
    for path in glob.glob(pattern):
        base = os.path.basename(path)
        suf = "_cj_skill.png"
        if not base.endswith(suf):
            continue
        stem = base[: -len(suf)]
        canon = _canonical_name_from_stem(stem, by_lower)
        if canon:
            out.add(canon)
    return out


def gallery_titles(slugs: list[str], wiki_kind: str, level: int) -> list[str]:
    # wiki_kind: "mc" (magic candy) or "cj" (crystal jam) — must match wiki filenames.
    return [f"File:{s}_{wiki_kind}_lv{level}.png" for s in slugs]


def cdn_url_gallery(slug: str, wiki_kind: str, level: int) -> str:
    return illu.cdn_wikimg_url_for_filename(f"{slug}_{wiki_kind}_lv{level}.png")


def main() -> None:
    ap = argparse.ArgumentParser(
        description=(
            "Import Magic Candy / Crystal Jam gallery PNGs from Cookie Run Wiki "
            "(levels 1–3 for each cookie)"
        )
    )
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--name", help="Only this data.js cookie name")
    ap.add_argument(
        "--only",
        choices=("all", "mc", "cj"),
        default="all",
        help="Gallery type (default: all)",
    )
    ap.add_argument(
        "--no-cdn-fallback",
        action="store_true",
        help="Do not use cdn.wikimg.net md5 URL when the wiki API returns no file",
    )
    ap.add_argument("--verbose", action="store_true", help="Log each missing wiki file")
    ap.add_argument(
        "--infer-extra-from-disk",
        action="store_true",
        help="Also union cookies implied by existing pngs under candy/, skills/, jam/",
    )
    args = ap.parse_args()

    illustration_ov = illu.load_overrides()
    skill_ov = load_skill_overrides()
    rows = illu.load_char_rows()
    if args.name:
        rows = [r for r in rows if r["name"] == args.name]
        if not rows:
            print("No character named", args.name, file=sys.stderr)
            sys.exit(1)

    display_by_name = {r["name"]: r.get("displayName") or r["name"] for r in rows}

    mc_names: set[str] = set()
    cj_names: set[str] = set()
    for r in rows:
        if r.get("hasMc"):
            mc_names.add(r["name"])
        if r.get("hasCj"):
            cj_names.add(r["name"])
    if args.infer_extra_from_disk:
        mc_names |= names_from_candy_lv3(rows)
        cj_names |= names_from_jam_lv3(rows)
        cj_names |= names_from_cj_skill_png(rows)

    planned: list[dict] = []
    all_titles: list[str] = []

    process_names: set[str] = set()
    if args.only in ("all", "mc"):
        process_names |= mc_names
    if args.only in ("all", "cj"):
        process_names |= cj_names

    for name in sorted(process_names):
        r = next((x for x in rows if x["name"] == name), None)
        if r is None:
            if args.verbose:
                print("  [skip unknown name]", name, file=sys.stderr)
            continue
        slugs = wiki_asset_candidate_slugs(
            name, display_by_name[name], illustration_ov, skill_ov
        )

        if args.only in ("all", "mc") and name in mc_names:
            for lv in MC_LEVELS:
                titles = gallery_titles(slugs, "mc", lv)
                dest = os.path.join(CANDY_DIR, f"{name}_mc_lv{lv}.png")
                planned.append(
                    {
                        "name": name,
                        "kind": "mc",
                        "level": lv,
                        "dest": dest,
                        "titles": titles,
                        "slugs": slugs,
                    }
                )
                all_titles.extend(titles)

        if args.only in ("all", "cj") and name in cj_names:
            for lv in CJ_LEVELS:
                titles = gallery_titles(slugs, "cj", lv)
                dest = os.path.join(JAM_DIR, f"{name}_mc_lv{lv}.png")
                planned.append(
                    {
                        "name": name,
                        "kind": "cj",
                        "level": lv,
                        "dest": dest,
                        "titles": titles,
                        "slugs": slugs,
                    }
                )
                all_titles.extend(titles)

    if not planned:
        print(
            "No gallery items planned. Add mcSkill / cjSkill in data.js (see tools/extract_crk_characters.mjs), "
            "or try --infer-extra-from-disk, and check --only.",
            file=sys.stderr,
        )
        sys.exit(1)

    title_to_info = illu._batch_query_titles(list(dict.fromkeys(all_titles)))

    missing_wiki = 0
    downloaded = 0
    upgraded = 0
    skipped_ok = 0
    failed = 0

    for item in planned:
        name = item["name"]
        kind = item["kind"]
        level = item["level"]
        dest = item["dest"]
        titles = item["titles"]
        slugs = item["slugs"]
        tag = f"[{kind} lv{level}]"

        info, won_title = _pick_best_info(titles, title_to_info)
        url = info["url"] if info else None
        remote_wh: tuple[int, int] | None = None
        if info and info.get("width") is not None and info.get("height") is not None:
            remote_wh = (info["width"], info["height"])

        if not url and slugs and not args.no_cdn_fallback:
            wiki_kind = "cj" if kind == "cj" else "mc"
            url = cdn_url_gallery(slugs[0], wiki_kind, level)

        if not url:
            missing_wiki += 1
            if args.verbose:
                print("  [no wiki file]", name, tag, "; ".join(titles))
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
        won_short = (
            won_title.replace("File:", "").replace(" ", "_")
            if won_title
            else "?"
        )

        if args.dry_run:
            rw, rh = remote_wh if remote_wh else ("?", "?")
            if do_fetch:
                print(
                    f"  [dry-run fetch] {name} {tag} ({reason}) wiki ~{rw}x{rh} via {won_short} -> {dest_display(dest)}"
                )
                downloaded += 1
            else:
                lw, lh = local_wh if local_wh else (0, 0)
                print(
                    f"  [dry-run skip] {name} {tag} local {lw}x{lh} >= wiki {rw}x{rh} ({dest_display(dest)})"
                )
                skipped_ok += 1
            continue

        if not do_fetch:
            skipped_ok += 1
            continue

        try:
            data = illu.http_bytes(url)
            if len(data) < 200:
                print("  [tiny response]", name, tag, len(data), "bytes", url)
                failed += 1
                continue
            dl_wh = illu.png_dimensions_from_bytes(data)
            if dl_wh is None:
                print("  [not a PNG]", name, tag, url)
                failed += 1
                continue
            dl_px = illu.pixels(dl_wh)
            if not args.force and exists_nonempty and local_wh is not None:
                if dl_px <= local_px:
                    print(
                        f"  [skip smaller or same] {name} {tag} local {local_wh[0]}x{local_wh[1]} kept; remote {dl_wh[0]}x{dl_wh[1]} ({dest_display(dest)})"
                    )
                    skipped_ok += 1
                    continue

            tmp = dest + ".tmp"
            with open(tmp, "wb") as f:
                f.write(data)
            os.replace(tmp, dest)
            if exists_nonempty and local_wh is not None:
                upgraded += 1
                print(f"  [upgraded] {name} {tag} {reason} ({won_short}) -> {dest_display(dest)}")
            else:
                downloaded += 1
                print(f"  [saved] {name} {tag} {reason} ({won_short}) -> {dest_display(dest)}")
        except urllib.error.HTTPError as e:
            print("  [http]", name, tag, e.code, url)
            failed += 1
        except OSError as e:
            print("  [io]", name, tag, e)
            failed += 1

    if args.dry_run:
        print(
            f"Done (dry-run). items={len(planned)} would_fetch={downloaded} would_skip={skipped_ok} "
            f"missing_wiki={missing_wiki} failed={failed}"
        )
    else:
        print(
            f"Done. items={len(planned)} new={downloaded} upgraded={upgraded} skipped={skipped_ok} "
            f"missing_wiki={missing_wiki} failed={failed}"
        )


if __name__ == "__main__":
    main()
