#!/usr/bin/env python3
"""
Discover Cookie Run Wiki Kingdom pages with a CN tab (冲呀！饼干人：王国) and import
skill boxes that differ from the Global tab into:
  • data.js → cnEx.skillAttr
  • crk/crk_cn_descriptions.js → skill_details / skill_notes / rally_effects

Skips cookies when the CN skill box matches Global (no regional difference).

  python import_wiki_cn_content.py
  python import_wiki_cn_content.py --name Fire_spirit
  python import_wiki_cn_content.py --dry-run
  python import_wiki_cn_content.py --no-apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

import import_wiki_illustrations as illu
from import_wiki_cookie_data import (
    CN_KINGDOM_TAB_LABEL,
    _find_tabber_blocks,
    fetch_wikitext,
    find_all_skill_box_blocks,
    load_cookie_name_alternates,
    parse_tabber_panels,
    prefer_cn_kingdom_tabbers_in_wikitext,
    prefer_english_tabbers_in_wikitext,
    resolve_wiki_title,
)
from import_wiki_skill_details import (
    _merge_skill_attr_max_with_data,
    _strip_duplicate_rally_from_skill_details,
    build_for_skill_box,
    descriptions_key,
)

ROOT = illu.ROOT
DEFAULT_OUT = os.path.join(ROOT, "tools", "imported_cn_content.js")
DEFAULT_DATA_JS = os.path.join(ROOT, "data.js")
DEFAULT_CN_DESC = os.path.join(ROOT, "crk", "crk_cn_descriptions.js")


def _load_treasure_map() -> dict[str, str]:
    path = os.path.join(ROOT, "tools", "wiki_treasure_slug_map.json")
    if not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k).strip(): str(v).strip() for k, v in raw.items()}


def _load_kch_map() -> dict[str, str]:
    from cookie_search_aliases import build_merged_alias_map

    return build_merged_alias_map()


def wiki_has_cn_kingdom_skill_box(wikitext: str | None) -> bool:
    if not wikitext or "<tabber" not in wikitext.lower():
        return False
    for _, _, inner in _find_tabber_blocks(wikitext):
        for label, body in parse_tabber_panels(inner):
            if label.strip() != CN_KINGDOM_TAB_LABEL:
                continue
            if find_all_skill_box_blocks(body):
                return True
    return False


def _normalize_compare(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()


def _build_skill_payload(
    block: str,
    cookie_name: str,
    tmap: dict[str, str],
    kmap: dict[str, str],
    *,
    omit_rally_merge: bool,
    data_js_attrs: dict[str, Any] | None,
    warnings: list[str],
) -> dict[str, Any]:
    b = build_for_skill_box(
        block,
        cookie_name,
        tmap,
        kmap,
        warnings=warnings,
        omit_rally_merge=omit_rally_merge,
    )
    payload: dict[str, Any] = {}
    sd = b.get("skill_details")
    ry = b.get("rally_effects")
    if sd and ry:
        sd = _strip_duplicate_rally_from_skill_details(sd, ry) or sd
    if sd:
        payload["skill_details"] = sd
    if b.get("skill_notes"):
        payload["skill_notes"] = b["skill_notes"]
    if ry:
        payload["rally_effects"] = ry
    attrs = b.get("attrs") or {}
    if attrs:
        if data_js_attrs and data_js_attrs.get("skillAttr"):
            attrs = _merge_skill_attr_max_with_data(
                attrs,
                data_js_attrs.get("skillAttr"),
                warnings,
                label="cnEx.skillAttr",
            )
        payload["skillAttr"] = attrs
    return payload


def import_cn_for_cookie(
    api: str,
    name: str,
    display: str,
    name_alternates: dict[str, str],
    tmap: dict[str, str],
    kmap: dict[str, str],
    *,
    has_cj: bool = False,
    data_js_attrs: dict[str, Any] | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Returns (payload, skip_reason). payload is non-None when CN differs from Global.
    """
    title = resolve_wiki_title(api, name, display, name_alternates)
    if not title:
        return None, "wiki title not resolved"
    wt = fetch_wikitext(api, title)
    if not wt:
        return None, "empty wikitext"
    if not wiki_has_cn_kingdom_skill_box(wt):
        return None, "no CN Kingdom skill box"

    global_wt = prefer_english_tabbers_in_wikitext(wt) or wt
    cn_wt = prefer_cn_kingdom_tabbers_in_wikitext(wt) or wt
    global_boxes = find_all_skill_box_blocks(global_wt)
    cn_boxes = find_all_skill_box_blocks(cn_wt)
    if not cn_boxes:
        return None, "CN tab has no parseable skill box"

    w_global: list[str] = []
    w_cn: list[str] = []
    global_payload = _build_skill_payload(
        global_boxes[0][1],
        name,
        tmap,
        kmap,
        omit_rally_merge=has_cj,
        data_js_attrs=None,
        warnings=w_global,
    )
    cn_attrs_blob = None
    if data_js_attrs and data_js_attrs.get("cnExSkillAttr"):
        cn_attrs_blob = {"skillAttr": data_js_attrs["cnExSkillAttr"]}
    cn_payload = _build_skill_payload(
        cn_boxes[0][1],
        name,
        tmap,
        kmap,
        omit_rally_merge=has_cj,
        data_js_attrs=cn_attrs_blob,
        warnings=w_cn,
    )
    if not cn_payload:
        return None, "CN skill box produced no importable fields"

    same_details = _normalize_compare(global_payload.get("skill_details")) == _normalize_compare(
        cn_payload.get("skill_details")
    )
    same_notes = _normalize_compare(global_payload.get("skill_notes")) == _normalize_compare(
        cn_payload.get("skill_notes")
    )
    same_rally = _normalize_compare(global_payload.get("rally_effects")) == _normalize_compare(
        cn_payload.get("rally_effects")
    )
    same_attrs = global_payload.get("skillAttr") == cn_payload.get("skillAttr")
    if same_details and same_notes and same_rally and same_attrs:
        return None, "CN matches Global tab"

    out = dict(cn_payload)
    out["wikiTitle"] = title
    out["descriptionsKey"] = descriptions_key(name)
    if w_cn:
        out["warnings"] = w_cn
    return out, None


