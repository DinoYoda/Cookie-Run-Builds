#!/usr/bin/env python3
"""
Merge Crumble wiki import into crc/data.js.

displayName is set only when inserting a new character; existing entries are not patched.

Usage:
  python crc/tools/apply_wiki_cookie_data.py
  python crc/tools/apply_wiki_cookie_data.py --dry-run --name Strawberry
  python crc/tools/apply_wiki_cookie_data.py --from-wiki-list
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CRC_TOOLS = os.path.dirname(os.path.abspath(__file__))
CRK_TOOLS = os.path.join(ROOT, "crk", "tools")
if CRK_TOOLS not in sys.path:
    sys.path.insert(0, CRK_TOOLS)

import import_wiki_illustrations as illu

DEFAULT_DATA = os.path.join(ROOT, "crc", "data.js")
DEFAULT_DESC = os.path.join(ROOT, "crc", "crc_descriptions.js")
CHAR_OBJ_INDENT = "    "
CHAR_PROP_INDENT = "      "
NESTED_INDENT = "        "

DATA_FIELDS_ORDER = [
    "element",
    "role",
    "rarity",
    "releaseDate",
    "skill",
    "cd",
    "synergy",
    "skillAttr",
]
INSERT_FIELDS_ORDER = [
    "rarity",
    "role",
    "element",
    "releaseDate",
    "skill",
    "cd",
    "synergy",
    "skillAttr",
]
INFOBOX_STAT_KEYS = ("element", "role", "rarity")


def wiki_patch_value_missing(val: Any) -> bool:
    if val is None:
        return True
    if isinstance(val, str) and not val.strip():
        return True
    if isinstance(val, list) and len(val) == 0:
        return True
    return False


_SKILL_ATTR_PAIR_RE = re.compile(
    r"(attr\d+):\s*\[\s*((?:[^\[\]]|\[[^\]]*\])*?)\s*\]",
    re.DOTALL,
)


def parse_skill_attr_from_text(text: str) -> dict[str, list[int | float]]:
    out: dict[str, list[int | float]] = {}
    for m in _SKILL_ATTR_PAIR_RE.finditer(text):
        nums: list[int | float] = []
        for part in m.group(2).split(","):
            part = part.strip()
            if not part:
                continue
            nums.append(float(part) if "." in part else int(part))
        if nums:
            out[m.group(1)] = nums
    return out


def parse_synergy_from_text(text: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for block in re.finditer(r"\{([^{}]+)\}", text):
        inner = block.group(1)
        tm = re.search(r"type:\s*\"([^\"]+)\"", inner)
        if not tm:
            continue
        entry: dict[str, Any] = {"type": tm.group(1)}
        if re.search(r"\brecipient:\s*true\b", inner):
            entry["recipient"] = True
        if re.search(r"\bprovider:\s*true\b", inner):
            entry["provider"] = True
        out.append(entry)
    return out


def values_equal(a: Any, b: Any) -> bool:
    if a is None and b is None:
        return True
    if isinstance(a, float) and isinstance(b, int):
        return a == float(b)
    if isinstance(a, int) and isinstance(b, float):
        return float(a) == b
    return a == b


def field_values_equal(key: str, old: Any, new: Any) -> bool:
    if values_equal(old, new):
        return True
    if key == "skillAttr" and isinstance(new, dict):
        old_dict = old if isinstance(old, dict) else parse_skill_attr_from_text(str(old))
        if set(old_dict.keys()) != set(new.keys()):
            return False
        for k in new:
            if not values_equal(old_dict.get(k), new.get(k)):
                return False
        return True
    if key == "synergy" and isinstance(new, list):
        old_list = old if isinstance(old, list) else parse_synergy_from_text(str(old))
        if len(old_list) != len(new):
            return False
        for left, right in zip(old_list, new):
            if left.get("type") != right.get("type"):
                return False
            if bool(left.get("recipient")) != bool(right.get("recipient")):
                return False
            if bool(left.get("provider")) != bool(right.get("provider")):
                return False
        return True
    return False


def _js_container_depth_delta(s: str) -> int:
    depth = 0
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c in "\"'":
            quote = c
            i += 1
            while i < n:
                if s[i] == "\\":
                    i += 2
                    continue
                if s[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        if c in "{[":
            depth += 1
        elif c in "}]":
            depth -= 1
        i += 1
    return depth


def find_prop_line(lines: list[str], body_start: int, body_end: int, key: str) -> int | None:
    prop_re = re.compile(rf"^{re.escape(CHAR_PROP_INDENT)}{re.escape(key)}:\s")
    depth = 0
    for i in range(body_start, body_end):
        line = lines[i]
        if depth == 0 and prop_re.match(line):
            return i
        depth += _js_container_depth_delta(line)
    return None


def find_prop_span(lines: list[str], body_start: int, body_end: int, key: str) -> tuple[int, int] | None:
    i = find_prop_line(lines, body_start, body_end, key)
    if i is None:
        return None
    depth = _js_container_depth_delta(lines[i])
    if depth <= 0:
        return i, i
    for j in range(i + 1, body_end):
        depth += _js_container_depth_delta(lines[j])
        if depth <= 0:
            return i, j
    return None


def extract_property_value_text(lines: list[str], start: int, end: int, key: str) -> str:
    first = lines[start].rstrip("\n")
    m = re.match(rf"^\s+{re.escape(key)}:\s*(.*)$", first)
    if not m:
        raise ValueError(f"property {key!r} not at line {start}")
    chunks = [m.group(1)]
    for line in lines[start + 1 : end + 1]:
        chunks.append(line.rstrip("\n"))
    text = "\n".join(chunks).strip()
    if text.endswith(","):
        text = text[:-1].rstrip()
    return text


def _parse_data_js_value_literal(rest: str) -> Any:
    if rest == "null":
        return None
    if rest.startswith(("{", "[")):
        try:
            return json.loads(rest)
        except json.JSONDecodeError:
            return rest
    if rest.startswith('"'):
        return json.loads(rest)
    try:
        if "." in rest:
            f = float(rest)
            return int(f) if f == int(f) else f
        return int(rest)
    except ValueError:
        return rest


def parse_data_js_property_value_from_span(lines: list[str], start: int, end: int, key: str) -> Any:
    return _parse_data_js_value_literal(extract_property_value_text(lines, start, end, key))


def _format_num(v: int | float) -> str:
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v)


def format_scalar_line(key: str, value: Any) -> str:
    if value is None:
        return f"{CHAR_PROP_INDENT}{key}: null,"
    if isinstance(value, bool):
        return f"{CHAR_PROP_INDENT}{key}: {'true' if value else 'false'},"
    if isinstance(value, int):
        return f"{CHAR_PROP_INDENT}{key}: {value},"
    if isinstance(value, float):
        return f"{CHAR_PROP_INDENT}{key}: {_format_num(value)},"
    if isinstance(value, str):
        return CHAR_PROP_INDENT + key + ": " + json.dumps(value, ensure_ascii=False) + ","
    raise TypeError(value)


def format_synergy_lines(synergies: list[dict[str, Any]]) -> list[str]:
    if len(synergies) == 1 and len(synergies[0]) <= 2:
        s = synergies[0]
        inner = f"type: {json.dumps(s['type'], ensure_ascii=False)}"
        if s.get("recipient"):
            inner += ", recipient: true"
        if s.get("provider"):
            inner += ", provider: true"
        return [f"{CHAR_PROP_INDENT}synergy: [{{ {inner} }}],"]
    lines = [f"{CHAR_PROP_INDENT}synergy: ["]
    for i, s in enumerate(synergies):
        lines.append(f"{CHAR_PROP_INDENT}  {{")
        lines.append(f"{NESTED_INDENT}type: {json.dumps(s['type'], ensure_ascii=False)},")
        if s.get("recipient"):
            lines.append(f"{NESTED_INDENT}recipient: true,")
        if s.get("provider"):
            lines.append(f"{NESTED_INDENT}provider: true,")
        comma = "," if i < len(synergies) - 1 else ""
        lines.append(f"{CHAR_PROP_INDENT}  }}{comma}")
    lines.append(f"{CHAR_PROP_INDENT}],")
    return lines


def format_skill_attr_lines(skill_attr: dict[str, list[int | float]]) -> list[str]:
    keys = sorted(skill_attr.keys(), key=lambda k: int(re.sub(r"\D", "", k) or 0))
    lines = [f"{CHAR_PROP_INDENT}skillAttr: {{"]
    for i, key in enumerate(keys):
        vals = ", ".join(_format_num(v) for v in skill_attr[key])
        comma = "," if i < len(keys) - 1 else ""
        lines.append(f"{NESTED_INDENT}{key}: [{vals}]{comma}")
    lines.append(f"{CHAR_PROP_INDENT}}},")
    return lines


def format_property_lines(key: str, value: Any) -> list[str]:
    if key == "skillAttr" and isinstance(value, dict):
        return format_skill_attr_lines(value)
    if key == "synergy" and isinstance(value, list):
        return format_synergy_lines(value)
    return [format_scalar_line(key, value)]


def ensure_trailing_comma_on_line(line: str) -> str:
    if not line.strip():
        return line
    has_nl = line.endswith("\n")
    core = line[:-1] if has_nl else line
    stripped = core.rstrip()
    if stripped.endswith(",") or stripped.endswith("{") or stripped.endswith("["):
        return line
    return stripped + "," + ("\n" if has_nl else "")


def find_characters_array_insert_line(lines: list[str]) -> int | None:
    in_chars = False
    for i, line in enumerate(lines):
        if re.match(r"^  characters:\s*\[", line):
            in_chars = True
            continue
        if not in_chars:
            continue
        if re.match(r"^  \],", line):
            return i
    return None


def format_new_character(wiki_cookie: dict[str, Any], display_name: str) -> list[str]:
    lines = [f"{CHAR_OBJ_INDENT}{{"]
    lines.append(format_scalar_line("name", wiki_cookie["name"]))
    lines.append(format_scalar_line("displayName", display_name))
    for key in INSERT_FIELDS_ORDER:
        if key not in wiki_cookie:
            continue
        wiki_val = wiki_cookie[key]
        if wiki_patch_value_missing(wiki_val):
            continue
        lines.extend(format_property_lines(key, wiki_val))
    lines.append(f"{CHAR_OBJ_INDENT}}},")
    return lines


def insert_character(
    lines: list[str],
    wiki_cookie: dict[str, Any],
    display_name: str,
    dry_run: bool,
    log: list[str],
) -> bool:
    name = wiki_cookie["name"]
    insert_at = find_characters_array_insert_line(lines)
    if insert_at is None:
        log.append(f"  [skip insert] characters array not found for name={name!r}")
        return False

    for i in range(insert_at - 1, -1, -1):
        if re.match(rf"^{re.escape(CHAR_OBJ_INDENT)}\}},?\s*$", lines[i]):
            if not dry_run:
                lines[i] = ensure_trailing_comma_on_line(lines[i])
            break
        if re.match(r"^  characters:\s*\[\s*$", lines[i]):
            break

    log.append(f"  data {name}: (new character) displayName={display_name!r}")
    if not dry_run:
        insert_lines = [ln + "\n" for ln in format_new_character(wiki_cookie, display_name)]
        lines[insert_at:insert_at] = insert_lines
    return True


def find_character_block(lines: list[str], cookie_name: str) -> tuple[int, int] | None:
    name_line = None
    for i, line in enumerate(lines):
        if re.match(rf'^{re.escape(CHAR_PROP_INDENT)}name:\s*"{re.escape(cookie_name)}",\s*$', line):
            name_line = i
            break
    if name_line is None:
        return None
    end_line = None
    for j in range(name_line + 1, len(lines)):
        if re.match(rf"^{re.escape(CHAR_OBJ_INDENT)}\}},?\s*$", lines[j]):
            end_line = j
            break
    if end_line is None:
        return None
    start_line = None
    for k in range(name_line - 1, -1, -1):
        if re.match(rf"^{re.escape(CHAR_OBJ_INDENT)}\{{\s*$", lines[k]):
            start_line = k
            break
    if start_line is None:
        return None
    return start_line, end_line


def wiki_cookie_infobox_all_null(wiki_cookie: dict[str, Any]) -> bool:
    return all(wiki_cookie.get(k) is None for k in INFOBOX_STAT_KEYS)


def patch_character(lines: list[str], wiki_cookie: dict[str, Any], dry_run: bool, log: list[str]) -> bool:
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
        if wiki_patch_value_missing(wiki_val):
            continue
        new_lines = format_property_lines(key, wiki_val)
        span = find_prop_span(lines, body_start, body_end, key)
        if span is not None:
            old_val = parse_data_js_property_value_from_span(lines, span[0], span[1], key)
            if field_values_equal(key, old_val, wiki_val):
                continue
            log.append(f"  data {name}.{key}: {old_val!r} -> {wiki_val!r}")
            if not dry_run:
                replacement = [ln + "\n" for ln in new_lines]
                lines[span[0] : span[1] + 1] = replacement
                body_end += len(replacement) - (span[1] - span[0] + 1)
                end += len(replacement) - (span[1] - span[0] + 1)
            changed = True
        else:
            log.append(f"  data {name}.{key}: (insert) {wiki_val!r}")
            if not dry_run:
                insert_at = body_start
                for pred in DATA_FIELDS_ORDER:
                    if pred == key:
                        break
                    pred_span = find_prop_span(lines, body_start, body_end, pred)
                    if pred_span is not None:
                        insert_at = max(insert_at, pred_span[1])
                insert_at = min(insert_at, body_end - 1)
                lines[insert_at] = ensure_trailing_comma_on_line(lines[insert_at])
                insert_lines = [ln + "\n" for ln in new_lines]
                lines[insert_at + 1 : insert_at + 1] = insert_lines
                body_end += len(insert_lines)
                end += len(insert_lines)
            changed = True
    return changed


def apply_wiki_import_doc(
    doc: dict[str, Any],
    *,
    dry_run: bool = False,
    data_js: str = DEFAULT_DATA,
    descriptions_js: str = DEFAULT_DESC,
    no_descriptions: bool = False,
) -> tuple[bool, list[str]]:
    log: list[str] = []
    skip = {c["name"] for c in doc.get("cookies") or [] if wiki_cookie_infobox_all_null(c)}
    if skip:
        print("\n*** ALERT: wiki infobox missing element/role/rarity (skipped):", file=sys.stderr)
        for n in sorted(skip):
            print(f"    {n}", file=sys.stderr)
        print("", file=sys.stderr)

    with open(data_js, encoding="utf-8") as f:
        lines = f.readlines()

    changed = False
    for wc in doc.get("cookies") or []:
        if wc["name"] in skip:
            continue
        display_name = wc.get("displayName") or wc["name"]
        if find_character_block(lines, wc["name"]) is None:
            if insert_character(lines, wc, display_name, dry_run, log):
                changed = True
        elif patch_character(lines, wc, dry_run, log):
            changed = True

    if changed and not dry_run:
        with open(data_js, "w", encoding="utf-8", newline="\n") as f:
            f.writelines(lines)

    desc_log: list[str] = []
    if not no_descriptions:
        desc_path = os.path.join(CRC_TOOLS, "apply_wiki_descriptions.py")
        spec = importlib.util.spec_from_file_location("crc_apply_wiki_descriptions", desc_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Cannot load {desc_path}")
        desc_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(desc_mod)

        cookies = [c for c in doc.get("cookies") or [] if c["name"] not in skip]
        desc_changed, desc_log = desc_mod.apply_descriptions_from_cookies(
            cookies,
            dry_run=dry_run,
            descriptions_js=descriptions_js,
        )
        if desc_changed:
            changed = True

    return changed, log + desc_log


def main() -> None:
    ap = argparse.ArgumentParser(description="Apply Crumble wiki import to crc/data.js")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--name")
    ap.add_argument(
        "--from-wiki-list",
        action="store_true",
        help="Discover cookies from List of Cookies/Crumble instead of crc/data.js",
    )
    ap.add_argument("--data-js", default=DEFAULT_DATA)
    ap.add_argument("--descriptions-js", default=DEFAULT_DESC)
    ap.add_argument("--no-descriptions", action="store_true", help="Skip crc/crc_descriptions.js")
    ap.add_argument("--import-path", help="JSON from import_wiki_cookie_data.py --out")
    args = ap.parse_args()

    if args.import_path:
        with open(args.import_path, encoding="utf-8") as f:
            doc = json.load(f)
    else:
        import_path = os.path.join(CRC_TOOLS, "import_wiki_cookie_data.py")
        spec = importlib.util.spec_from_file_location("crc_import_wiki_cookie_data", import_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Cannot load {import_path}")
        imp = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(imp)

        rows = imp.load_char_rows(from_data=not args.from_wiki_list)
        if args.name:
            rows = [r for r in rows if r["name"] == args.name]
        doc, _, _ = imp.build_import_document(rows, illu.API, imp.load_name_overrides())

    changed, log = apply_wiki_import_doc(
        doc,
        dry_run=args.dry_run,
        data_js=args.data_js,
        descriptions_js=args.descriptions_js,
        no_descriptions=args.no_descriptions,
    )
    if log:
        print("Apply:")
        for line in log:
            print(line)
    elif not changed:
        print("Apply: no differences to patch.")


if __name__ == "__main__":
    main()
