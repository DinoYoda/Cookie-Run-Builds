#!/usr/bin/env python3
"""
Merge tools/imported_skill_details.js (or .json) into data.js and crk/crk_descriptions.js
when values differ — same line-replacement / insert rules as apply_wiki_cookie_data.py.

Patches:
  • data.js — skillAttr, cjSkillAttr, skillAttrMc (import mcSkillAttr → skillAttrMc)
  • crk_descriptions.js — skill_details, skill_notes, rally_effects, enchants, ascension_effects

  python apply_wiki_skill_details.py
  python apply_wiki_skill_details.py --dry-run --name Purple_yam
  python apply_wiki_skill_details.py --import-path tools/imported_skill_details.json
  python apply_wiki_skill_details.py --no-data
  python apply_wiki_skill_details.py --no-descriptions

Run import_wiki_skill_details.py first to refresh the import file.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from typing import Any

import import_wiki_illustrations as illu
from apply_wiki_cookie_data import (
    DEFAULT_DATA,
    DEFAULT_DESC,
    apply_description_map,
    ensure_trailing_comma_on_line,
    find_character_block,
    find_desc_section,
    find_prop_line,
)

ROOT = illu.ROOT
DEFAULT_IMPORT_JS = os.path.join(ROOT, "tools", "imported_skill_details.js")

# Insert order for data.js skill-related keys (who must appear before whom).
DATA_SKILL_KEY_ORDER = [
    "element",
    "type",
    "position",
    "rarity",
    "skill",
    "cd",
    "initialCd",
    "skillAttr",
    "mcSkill",
    "cjSkill",
    "cjReplace",
    "cjSkillAttr",
    "skillAttrMc",
]


def load_skill_import(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    raw = raw.lstrip("\ufeff").strip()
    if path.endswith(".json"):
        return json.loads(raw)
    i = raw.find("{")
    j = raw.rfind("}")
    if i < 0 or j < i:
        raise ValueError(f"Could not parse JS object from {path!r}")
    return json.loads(raw[i : j + 1])


def _format_skill_attr_num(x: int | float) -> str:
    """data.js literal: always include a decimal point; never thousands separators (no commas)."""
    xf = float(x)
    if not math.isfinite(xf):
        return json.dumps(xf, ensure_ascii=False)
    if xf == int(xf):
        return f"{int(xf)}.0"
    s = json.dumps(xf, ensure_ascii=False).replace(",", "")
    return s


def find_prop_span(lines: list[str], body_start: int, body_end: int, key: str) -> tuple[int, int] | None:
    i = find_prop_line(lines, body_start, body_end, key)
    if i is None:
        return None
    depth = lines[i].count("{") - lines[i].count("}")
    if depth == 0:
        return i, i
    for j in range(i + 1, body_end):
        depth += lines[j].count("{") - lines[j].count("}")
        if depth == 0:
            return i, j
    return None


def format_skill_attr_lines(key: str, obj: dict[str, list[int | float]]) -> list[str]:
    indent = "                    "
    sub = "                        "
    out: list[str] = [f"{indent}{key}: {{\n"]
    for ak in sorted(obj.keys()):
        pair = obj[ak]
        b, m = pair[0], pair[1]
        out.append(f"{sub}{ak}: [{_format_skill_attr_num(b)}, {_format_skill_attr_num(m)}],\n")
    out.append(f"{indent}}},\n")
    return out


def insert_point_after_preds(
    lines: list[str], body_start: int, body_end: int, key: str
) -> int:
    try:
        ki = DATA_SKILL_KEY_ORDER.index(key)
    except ValueError:
        return body_start
    best_end: int | None = None
    for pred in DATA_SKILL_KEY_ORDER[:ki]:
        span = find_prop_span(lines, body_start, body_end, pred)
        if span:
            best_end = max(best_end, span[1]) if best_end is not None else span[1]
    if best_end is not None:
        return best_end
    name_idx = find_prop_line(lines, body_start, body_end, "name")
    return name_idx if name_idx is not None else body_start


def apply_skill_attr_on_character(
    lines: list[str],
    cookie_name: str,
    data_key: str,
    wiki_obj: dict[str, list[int | float]],
    dry_run: bool,
    log: list[str],
) -> bool:
    block = find_character_block(lines, cookie_name)
    if not block:
        log.append(f"  [skip data] no block for name={cookie_name!r}")
        return False
    start, end = block
    body_start = start + 1
    body_end = end
    span = find_prop_span(lines, body_start, body_end, data_key)
    new_lines = format_skill_attr_lines(data_key, wiki_obj)

    if span:
        # Compare raw block text, not parsed numbers: values_equal(200, 200.0) is true but we still
        # need to rewrite when the file omits ".0" (or other canonical formatting).
        old_block = "".join(lines[span[0] : span[1] + 1])
        new_block = "".join(new_lines)
        if old_block == new_block:
            return False
        log.append(f"  data {cookie_name}.{data_key}: updated attr keys {sorted(wiki_obj.keys())}")
        if not dry_run:
            lines[span[0] : span[1] + 1] = new_lines
        return True

    log.append(f"  data {cookie_name}.{data_key}: (insert)")
    if not dry_run:
        ins = insert_point_after_preds(lines, body_start, body_end, data_key)
        lines[ins] = ensure_trailing_comma_on_line(lines[ins])
        lines[ins + 1 : ins + 1] = new_lines
    return True


def apply_one_cookie_data(
    lines: list[str],
    cookie_name: str,
    import_keys: dict[str, Any],
    dry_run: bool,
    log: list[str],
) -> bool:
    base = illu.cookie_name_to_wiki_slug(cookie_name)
    changed = False
    for subkey, payload in import_keys.items():
        if not isinstance(payload, dict):
            continue
        if subkey == base and "skillAttr" in payload:
            if apply_skill_attr_on_character(
                lines, cookie_name, "skillAttr", payload["skillAttr"], dry_run, log
            ):
                changed = True
        if subkey == f"{base}_cj" and "cjSkillAttr" in payload:
            if apply_skill_attr_on_character(
                lines, cookie_name, "cjSkillAttr", payload["cjSkillAttr"], dry_run, log
            ):
                changed = True
        if subkey == f"{base}_mc" and "mcSkillAttr" in payload:
            if apply_skill_attr_on_character(
                lines, cookie_name, "skillAttrMc", payload["mcSkillAttr"], dry_run, log
            ):
                changed = True
    return changed


def apply_skill_import_doc(
    doc: dict[str, Any],
    *,
    dry_run: bool = False,
    filter_name: str | None = None,
    data_js: str = DEFAULT_DATA,
    descriptions_js: str = DEFAULT_DESC,
    no_data: bool = False,
    no_descriptions: bool = False,
) -> tuple[bool, bool, list[str]]:
    """
    Patch data.js and crk_descriptions.js from a skill import document (tools/imported_skill_details or in-memory).
    If filter_name is set, only that cookie's entries are applied. Raises SystemExit(1) on missing sections / cookie.
    Returns (data_changed, desc_changed, log).
    """
    cookies: dict[str, Any] = dict(doc.get("cookies") or {})
    if filter_name:
        if filter_name not in cookies:
            print(f"No cookie {filter_name!r} in import", file=sys.stderr)
            raise SystemExit(1)
        cookies = {filter_name: cookies[filter_name]}

    log: list[str] = []
    data_changed = False
    desc_changed = False

    if not no_data:
        with open(data_js, encoding="utf-8") as f:
            data_lines = f.readlines()
        for cname, cdoc in cookies.items():
            keys = cdoc.get("keys") or {}
            if apply_one_cookie_data(data_lines, cname, keys, dry_run, log):
                data_changed = True
        if data_changed and not dry_run:
            with open(data_js, "w", encoding="utf-8", newline="\n") as f:
                f.writelines(data_lines)

    if not no_descriptions:
        with open(descriptions_js, encoding="utf-8") as f:
            desc_lines = f.readlines()

        all_details: dict[str, str] = {}
        all_notes: dict[str, str] = {}
        all_rally: dict[str, str] = {}
        all_enc: dict[str, str] = {}
        all_asc: dict[str, str] = {}

        for cname, cdoc in cookies.items():
            keys = cdoc.get("keys") or {}
            base = illu.cookie_name_to_wiki_slug(cname)

            for subkey, payload in keys.items():
                if not isinstance(payload, dict):
                    continue
                if sd := payload.get("skill_details"):
                    all_details[subkey] = sd
                if snote := payload.get("skill_notes"):
                    all_notes[subkey] = snote
                if subkey == base and (rly := payload.get("rally_effects")):
                    all_rally[base] = rly

            all_enc.update(cdoc.get("enchants") or {})
            all_asc.update(cdoc.get("ascension_effects") or {})

        if all_details:
            skd = find_desc_section(desc_lines, "  skill_details: {", "  rally_effects:")
            if not skd:
                print("Lost skill_details section", file=sys.stderr)
                raise SystemExit(1)
            if apply_description_map(
                desc_lines, skd[0], skd[1], all_details, dry_run, log, "skill_details"
            ):
                desc_changed = True

        if all_rally:
            ral = find_desc_section(desc_lines, "  rally_effects: {", "  enchants:")
            if not ral:
                print("Lost rally_effects section", file=sys.stderr)
                raise SystemExit(1)
            if apply_description_map(
                desc_lines, ral[0], ral[1], all_rally, dry_run, log, "rally_effects"
            ):
                desc_changed = True

        if all_enc:
            enc = find_desc_section(desc_lines, "  enchants: {", "  ascension_effects:")
            if not enc:
                print("Lost enchants section", file=sys.stderr)
                raise SystemExit(1)
            if apply_description_map(
                desc_lines, enc[0], enc[1], all_enc, dry_run, log, "enchants"
            ):
                desc_changed = True

        if all_asc:
            asc = find_desc_section(desc_lines, "  ascension_effects: {", "  skill_notes:")
            if not asc:
                print("Lost ascension_effects section", file=sys.stderr)
                raise SystemExit(1)
            if apply_description_map(
                desc_lines, asc[0], asc[1], all_asc, dry_run, log, "ascension_effects"
            ):
                desc_changed = True

        if all_notes:
            sn = find_desc_section(desc_lines, "  skill_notes: {", "  topping_description:")
            if not sn:
                print("Lost skill_notes section", file=sys.stderr)
                raise SystemExit(1)
            if apply_description_map(
                desc_lines, sn[0], sn[1], all_notes, dry_run, log, "skill_notes"
            ):
                desc_changed = True

        if desc_changed and not dry_run:
            with open(descriptions_js, "w", encoding="utf-8", newline="\n") as f:
                f.writelines(desc_lines)

    return data_changed, desc_changed, log


def main() -> None:
    ap = argparse.ArgumentParser(description="Apply wiki skill import to data.js + crk_descriptions.js")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--name", help="Only this data.js cookie name (e.g. Purple_yam)")
    ap.add_argument("--import-path", default=DEFAULT_IMPORT_JS, help=".js or .json from import_wiki_skill_details")
    ap.add_argument("--data-js", default=DEFAULT_DATA)
    ap.add_argument("--descriptions-js", default=DEFAULT_DESC)
    ap.add_argument("--no-data", action="store_true")
    ap.add_argument("--no-descriptions", action="store_true")
    args = ap.parse_args()

    try:
        doc = load_skill_import(args.import_path)
    except (OSError, ValueError, json.JSONDecodeError) as e:
        print(f"Failed to load {args.import_path}: {e}", file=sys.stderr)
        sys.exit(1)

    data_changed, desc_changed, log = apply_skill_import_doc(
        doc,
        dry_run=args.dry_run,
        filter_name=args.name,
        data_js=args.data_js,
        descriptions_js=args.descriptions_js,
        no_data=args.no_data,
        no_descriptions=args.no_descriptions,
    )

    if log:
        print("Changes:")
        for line in log:
            print(line)
    else:
        print("No differences to apply.")

    if args.dry_run and (data_changed or desc_changed):
        print("(dry-run: no files written)")


if __name__ == "__main__":
    main()
