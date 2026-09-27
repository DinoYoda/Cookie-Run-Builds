#!/usr/bin/env python3
"""
Import Cookie Run: Crumble cookie fields from cookierun.wiki …/Crumble pages.

Parses {{Cc cookie infobox}}, {{Cc skill box}} (with {{ccs|L0=…|L5=…}} level rows),
{{Cc synergy|…}} templates, and the == Story == section (stored as description).

Usage:
  python crc/tools/import_wiki_cookie_data.py
  python crc/tools/import_wiki_cookie_data.py --dry-run
  python crc/tools/import_wiki_cookie_data.py --name Strawberry
  python crc/tools/import_wiki_cookie_data.py --from-wiki-list
  python crc/tools/import_wiki_cookie_data.py --no-apply --out crc/tools/imported_cookie_data.json

By default, only cookies already listed in crc/data.js are imported.
Use --from-wiki-list to discover cookies from List of Cookies/Crumble.

Requires: Node.js, Python 3.9+
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CRC_TOOLS = os.path.dirname(os.path.abspath(__file__))
CRK_TOOLS = os.path.join(ROOT, "crk", "tools")
if CRK_TOOLS not in sys.path:
    sys.path.insert(0, CRK_TOOLS)

import import_wiki_illustrations as illu
from import_wiki_cookie_data import (
    extract_balanced_template,
    extract_story_section,
    fetch_wikitext,
    infobox_key_values,
)
from wiki_expand_status import split_balanced_piped_args

DEFAULT_DATA_JS = os.path.join(ROOT, "crc", "data.js")
NAME_OVERRIDES_PATH = os.path.join(CRC_TOOLS, "wiki_cookie_name_overrides.json")
EXTRACT_SCRIPT = os.path.join(CRC_TOOLS, "extract_crc_characters.mjs")
WIKI_SUBPAGE = "Crumble"
LIST_PAGE = "List of Cookies/Crumble"

INFOBOX_START = "{{Cc cookie infobox"
SKILL_BOX_START = "{{Cc skill box"
_CCS_RE = re.compile(r"\{\{ccs\|([^}]+)\}\}", re.I)
_SYNERGY_RE = re.compile(r"\{\{Cc synergy\|([^}|]+)(?:\|([^}]*))?\}\}", re.I)
_COOKIE_ICON_CONTAINER_RE = re.compile(r"\{\{Cookie icon container\|[^}]+\}\}", re.I)

RARITY_MAP = {
    "c": "C",
    "u": "U",
    "r": "R",
    "sr": "SR",
    "ssr": "SSR",
    "tssr": "TSSR",
}


def load_name_overrides() -> dict[str, str]:
    if not os.path.isfile(NAME_OVERRIDES_PATH):
        return {}
    with open(NAME_OVERRIDES_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k): str(v) for k, v in raw.items()}


def load_char_rows_from_data() -> list[dict]:
    if not os.path.isfile(EXTRACT_SCRIPT):
        print("Missing", EXTRACT_SCRIPT, file=sys.stderr)
        sys.exit(1)
    proc = subprocess.run(
        ["node", EXTRACT_SCRIPT],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if proc.returncode != 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        sys.exit(proc.returncode)
    return json.loads(proc.stdout)


def load_char_rows(*, from_data: bool = True) -> list[dict]:
    if from_data:
        return load_char_rows_from_data()
    return load_char_rows_from_wiki(illu.API)


def display_name_to_data_name(title: str) -> str:
    s = title.strip()
    if s.endswith(" Cookie"):
        s = s[:-len(" Cookie")].strip()
    return re.sub(r"\s+", "_", s)


def normalize_crumble_wiki_link(link: str, title: str) -> str:
    base = (link or title).strip().split("|")[0].strip()
    if base.lower().endswith("/crumble"):
        return base
    if "/" in base:
        return base
    return f"{base}/{WIKI_SUBPAGE}"


def parse_cookie_icon_container(block: str) -> dict[str, str] | None:
    if "type=cookie" not in block.lower():
        return None
    title_m = re.search(r"\|title=([^|}]+)", block, re.I)
    if not title_m:
        return None
    title = title_m.group(1).strip()
    link_m = re.search(r"\|link=([^|}]+)", block, re.I)
    link = link_m.group(1).strip() if link_m else title
    rarity_m = re.search(r"\|(?:text|rarity)=([^|}]+)", block, re.I)
    row: dict[str, str] = {"displayName": title, "link": link}
    if rarity_m:
        row["listRarity"] = rarity_m.group(1).strip()
    return row


def parse_crumble_cookie_list(wikitext: str) -> list[dict]:
    rows: list[dict] = []
    seen: set[str] = set()
    for m in _COOKIE_ICON_CONTAINER_RE.finditer(wikitext):
        parsed = parse_cookie_icon_container(m.group(0))
        if not parsed:
            continue
        display_name = parsed["displayName"]
        if display_name in seen:
            continue
        seen.add(display_name)
        rows.append(
            {
                "name": display_name_to_data_name(display_name),
                "displayName": display_name,
                "wikiTitle": normalize_crumble_wiki_link(parsed["link"], display_name),
                **({"listRarity": parsed["listRarity"]} if parsed.get("listRarity") else {}),
            }
        )
    return rows


def merge_wiki_rows_with_existing(wiki_rows: list[dict], existing_rows: list[dict]) -> list[dict]:
    by_display = {r.get("displayName", r["name"]): r for r in existing_rows}
    merged: list[dict] = []
    for row in wiki_rows:
        out = dict(row)
        display_name = out["displayName"]
        if display_name in by_display:
            out["name"] = by_display[display_name]["name"]
        merged.append(out)
    return merged


def load_char_rows_from_wiki(api: str) -> list[dict]:
    wikitext = fetch_wikitext(api, LIST_PAGE)
    if not wikitext:
        print(f"Could not fetch wiki list page {LIST_PAGE!r}", file=sys.stderr)
        sys.exit(1)
    wiki_rows = parse_crumble_cookie_list(wikitext)
    if not wiki_rows:
        print(f"No cookies found on wiki list page {LIST_PAGE!r}", file=sys.stderr)
        sys.exit(1)
    try:
        existing = load_char_rows_from_data()
    except SystemExit:
        existing = []
    return merge_wiki_rows_with_existing(wiki_rows, existing)


def wiki_title_for_row(row: dict, overrides: dict[str, str]) -> str:
    if row.get("wikiTitle"):
        return row["wikiTitle"]
    label = overrides.get(row["name"]) or row.get("displayName") or row["name"]
    return f"{label}/{WIKI_SUBPAGE}"


def normalize_rarity(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.strip().lower()
    if key in RARITY_MAP:
        return RARITY_MAP[key]
    return raw.strip().upper()


def normalize_title_word(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip().lower()
    if not s:
        return None
    return s[0].upper() + s[1:]


def _strip_wiki_value_markup(raw: str) -> str:
    s = re.sub(r"\{\{[^}]*\}\}", "", raw)
    s = re.sub(r"\{\{.*$", "", s)
    return s.strip().rstrip("%").replace(",", "")


def _parse_cc_value(raw: str) -> int | float | None:
    v = _strip_wiki_value_markup(raw)
    if not v:
        return None
    mul = re.match(r"^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$", v, re.I)
    if mul:
        product = float(mul.group(1)) * float(mul.group(2))
        return int(product) if product == int(product) else product
    mult = re.match(r"^x(\d+(?:\.\d+)?)$", v, re.I)
    if mult:
        val = float(mult.group(1))
        return int(val) if val == int(val) else val
    try:
        if "." in v:
            val = float(v)
            return int(val) if val == int(val) else val
        return int(v)
    except ValueError:
        return None


def parse_ccs_values(inner: str) -> list[int | float]:
    pairs: dict[int, int | float] = {}
    for part in inner.split("|"):
        part = part.strip()
        if not part or "=" not in part:
            continue
        k, _, v = part.partition("=")
        k = k.strip().upper()
        if not k.startswith("L") or len(k) < 2:
            continue
        try:
            idx = int(k[1:])
        except ValueError:
            continue
        parsed = _parse_cc_value(v)
        if parsed is None:
            continue
        pairs[idx] = parsed
    return [pairs[i] for i in sorted(pairs)]


def parse_inline_template_fields(block: str) -> dict[str, str]:
    """Parse {{Template|a=1|b=2}} fields (inline pipes), e.g. {{Cc skill box|name=…|cd=4|effect=…}}."""
    inner = block.strip()
    if inner.startswith("{{"):
        inner = inner[2:]
    if inner.endswith("}}"):
        inner = inner[:-2].strip()
    parts = split_balanced_piped_args(inner)
    out: dict[str, str] = {}
    for part in parts[1:]:
        if "=" not in part:
            continue
        k, _, v = part.partition("=")
        out[k.strip().lower()] = v.strip()
    return out


def normalize_skill_effect(effect: str | None) -> str | None:
    """Turn wiki skill effect bullets into HTML with %{attrN} placeholders."""
    if not effect or not str(effect).strip():
        return None
    text = str(effect).strip()
    attr_n = 1

    def ccs_repl(_m: re.Match[str]) -> str:
        nonlocal attr_n
        key = f"attr{attr_n}"
        attr_n += 1
        return f"%{{{key}}}"

    text = _CCS_RE.sub(ccs_repl, text)
    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("*"):
            line = line[1:].strip()
        lines.append(line)
    return "\n".join(lines) if lines else None


def parse_skill_attr(effect: str | None) -> dict[str, list[int | float]] | None:
    if not effect:
        return None
    attrs: dict[str, list[int | float]] = {}
    n = 1
    for m in _CCS_RE.finditer(effect):
        vals = parse_ccs_values(m.group(1))
        if vals:
            attrs[f"attr{n}"] = vals
            n += 1
    return attrs or None


def parse_synergies(wikitext: str) -> list[dict[str, Any]] | None:
    out: list[dict[str, Any]] = []
    for m in _SYNERGY_RE.finditer(wikitext):
        syn_type = normalize_title_word(m.group(1))
        if not syn_type:
            continue
        entry: dict[str, Any] = {"type": syn_type}
        tail = (m.group(2) or "").lower()
        if "type=rec" in tail:
            entry["recipient"] = True
        if "type=prov" in tail:
            entry["provider"] = True
        out.append(entry)
    return out or None


def parse_cookie_from_wikitext(name: str, wikitext: str) -> dict[str, Any] | None:
    infobox = extract_balanced_template(wikitext, INFOBOX_START)
    skill_box = extract_balanced_template(wikitext, SKILL_BOX_START)
    if not infobox and not skill_box:
        return None

    row: dict[str, Any] = {"name": name}
    if infobox:
        fields = infobox_key_values(infobox)
        row["rarity"] = normalize_rarity(fields.get("rarity"))
        row["element"] = normalize_title_word(fields.get("element"))
        row["role"] = normalize_title_word(fields.get("role"))
        release = fields.get("release")
        if release:
            row["releaseDate"] = release.strip()

    if skill_box:
        skill_fields = parse_inline_template_fields(skill_box)
        skill_name = skill_fields.get("name") or skill_fields.get("skill")
        if skill_name:
            row["skill"] = skill_name.strip()
        cd_raw = skill_fields.get("cd")
        if cd_raw:
            cd_raw = cd_raw.strip()
            try:
                row["cd"] = int(float(cd_raw))
            except ValueError:
                pass
        desc = skill_fields.get("desc")
        if desc:
            row["skillDesc"] = desc.strip()
        effect_raw = skill_fields.get("effect")
        attrs = parse_skill_attr(effect_raw)
        if attrs:
            row["skillAttr"] = attrs
        details = normalize_skill_effect(effect_raw)
        if details:
            row["skillDetails"] = details

    synergies = parse_synergies(wikitext)
    if synergies:
        row["synergy"] = synergies

    story = extract_story_section(wikitext)
    if story:
        row["description"] = story

    return row


def build_import_document(
    rows: list[dict],
    api: str,
    overrides: dict[str, str],
    *,
    verbose: bool = False,
) -> tuple[dict[str, Any], int, int]:
    cookies: list[dict[str, Any]] = []
    ok = fail = 0
    for row in rows:
        name = row["name"]
        title = wiki_title_for_row(row, overrides)
        wt = fetch_wikitext(api, title)
        if not wt:
            fail += 1
            if verbose:
                print(f"[miss] {name} <- {title}", file=sys.stderr)
            continue
        parsed = parse_cookie_from_wikitext(name, wt)
        if not parsed:
            fail += 1
            if verbose:
                print(f"[parse fail] {name} <- {title}", file=sys.stderr)
            continue
        if row.get("displayName"):
            parsed["displayName"] = row["displayName"]
        cookies.append(parsed)
        ok += 1
        if verbose:
            print(f"[ok] {name} <- {title}", file=sys.stderr)
    return {"wikiApi": api, "cookies": cookies}, ok, fail


def main() -> None:
    ap = argparse.ArgumentParser(description="Import Crumble cookie data from cookierun.wiki")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--name", help="Only this crc/data.js name")
    ap.add_argument(
        "--from-wiki-list",
        action="store_true",
        help="Discover cookies from List of Cookies/Crumble instead of crc/data.js",
    )
    ap.add_argument("--wiki-api", default=illu.API)
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--no-apply", action="store_true")
    ap.add_argument("--data-js", default=DEFAULT_DATA_JS)
    ap.add_argument(
        "--out",
        default=None,
        metavar="PATH",
        help="Optional JSON audit artifact",
    )
    args = ap.parse_args()

    if args.no_apply and not args.out and not args.dry_run:
        print("Nothing written: pass --out for an artifact, or omit --no-apply to patch crc/data.js.", file=sys.stderr)
        sys.exit(1)

    overrides = load_name_overrides()
    rows = load_char_rows(from_data=not args.from_wiki_list)
    if args.name:
        rows = [r for r in rows if r["name"] == args.name]
        if not rows:
            print("No character named", args.name, file=sys.stderr)
            sys.exit(1)

    doc, ok, fail = build_import_document(rows, args.wiki_api, overrides, verbose=args.verbose)

    if args.dry_run:
        print(json.dumps(doc, ensure_ascii=False, indent=2))
        print(f"Dry-run done. resolved={ok} missing={fail}")
        return

    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"Wrote {args.out}  cookies={ok} missing={fail}")

    if not args.no_apply:
        apply_path = os.path.join(CRC_TOOLS, "apply_wiki_cookie_data.py")
        spec = importlib.util.spec_from_file_location("crc_apply_wiki_cookie_data", apply_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Cannot load {apply_path}")
        apply = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(apply)

        changed, log = apply.apply_wiki_import_doc(doc, dry_run=False, data_js=args.data_js)
        if log:
            print("Apply (crc/data.js):")
            for line in log:
                print(line)
        elif not changed:
            print("Apply: no differences to patch.")


if __name__ == "__main__":
    main()
