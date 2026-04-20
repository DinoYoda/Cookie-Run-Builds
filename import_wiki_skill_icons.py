#!/usr/bin/env python3
"""
Download Cookie Run: Kingdom skill icons from the Cookie Run Wiki CDN.

Wiki files:
  Base:     File:Crk_skill_<slug>.png
  MC:       File:Crk_mc_skill_<slug>.png   (Magic Candy)
  CJ:       File:Crk_cj_skill_<slug>.png   (Crystal Jam)

Some uploads use the skill phrase only: File:<SkillName>_skill.png (e.g. Pudding_a_la_mode_skill.png),
matched from data.js `skill` / `mcSkill` after the Crk_* attempts.

Saved under crk/pictures/skills/ as:
  <name>_skill.png, <name>_mc_skill.png, <name>_cj_skill.png
  (matches char-ui.js)

MC/CJ rows are driven by data.js mcSkill / cjSkill (see tools/extract_crk_characters.mjs).
By default, cookies that have `crk/pictures/candy/<name>_mc_lv3.png` are also treated as MC
for icon fetch; cookies with `crk/pictures/jam/<name>_mc_lv3.png` (or `*_cj_lv3.png`) as CJ
(Crystal Jam skill icon → `Crk_cj_skill_*` locally `*_cj_skill.png`). Disable with
`--no-infer-mc-from-candy` / `--no-infer-cj-from-jam`.

Cookies with **cjSkill** do not use the MC wiki path: only `*_cj_skill.png` is fetched, with
API/CDN trying **`Crk_cj_skill_<slug>` first**, then **`Crk_mc_skill_<slug>`** as a fallback
source (still saved under the CJ filename).

Extra slug alternates (e.g. `financier_cookie` → also `financier`) are appended for API/CDN.

If the wiki API returns no file for any candidate title, the importer tries the CDN md5 URL
for **each** slug until one returns a valid PNG (`--no-cdn-fallback` to disable).

Slug candidates (**best resolution** among API hits):
  1) cookie name as wiki slug
  2) If Awakened_*: name without Awakened_ prefix
  3) wiki_illustration_slug (awakened displayName rule + illustration overrides)
  4) display_name_plain_slug (ASCII-ish)
  5) display_name_unicode_slug (keeps ä, è, etc. — matches wiki files like Crk_skill_schwarzwälder.png)

Optional: tools/wiki_skill_slug_overrides.json  { "CookieName": "wiki_slug" }
(Shared slug logic: import_wiki_cards.py uses the same candidate list via wiki_asset_candidate_slugs.)

Same upgrade rules as import_wiki_illustrations.py (PNG dims, WebP-as-PNG, etc.).

Requires: Node.js, Python 3.9+
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
import urllib.error
import urllib.parse

import import_wiki_illustrations as illu
import import_wiki_candy as candy

ROOT = illu.ROOT
SKILLS_DIR = os.path.join(ROOT, "crk", "pictures", "skills")
SKILL_OVERRIDES_PATH = os.path.join(ROOT, "tools", "wiki_skill_slug_overrides.json")

# Wiki filename prefix before <slug>.png
VARIANT_PREFIX = {
    "skill": "Crk_skill_",
    "mc": "Crk_mc_skill_",
    "cj": "Crk_cj_skill_",
}

LOCAL_SUFFIX = {
    "skill": "_skill.png",
    "mc": "_mc_skill.png",
    "cj": "_cj_skill.png",
}


def load_skill_overrides() -> dict[str, str]:
    if not os.path.isfile(SKILL_OVERRIDES_PATH):
        return {}
    with open(SKILL_OVERRIDES_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k): str(v) for k, v in raw.items()}


def wiki_asset_candidate_slugs(
    name: str,
    display_name: str,
    illustration_overrides: dict[str, str],
    slug_overrides: dict[str, str],
) -> list[str]:
    """Candidate wiki filename slugs for skills, cards, and similar Crk_* assets."""
    if name in slug_overrides:
        return [slug_overrides[name]]
    out: list[str] = []

    def add(s: str) -> None:
        if s and s not in out:
            out.append(s)

    add(illu.cookie_name_to_wiki_slug(name))
    if name.startswith("Awakened_"):
        add(illu.cookie_name_to_wiki_slug(name[9:]))
    add(illu.wiki_illustration_slug(name, display_name, illustration_overrides))
    add(illu.display_name_plain_slug(display_name))
    add(illu.display_name_unicode_slug(display_name))
    short = display_name.strip()
    if short.lower().endswith(" cookie"):
        add(illu.display_name_unicode_slug(short[: -len(" Cookie")].strip()))
    return out


def expand_skill_icon_slug_candidates(slugs: list[str]) -> list[str]:
    """Add filename alternates wiki may use (e.g. display slug `foo_cookie` vs `foo`)."""
    out: list[str] = []
    seen: set[str] = set()

    def push(s: str) -> None:
        if s and s not in seen:
            seen.add(s)
            out.append(s)

    for s in slugs:
        push(s)
        if s.endswith("_cookie"):
            push(s[: -len("_cookie")])
    return out


def file_titles_for_variant(slugs: list[str], variant: str) -> list[str]:
    p = VARIANT_PREFIX[variant]
    return [f"File:{p}{s}.png" for s in slugs]


def display_name_without_cookie_suffix(display_name: str) -> str | None:
    """'Pudding à la Mode Cookie' -> 'Pudding à la Mode' (for wiki *SkillName*_skill.png stems)."""
    s = (display_name or "").strip()
    if s.lower().endswith(" cookie"):
        return s[: -len(" Cookie")].strip()
    return None


def skill_phrase_to_wiki_named_icon_stems(phrase: str | None) -> list[str]:
    """
    Wiki sometimes uses File:<Stem>_skill.png with Stem from the skill phrase (underscores, accents folded).
    e.g. 'Pudding à la Mode' -> Pudding_a_la_mode.
    """
    if not phrase or not str(phrase).strip():
        return []
    raw = str(phrase).strip()
    folded = "".join(
        c for c in unicodedata.normalize("NFKD", raw) if not unicodedata.combining(c)
    )
    stems: list[str] = []
    seen_slug: set[str] = set()
    for base in (folded, raw):
        slug = illu.display_name_plain_slug(base)
        if not slug or slug in seen_slug:
            continue
        seen_slug.add(slug)
        stem = slug[0].upper() + slug[1:] if slug else ""
        if stem and stem not in stems:
            stems.append(stem)
    return stems


def merge_named_icon_stems(*phrase_lists: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for lst in phrase_lists:
        for s in lst:
            if s not in seen:
                seen.add(s)
                out.append(s)
    return out


def file_titles_for_named_skill_icons(stems: list[str]) -> list[str]:
    return [f"File:{s}_skill.png" for s in stems]


def fetch_first_cdn_named_skill_png(stems: list[str]) -> tuple[bytes, str] | None:
    for stem in stems:
        fn = f"{stem}_skill.png"
        url = illu.cdn_wikimg_url_for_filename(fn)
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


def _cdn_url_for_slug(slug: str, variant: str) -> str:
    return illu.cdn_wikimg_url_for_filename(f"{VARIANT_PREFIX[variant]}{slug}.png")


def fetch_first_cdn_png(slugs: list[str], variant: str) -> tuple[bytes, str] | None:
    """Download from CDN (md5 path) for each slug until one yields a valid PNG; return (data, url)."""
    for slug in slugs:
        url = _cdn_url_for_slug(slug, variant)
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


def fetch_first_cdn_png_with_fallback(
    slugs: list[str], primary: str, secondary: str | None
) -> tuple[bytes, str] | None:
    hit = fetch_first_cdn_png(slugs, primary)
    if hit or not secondary:
        return hit
    return fetch_first_cdn_png(slugs, secondary)


def _pick_best_info(
    titles: list[str], title_to_info: dict[str, dict | None]
) -> tuple[dict | None, str | None]:
    best: dict | None = None
    best_px = -1
    best_title: str | None = None
    for t in titles:
        inf = title_to_info.get(t)
        if not illu._info_ok(inf):
            continue
        w, h = inf.get("width"), inf.get("height")
        if w is None or h is None:
            px = 0
        else:
            px = int(w) * int(h)
        if px > best_px:
            best_px = px
            best = inf
            best_title = t
    return best, best_title


def _pick_best_info_ordered_groups(
    groups: list[list[str]], title_to_info: dict[str, dict | None]
) -> tuple[dict | None, str | None]:
    """Try each title group in order; prefer first group with any valid hit (e.g. CJ before MC)."""
    for titles in groups:
        inf, won = _pick_best_info(titles, title_to_info)
        if inf:
            return inf, won
    return None, None


def main() -> None:
    ap = argparse.ArgumentParser(description="Import CRK skill icons (base, MC, CJ) from Cookie Run Wiki")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--name", help="Only this data.js cookie name")
    ap.add_argument(
        "--no-cdn-fallback",
        action="store_true",
        help="Do not use cdn.wikimg.net md5 URLs when the API returns no file",
    )
    ap.add_argument(
        "--infer-mc-from-candy",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Also fetch MC icons for cookies with candy/*_mc_lv3.png (default: on)",
    )
    ap.add_argument(
        "--infer-cj-from-jam",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Also fetch CJ icons for cookies with jam/*_mc_lv3.png or *_cj_lv3.png (default: on)",
    )
    ap.add_argument(
        "--only",
        choices=("all", "skill", "mc", "cj"),
        default="all",
        help="Which icon types to fetch (default: all)",
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

    os.makedirs(SKILLS_DIR, exist_ok=True)
    display_by_name = {r["name"]: r.get("displayName") or r["name"] for r in rows}
    mc_from_candy: set[str] = candy.names_from_candy_lv3(rows) if args.infer_mc_from_candy else set()
    cj_from_jam: set[str] = candy.names_from_jam_lv3(rows) if args.infer_cj_from_jam else set()

    planned: list[dict] = []
    all_titles: list[str] = []

    for r in rows:
        name = r["name"]
        slugs = expand_skill_icon_slug_candidates(
            wiki_asset_candidate_slugs(
                name, display_by_name[name], illustration_ov, skill_ov
            )
        )
        has_mc = bool(r.get("hasMc"))
        has_cj = bool(r.get("hasCj"))
        # CJ uses *_cj_skill.png and Crk_cj_skill_*; do not queue MC fetch for CJ-only cookies.
        want_mc = bool(has_mc or (name in mc_from_candy and not has_cj))
        want_cj = bool(has_cj or name in cj_from_jam)
        base_skill = r.get("skill") if isinstance(r.get("skill"), str) else None
        mc_skill = r.get("mcSkill") if isinstance(r.get("mcSkill"), str) else None
        display = display_by_name[name]
        short_display = display_name_without_cookie_suffix(display)

        def add_variant(variant: str) -> None:
            named_stems: list[str] | None = None
            if variant == "cj":
                title_groups = [
                    file_titles_for_variant(slugs, "cj"),
                    file_titles_for_variant(slugs, "mc"),
                ]
            elif variant == "skill":
                title_groups = [file_titles_for_variant(slugs, "skill")]
                stems = merge_named_icon_stems(
                    skill_phrase_to_wiki_named_icon_stems(base_skill),
                    skill_phrase_to_wiki_named_icon_stems(short_display),
                )
                if stems:
                    title_groups.append(file_titles_for_named_skill_icons(stems))
                    named_stems = stems
            elif variant == "mc":
                title_groups = [file_titles_for_variant(slugs, "mc")]
                stems = merge_named_icon_stems(
                    skill_phrase_to_wiki_named_icon_stems(mc_skill),
                    skill_phrase_to_wiki_named_icon_stems(short_display),
                )
                if stems:
                    title_groups.append(file_titles_for_named_skill_icons(stems))
                    named_stems = stems
            else:
                title_groups = [file_titles_for_variant(slugs, variant)]
            titles_flat = [t for g in title_groups for t in g]
            dest = os.path.join(SKILLS_DIR, f"{name}{LOCAL_SUFFIX[variant]}")
            planned.append(
                {
                    "name": name,
                    "variant": variant,
                    "dest": dest,
                    "title_groups": title_groups,
                    "titles": titles_flat,
                    "slugs": slugs,
                    "named_skill_stems": named_stems,
                }
            )
            all_titles.extend(titles_flat)

        if args.only in ("all", "skill"):
            add_variant("skill")
        if args.only in ("all", "mc") and want_mc:
            add_variant("mc")
        if args.only in ("all", "cj") and want_cj:
            add_variant("cj")

    title_to_info = illu._batch_query_titles(list(dict.fromkeys(all_titles)))

    missing_api: list[str] = []
    downloaded = 0
    upgraded = 0
    skipped_ok = 0
    failed = 0

    for item in planned:
        name = item["name"]
        variant = item["variant"]
        dest = item["dest"]
        titles = item["titles"]
        title_groups = item["title_groups"]
        slugs = item["slugs"]
        named_stems: list[str] | None = item.get("named_skill_stems")
        tag = f"[{variant}]"

        info, won_title = _pick_best_info_ordered_groups(title_groups, title_to_info)
        url = info["url"] if info else None
        remote_wh: tuple[int, int] | None = None
        if info and info.get("width") is not None and info.get("height") is not None:
            remote_wh = (info["width"], info["height"])

        cdn_data: bytes | None = None
        if not url and not args.no_cdn_fallback and not args.dry_run:
            if variant == "cj":
                cdn_hit = fetch_first_cdn_png_with_fallback(slugs, "cj", "mc")
            elif variant in ("skill", "mc"):
                cdn_hit = fetch_first_cdn_png(slugs, variant)
                if not cdn_hit and named_stems:
                    cdn_hit = fetch_first_cdn_named_skill_png(named_stems)
            else:
                cdn_hit = fetch_first_cdn_png(slugs, variant)
            if cdn_hit:
                cdn_data, url = cdn_hit
                remote_wh = illu.png_dimensions_from_bytes(cdn_data)
                won_title = f"CDN:{os.path.basename(urllib.parse.urlparse(url).path)}"

        if not url:
            missing_api.append(f"{name} {tag}")
            print("  [no wiki file]", name, tag, " ; ".join(titles))
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
                    f"  [dry-run fetch] {name} {tag} ({reason}) wiki ~{rw}x{rh} via {won_short} -> {os.path.basename(dest)}"
                )
            else:
                lw, lh = local_wh if local_wh else (0, 0)
                print(f"  [dry-run skip] {name} {tag} local {lw}x{lh} >= wiki {rw}x{rh}")
            if do_fetch:
                downloaded += 1
            else:
                skipped_ok += 1
            continue

        if not do_fetch:
            skipped_ok += 1
            continue

        try:
            data = cdn_data if cdn_data is not None else illu.http_bytes(url)
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
                        f"  [skip smaller or same] {name} {tag} local {local_wh[0]}x{local_wh[1]} kept; remote {dl_wh[0]}x{dl_wh[1]}"
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
                print(f"  [upgraded] {name} {tag} {reason} ({won_short})")
            else:
                downloaded += 1
                print(f"  [saved] {name} {tag} {reason} ({won_short})")
        except urllib.error.HTTPError as e:
            print("  [http]", name, tag, e.code, url)
            failed += 1
        except OSError as e:
            print("  [io]", name, tag, e)
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
