"""Patch crc/crc_descriptions.js from wiki cookie import rows."""

from __future__ import annotations

import json
import os
import re
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_DESC = os.path.join(ROOT, "crc", "crc_descriptions.js")

DESC_FILE_HEADER = "window.CRC_DESCRIPTIONS = {\n"
DESC_SECTIONS: list[tuple[str, str, str]] = [
    ("description", "  description: {", "  skill_description:"),
    ("skill_description", "  skill_description: {", "  skill_details:"),
    ("skill_details", "  skill_details: {", "};\n"),
]

WIKI_TO_SECTION = {
    "description": "description",
    "skillDesc": "skill_description",
    "skillDetails": "skill_details",
}


def wiki_patch_value_missing(val: Any) -> bool:
    if val is None:
        return True
    if isinstance(val, str) and not val.strip():
        return True
    return False


def desc_template() -> str:
    return (
        "window.CRC_DESCRIPTIONS = {\n"
        "  description: {\n"
        "  },\n"
        "  skill_description: {\n"
        "  },\n"
        "  skill_details: {\n"
        "  },\n"
        "};\n"
    )


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


def match_desc_property_line(line: str, key: str) -> re.Match[str] | None:
    return re.match(rf"^    {re.escape(json.dumps(key, ensure_ascii=False))}:\s*(.*)$", line.rstrip("\n"))


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
    for key, val in sorted(updates.items()):
        if wiki_patch_value_missing(val):
            continue
        new_line = f"    {json.dumps(key, ensure_ascii=False)}: {json.dumps(val, ensure_ascii=False)},\n"
        found = None
        for li in range(body_start, cur_close + 1):
            if match_desc_property_line(lines[li], key):
                found = li
                break
        if found is not None:
            old = parse_desc_line_value(lines[found], key)
            if old == val:
                continue
            log.append(f"  {label} {key}: updated")
            if not dry_run:
                lines[found] = new_line
            changed = True
        else:
            log.append(f"  {label} {key}: (insert)")
            if not dry_run:
                lines.insert(cur_close, new_line)
                cur_close += 1
            changed = True
    return changed


def wiki_cookie_description_updates(wiki_cookie: dict[str, Any]) -> dict[str, dict[str, str]]:
    name = wiki_cookie["name"]
    out: dict[str, dict[str, str]] = {
        "description": {},
        "skill_description": {},
        "skill_details": {},
    }
    for wiki_key, section in WIKI_TO_SECTION.items():
        val = wiki_cookie.get(wiki_key)
        if wiki_patch_value_missing(val):
            continue
        out[section][name] = str(val)
    return out


def merge_description_updates(doc_updates: list[dict[str, dict[str, str]]]) -> dict[str, dict[str, str]]:
    merged: dict[str, dict[str, str]] = {
        "description": {},
        "skill_description": {},
        "skill_details": {},
    }
    for part in doc_updates:
        for section, entries in part.items():
            merged[section].update(entries)
    return merged


def apply_descriptions_from_cookies(
    cookies: list[dict[str, Any]],
    *,
    dry_run: bool = False,
    descriptions_js: str = DEFAULT_DESC,
) -> tuple[bool, list[str]]:
    log: list[str] = []
    updates = merge_description_updates([wiki_cookie_description_updates(c) for c in cookies])
    if not any(updates[s] for s in updates):
        return False, log

    if not os.path.isfile(descriptions_js):
        if not dry_run:
            os.makedirs(os.path.dirname(descriptions_js), exist_ok=True)
            with open(descriptions_js, "w", encoding="utf-8", newline="\n") as f:
                f.write(desc_template())
        else:
            log.append("  descriptions: would create crc/crc_descriptions.js")
            return True, log

    with open(descriptions_js, encoding="utf-8") as f:
        lines = f.readlines()

    changed = False
    for section, header, nxt in DESC_SECTIONS:
        sec = find_desc_section(lines, header, nxt)
        if not sec:
            log.append(f"  [skip descriptions] missing section {section}")
            continue
        open_i, close_i = sec
        section_updates = updates.get(section) or {}
        if not section_updates:
            continue
        if apply_description_map(lines, open_i, close_i, section_updates, dry_run, log, section):
            changed = True
            sec = find_desc_section(lines, header, nxt)
            if sec:
                open_i, close_i = sec

    if changed and not dry_run:
        with open(descriptions_js, "w", encoding="utf-8", newline="\n") as f:
            f.writelines(lines)
    return changed, log
