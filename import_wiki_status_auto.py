#!/usr/bin/env python3
"""
Import auto Status defaults from Cookie Run Wiki Module:Status into tools/wiki_status_auto.json.

Mirrors the Lua tables in Module:Status:
  • addStatuses("Buff", { … })   → undispel: "buff"
  • addStatuses("Debuff", { … }) → undispel: "debuff"
  • addElements("Fire", { … })  → element: "fire" (lowercased; darkness stays darkness)

Used by wiki_expand_status.py when {{Status|…}} omits |nodispel= or |element=.

Usage:
  python import_wiki_status_auto.py
  python import_wiki_status_auto.py --dry-run
  python import_wiki_status_auto.py --out tools/wiki_status_auto.json

After updating, re-run skill import to refresh status tags in descriptions:
  python import_wiki_skill_details.py --dry-run
  python import_wiki_skill_details.py --name Fire_spirit
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

import import_wiki_illustrations as illu
from import_wiki_cookie_data import fetch_wikitext

ROOT = illu.ROOT
DEFAULT_OUT = os.path.join(ROOT, "tools", "wiki_status_auto.json")
MODULE_TITLE = "Module:Status"

_ELEMENT_SLUG = {
    "dark": "darkness",
}


def _wiki_element_to_slug(raw: str) -> str:
    s = raw.strip().lower().replace("-", " ")
    s = re.sub(r"\s+", "", s)
    return _ELEMENT_SLUG.get(s, s)


def _parse_lua_string_list(body: str) -> list[str]:
    return re.findall(r'"((?:\\.|[^"\\])*)"', body)


def _parse_module_status(wikitext: str) -> dict[str, dict]:
    out: dict[str, dict[str, str | None]] = {}

    def ensure(name: str) -> dict[str, str | None]:
        if name not in out:
            out[name] = {"element": None, "undispel": None}
        return out[name]

    for kind, wiki_kind in (("Buff", "buff"), ("Debuff", "debuff")):
        m = re.search(
            rf'addStatuses\s*\(\s*"{kind}"\s*,\s*\{{([\s\S]*?)\}}\s*\)',
            wikitext,
        )
        if not m:
            print(f"warning: could not parse addStatuses({kind!r}, …)", file=sys.stderr)
            continue
        for name in _parse_lua_string_list(m.group(1)):
            ensure(name)["undispel"] = wiki_kind

    for m in re.finditer(
        r'addElements\s*\(\s*"([^"]+)"\s*,\s*\{([\s\S]*?)\}\s*\)',
        wikitext,
    ):
        element = _wiki_element_to_slug(m.group(1))
        for name in _parse_lua_string_list(m.group(2)):
            ensure(name)["element"] = element

    # Only statuses with at least one auto rule (matches site importer expectations).
    filtered: dict[str, dict] = {}
    for name in sorted(out):
        row = out[name]
        if row.get("element") or row.get("undispel"):
            filtered[name] = row
    return filtered


def main() -> int:
    ap = argparse.ArgumentParser(description="Import wiki Module:Status auto tables → wiki_status_auto.json")
    ap.add_argument("--dry-run", action="store_true", help="Print summary only; do not write file")
    ap.add_argument("--out", default=DEFAULT_OUT, help=f"Output JSON path (default: {DEFAULT_OUT})")
    args = ap.parse_args()

    wikitext = fetch_wikitext(illu.API, MODULE_TITLE)
    if not wikitext or not wikitext.strip():
        print(f"error: empty wikitext for {MODULE_TITLE}", file=sys.stderr)
        return 1

    data = _parse_module_status(wikitext)
    if not data:
        print("error: parsed zero status auto entries", file=sys.stderr)
        return 1

    element_count = sum(1 for row in data.values() if row.get("element"))
    undispel_count = sum(1 for row in data.values() if row.get("undispel"))
    print(
        f"Parsed {len(data)} statuses from {MODULE_TITLE} "
        f"({element_count} with auto element, {undispel_count} with auto undispel)"
    )
    if "Explosive Burn" in data:
        print(f"  Explosive Burn: {data['Explosive Burn']}")

    if args.dry_run:
        return 0

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
