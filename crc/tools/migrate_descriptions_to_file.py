#!/usr/bin/env python3
"""Move description / skillDesc / skillDetails from crc/data.js into crc/crc_descriptions.js."""

from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_JS = os.path.join(ROOT, "crc", "data.js")
DESC_JS = os.path.join(ROOT, "crc", "crc_descriptions.js")

CHAR_OBJ_INDENT = "    "
CHAR_PROP_INDENT = "      "
TEXT_KEYS = ("description", "skillDesc", "skillDetails")


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


def parse_string_property(lines: list[str], start: int, end: int, key: str) -> str | None:
    first = lines[start].rstrip("\n")
    m = re.match(rf"^\s+{re.escape(key)}:\s*(.*)$", first)
    if not m:
        return None
    chunks = [m.group(1)]
    for line in lines[start + 1 : end + 1]:
        chunks.append(line.rstrip("\n"))
    text = "\n".join(chunks).strip()
    if text.endswith(","):
        text = text[:-1].rstrip()
    try:
        val = json.loads(text)
        return val if isinstance(val, str) else None
    except json.JSONDecodeError:
        return None


def iter_character_names(lines: list[str]) -> list[str]:
    names: list[str] = []
    for line in lines:
        m = re.match(rf'^{re.escape(CHAR_PROP_INDENT)}name:\s*"([^"]+)",\s*$', line)
        if m:
            names.append(m.group(1))
    return names


def main() -> None:
    with open(DATA_JS, encoding="utf-8") as f:
        lines = f.readlines()

    description: dict[str, str] = {}
    skill_description: dict[str, str] = {}
    skill_details: dict[str, str] = {}
    remove_ranges: list[tuple[int, int]] = []

    for name in iter_character_names(lines):
        block = find_character_block(lines, name)
        if not block:
            continue
        start, end = block
        for key, dest in (
            ("description", description),
            ("skillDesc", skill_description),
            ("skillDetails", skill_details),
        ):
            span = find_prop_span(lines, start + 1, end, key)
            if span is None:
                continue
            val = parse_string_property(lines, span[0], span[1], key)
            if val:
                dest[name] = val
            remove_ranges.append(span)

    out_lines = ["window.CRC_DESCRIPTIONS = {\n", "  description: {\n"]
    for name in sorted(description):
        out_lines.append(f"    {json.dumps(name, ensure_ascii=False)}: {json.dumps(description[name], ensure_ascii=False)},\n")
    out_lines.append("  },\n  skill_description: {\n")
    for name in sorted(skill_description):
        out_lines.append(f"    {json.dumps(name, ensure_ascii=False)}: {json.dumps(skill_description[name], ensure_ascii=False)},\n")
    out_lines.append("  },\n  skill_details: {\n")
    for name in sorted(skill_details):
        out_lines.append(f"    {json.dumps(name, ensure_ascii=False)}: {json.dumps(skill_details[name], ensure_ascii=False)},\n")
    out_lines.append("  },\n};\n")
    with open(DESC_JS, "w", encoding="utf-8", newline="\n") as f:
        f.writelines(out_lines)

    for start, end in sorted(remove_ranges, reverse=True):
        del lines[start : end + 1]
    with open(DATA_JS, "w", encoding="utf-8", newline="\n") as f:
        f.writelines(lines)

    print(f"Wrote {DESC_JS} and stripped text fields from {DATA_JS}")


if __name__ == "__main__":
    main()