def format_js_output(doc: dict[str, Any], global_name: str) -> str:
    body = json.dumps(doc, ensure_ascii=False, indent=2)
    return f"// Generated by import_wiki_cn_content.py\nwindow.{global_name} = {body};\n"


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Import CN Kingdom wiki skill boxes that differ from Global"
    )
    ap.add_argument("--name", help="Only this data.js cookie name")
    ap.add_argument("--dry-run", action="store_true", help="Print progress to stderr only")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--format", choices=("js", "json"), default="js")
    ap.add_argument("--global-name", default="WIKI_IMPORTED_CN_CONTENT")
    ap.add_argument("--wiki-api", default=illu.API)
    ap.add_argument("--no-apply", action="store_true")
    ap.add_argument("--data-js", default=DEFAULT_DATA_JS)
    ap.add_argument("--cn-descriptions-js", default=DEFAULT_CN_DESC)
    ap.add_argument("--no-data", action="store_true")
    ap.add_argument("--no-descriptions", action="store_true")
    args = ap.parse_args()

    name_alternates = load_cookie_name_alternates()
    tmap = _load_treasure_map()
    kmap = _load_kch_map()
    rows = illu.load_char_rows()
    if args.name:
        rows = [r for r in rows if r["name"] == args.name]
        if not rows:
            print("No character named", args.name, file=sys.stderr)
            sys.exit(1)

    merged: dict[str, Any] = {"wikiApi": args.wiki_api, "cookies": {}}
    ok = 0
    skipped: list[tuple[str, str]] = []

    for r in rows:
        name = r["name"]
        display = r.get("displayName") or name
        data_blob = {}
        if r.get("cnExSkillAttr"):
            data_blob["cnExSkillAttr"] = r["cnExSkillAttr"]
        payload, reason = import_cn_for_cookie(
            args.wiki_api,
            name,
            display,
            name_alternates,
            tmap,
            kmap,
            has_cj=bool(r.get("hasCj")),
            data_js_attrs=data_blob or None,
        )
        if not payload:
            skipped.append((name, reason or "skipped"))
            if args.dry_run:
                print(f"[skip] {name}: {reason}", file=sys.stderr)
            continue
        merged["cookies"][name] = payload
        ok += 1
        if args.dry_run:
            keys = [k for k in payload if k not in ("wikiTitle", "descriptionsKey", "warnings")]
            print(f"[ok] {name} fields={keys}", file=sys.stderr)

    if args.dry_run:
        print(f"Done. ok={ok} skip={len(skipped)}", file=sys.stderr)

    if args.format == "json":
        out_txt = json.dumps(merged, ensure_ascii=False, indent=2)
    else:
        out_txt = format_js_output(merged, args.global_name)

    if not args.dry_run:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out_txt)
        print(f"Wrote {args.out} ({args.format}) cookies={ok} skipped={len(skipped)}")

    if not args.dry_run and not args.no_apply and ok:
        import apply_wiki_cn_content as _apply

        data_changed, desc_changed, log = _apply.apply_cn_import_doc(
            merged,
            dry_run=False,
            filter_name=args.name,
            data_js=args.data_js,
            cn_descriptions_js=args.cn_descriptions_js,
            no_data=args.no_data,
            no_descriptions=args.no_descriptions,
        )
        if log:
            print("Apply (data.js / crk_cn_descriptions.js):")
            for line in log:
                print(line)
        elif not data_changed and not desc_changed:
            print("Apply: no differences to patch.")


if __name__ == "__main__":
    main()
