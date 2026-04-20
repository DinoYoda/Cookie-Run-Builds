#!/usr/bin/env python3
"""
Merge wiki import into data.js and crk/crk_descriptions.js when values differ.

displayName is never patched — it stays as in data.js (UI derives labels from name + displayName as you maintain them).

Behavior:
  • Wiki null / empty string / empty list is never written (does not clear existing data.js or descriptions).
  • For each wiki field we manage: if the file already has it but the value differs → replace that line only;
    if the key is missing → insert the line after the right predecessor, adding a trailing comma to that
    predecessor when needed (so the object stays valid JS). Everything else is left as-is.

  python apply_wiki_cookie_data.py              # fetch wiki, patch both files
  python apply_wiki_cookie_data.py --dry-run    # print changes only
  python apply_wiki_cookie_data.py --name Camellia
  python apply_wiki_cookie_data.py --dry-run --name Lemon   # also prints full wiki payload for comparison
  python apply_wiki_cookie_data.py --no-data    # descriptions only
  python apply_wiki_cookie_data.py --no-descriptions

Requires a prior successful wiki fetch per cookie (same rules as import_wiki_cookie_data.py).

If wiki infobox parsing yields element, type, position, and rarity all null, data.js patches for that
cookie are skipped and a stderr alert lists the names; crk_descriptions.js is still updated from the wiki.

Description object keys that are not valid JS identifiers (e.g. hyphens) are written quoted, matching
manual entries like "pom-pom_dough": ….
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

import import_wiki_illustrations as illu
from import_wiki_cookie_data import build_import_document, load_cookie_name_alternates

ROOT = illu.ROOT
DEFAULT_DATA = os.path.join(ROOT, "data.js")
DEFAULT_DESC = os.path.join(ROOT, "crk", "crk_descriptions.js")

# Wiki-driven keys on each character (insert after last present predecessor in this list).
# Omit initial / mcInitial / cjInitial: data.js uses initialCd (different meaning) and has no mc/cj initial fields.
DATA_FIELDS_ORDER = [
    "element",
    "type",
    "position",
    "rarity",
    "skill",
    "cd",
    "mcSkill",
    "cjSkill",
]

# If the infobox yields no element/type/position/rarity, the page parse is unreliable — skip patches.
INFOBOX_STAT_KEYS = ("element", "type", "position", "rarity")


def wiki_patch_value_missing(val: Any) -> bool:
    """Do not apply wiki values that would clear or blank data.js / descriptions."""
    if val is None:
        return True
    if isinstance(val, str) and not val.strip():
        return True
    if isinstance(val, list) and len(val) == 0:
        return True
    return False


def values_equal(a: Any, b: Any) -> bool:
    if a is None and b is None:
        return True
    if isinstance(a, float) and isinstance(b, int):
        return a == float(b)
    if isinstance(a, int) and isinstance(b, float):
        return float(a) == b
    return a == b


def parse_data_js_property_value(line: str, key: str) -> Any:
    m = re.match(rf"^\s+{re.escape(key)}:\s*(.*)$", line)
    if not m:
        return None
    rest = m.group(1).strip().rstrip(",").strip()
    if rest == "null":
        return None
    if rest.startswith("["):
        try:
            return json.loads(rest)
        except json.JSONDecodeError:
            return rest
    if rest.startswith('"'):
        return json.loads(rest)
    try:
        if "." in rest:
            f = float(rest)
            if f == int(f):
                return int(f)
            return f
        return int(rest)
    except ValueError:
        return rest


def format_data_js_property_line(key: str, value: Any) -> str:
    indent = "                    "
    if value is None:
        return f"{indent}{key}: null,"
    if isinstance(value, bool):
        return f"{indent}{key}: {'true' if value else 'false'},"
    if isinstance(value, int):
        return f"{indent}{key}: {value},"
    if isinstance(value, float):
        if value == int(value):
            return f"{indent}{key}: {int(value)},"
        return f"{indent}{key}: {value},"
    if isinstance(value, str):
        return indent + key + ": " + json.dumps(value, ensure_ascii=False) + ","
    if isinstance(value, list):
        inner = ", ".join(json.dumps(x, ensure_ascii=False) for x in value)
        return f"{indent}{key}: [{inner}],"
    raise TypeError(value)


def ensure_trailing_comma_on_line(line: str) -> str:
    """If this line is a property line without a trailing comma, add one (needed before inserting the next key)."""
    if not line.strip():
        return line
    has_nl = line.endswith("\n")
    core = line[:-1] if has_nl else line
    stripped = core.rstrip()
    if stripped.endswith(",") or stripped.endswith("{") or stripped.endswith("["):
        return line
    return stripped + "," + ("\n" if has_nl else "")


def find_character_block(lines: list[str], cookie_name: str) -> tuple[int, int] | None:
    name_line = None
    for i, line in enumerate(lines):
        if not re.match(rf"^                    name:\s*\"{re.escape(cookie_name)}\",\s*$", line):
            continue
        name_line = i
        break
    if name_line is None:
        return None
    end_line = None
    for j in range(name_line + 1, len(lines)):
        if re.match(r"^                \},\s*$", lines[j]):
            end_line = j
            break
    if end_line is None:
        return None
    start_line = None
    k = name_line - 1
    while k >= 0:
        if re.match(r"^                \{\s*$", lines[k]):
            start_line = k
            break
        if re.search(r"characters:\s*\[\{\s*$", lines[k]):
            start_line = k
            break
        k -= 1
    if start_line is None:
        return None
    return start_line, end_line


def find_prop_line(lines: list[str], body_start: int, body_end: int, key: str) -> int | None:
    for i in range(body_start, body_end):
        if re.match(rf"^                    {re.escape(key)}:\s", lines[i]):
            return i
    return None


def apply_cookie_fields(
    lines: list[str],
    wiki_cookie: dict[str, Any],
    dry_run: bool,
    log: list[str],
) -> bool:
    name = wiki_cookie["name"]
    block = find_character_block(lines, name)
    if not block:
        log.append(f"  [skip data] no block for name={name!r}")
        return False
    start, end = block
    body_start = start + 1
    body_end = end
    changed = False

    for key in DATA_FIELDS_ORDER:
        if key not in wiki_cookie:
            continue
        wiki_val = wiki_cookie[key]
        new_line = format_data_js_property_line(key, wiki_val)
        idx = find_prop_line(lines, body_start, body_end, key)
        if idx is not None:
            old_val = parse_data_js_property_value(lines[idx], key)
            if values_equal(old_val, wiki_val):
                continue
            log.append(f"  data {name}.{key}: {old_val!r} -> {wiki_val!r}")
            if not dry_run:
                lines[idx] = new_line + "\n"
            changed = True
        else:
            log.append(f"  data {name}.{key}: (insert) {wiki_val!r}")
            if not dry_run:
                name_idx = find_prop_line(lines, body_start, body_end, "name")
                insert_at = name_idx if name_idx is not None else body_start
                for pred in DATA_FIELDS_ORDER:
                    if pred == key:
                        break
                    q = find_prop_line(lines, body_start, body_end, pred)
                    if q is not None:
                        insert_at = max(insert_at, q)
                line_out = new_line + "\n"
                lines[insert_at] = ensure_trailing_comma_on_line(lines[insert_at])
                lines.insert(insert_at + 1, line_out)
                body_end += 1
                end += 1
            changed = True
    return changed


def wiki_cookie_infobox_all_null(wiki_cookie: dict[str, Any]) -> bool:
    return all(wiki_cookie.get(k) is None for k in INFOBOX_STAT_KEYS)


def desc_js_key_token(key: str) -> str:
    if re.fullmatch(r"[A-Za-z_$][\w$]*", key):
        return key
    return json.dumps(key, ensure_ascii=False)


def match_desc_property_line(line: str, key: str) -> re.Match[str] | None:
    m = re.match(rf"^    {re.escape(key)}:\s*(.+)$", line)
    if m:
        return m
    quoted = json.dumps(key, ensure_ascii=False)
    return re.match(rf"^    {re.escape(quoted)}:\s*(.+)$", line)


def find_desc_section(lines: list[str], header_prefix: str, next_header_prefix: str) -> tuple[int, int] | None:
    open_i = None
    for i, line in enumerate(lines):
        if line.startswith(header_prefix):
            open_i = i
            break
    if open_i is None:
        return None
    for j in range(open_i + 1, len(lines)):
        if lines[j].startswith(next_header_prefix):
            return open_i, j - 1
    return None


def parse_desc_line_value(line: str, key: str) -> str | None:
    m = match_desc_property_line(line, key)
    if not m:
        return None
    raw = m.group(1).strip().rstrip(",").strip()
    try:
        out = json.loads(raw)
        return out if isinstance(out, str) else str(out)
    except json.JSONDecodeError:
        return None


def apply_description_map(
    lines: list[str],
    open_i: int,
    close_i: int,
    updates: dict[str, str],
    dry_run: bool,
    log: list[str],
    label: str,
) -> bool:
    changed = False
    body_start = open_i + 1
    cur_close = close_i
    for key, val in updates.items():
        if wiki_patch_value_missing(val):
            continue
        new_line = f"    {desc_js_key_token(key)}: {json.dumps(val, ensure_ascii=False)},"
        found = None
        for li in range(body_start, cur_close):
            if match_desc_property_line(lines[li], key):
                found = li
                break
        if found is not None:
            old = parse_desc_line_value(lines[found], key)
            if old == val:
                continue
            log.append(f"  {label} {key}: updated ({len(old or '')} -> {len(val)} chars)")
            if not dry_run:
                lines[found] = new_line + "\n"
            changed = True
        else:
            log.append(f"  {label} {key}: (insert)")
            if not dry_run:
                lines.insert(cur_close, new_line + "\n")
                cur_close += 1
            changed = True
    return changed


def print_wiki_import_preview(doc: dict[str, Any], name: str) -> None:
    """Stdout: JSON snapshot of the wiki merge source for one cookie (for --dry-run --name)."""
    wc = next((c for c in doc["cookies"] if c["name"] == name), None)
    if not wc:
        print(f"\n(No wiki cookie row for name={name!r} — resolve/fetch may have failed.)\n", file=sys.stderr)
        return
    dk = illu.cookie_name_to_wiki_slug(name)
    wiki_d = doc["descriptions"]["description"]
    wiki_s = doc["descriptions"]["skill_description"]
    skill_parts = {k: wiki_s[k] for k in sorted(wiki_s.keys()) if k == dk or k.startswith(f"{dk}_")}
    payload = {
        "name": name,
        "descriptionsKey": dk,
        "wikiCookie": wc,
        "description": wiki_d.get(dk),
        "skillDescription": skill_parts if skill_parts else None,
    }
    print(f"\n--- Wiki import preview ({name}) ---\n")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    print()


def _skip_data_js_names(doc: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for wc in doc.get("cookies") or []:
        if wiki_cookie_infobox_all_null(wc):
            out.add(wc["name"])
    return out


def apply_wiki_import_doc(
    doc: dict[str, Any],
    *,
    dry_run: bool = False,
    data_js: str = DEFAULT_DATA,
    descriptions_js: str = DEFAULT_DESC,
    no_data: bool = False,
    no_descriptions: bool = False,
) -> tuple[bool, bool, list[str]]:
    """
    Patch data.js and crk/crk_descriptions.js from an import document (same rules as CLI).
    Returns (data_changed, desc_changed, log_lines).
    On structural errors (missing sections), prints to stderr and raises SystemExit(1).
    """
    skip_data_names = _skip_data_js_names(doc)
    if skip_data_names:
        print("\n*** ALERT: wiki infobox missing element/type/position/rarity (skipped data.js only):", file=sys.stderr)
        for n in sorted(skip_data_names):
            print(f"    {n}", file=sys.stderr)
        print("", file=sys.stderr)

    log: list[str] = []
    data_changed = False
    desc_changed = False

    if not no_data:
        with open(data_js, encoding="utf-8") as f:
            data_lines = f.readlines()
        for wc in doc["cookies"]:
            if wc["name"] in skip_data_names:
                continue
            if apply_cookie_fields(data_lines, wc, dry_run, log):
                data_changed = True
        if data_changed and not dry_run:
            with open(data_js, "w", encoding="utf-8", newline="\n") as f:
                f.writelines(data_lines)

    if not no_descriptions:
        with open(descriptions_js, encoding="utf-8") as f:
            desc_lines = f.readlines()
        dsec = find_desc_section(desc_lines, "  description: {", "  skill_description:")
        sksec = find_desc_section(desc_lines, "  skill_description: {", "  skill_details:")
        if not dsec or not sksec:
            print("Could not find description / skill_description sections", file=sys.stderr)
            raise SystemExit(1)
        d_open, d_close = dsec
        s_open, s_close = sksec
        wiki_d = doc["descriptions"]["description"]
        wiki_s = doc["descriptions"]["skill_description"]
        if wiki_d and apply_description_map(
            desc_lines, d_open, d_close, wiki_d, dry_run, log, "description"
        ):
            desc_changed = True
        s_open, s_close = find_desc_section(desc_lines, "  skill_description: {", "  skill_details:")
        if s_open is None:
            print("Lost skill_description section after edits", file=sys.stderr)
            raise SystemExit(1)
        if wiki_s and apply_description_map(
            desc_lines, s_open, s_close, wiki_s, dry_run, log, "skill_description"
        ):
            desc_changed = True
        if desc_changed and not dry_run:
            with open(descriptions_js, "w", encoding="utf-8", newline="\n") as f:
                f.writelines(desc_lines)

    return data_changed, desc_changed, log


def main() -> None:
    ap = argparse.ArgumentParser(description="Apply wiki import to data.js and crk_descriptions.js if different")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--name", help="Only this data.js cookie name")
    ap.add_argument("--data-js", default=DEFAULT_DATA)
    ap.add_argument("--descriptions-js", default=DEFAULT_DESC)
    ap.add_argument("--no-data", action="store_true", help="Skip data.js")
    ap.add_argument("--no-descriptions", action="store_true", help="Skip crk_descriptions.js")
    ap.add_argument("--wiki-api", default=illu.API)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    name_alternates = load_cookie_name_alternates()
    rows = illu.load_char_rows()
    if args.name:
        rows = [r for r in rows if r["name"] == args.name]
        if not rows:
            print("No character named", args.name, file=sys.stderr)
            sys.exit(1)

    doc, ok, miss = build_import_document(rows, args.wiki_api, name_alternates, verbose=args.verbose)
    print(f"Wiki fetch: resolved={ok} missing={miss}")

    if args.dry_run and args.name:
        print_wiki_import_preview(doc, args.name)

    data_changed, desc_changed, log = apply_wiki_import_doc(
        doc,
        dry_run=args.dry_run,
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
