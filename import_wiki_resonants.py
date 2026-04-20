#!/usr/bin/env python3
"""
Generate a list of which resonant topping sets each cookie can use (Cookie Run Wiki).

Source: https://cookierun.wiki/wiki/Toppings#Resonant_Toppings

The wiki uses {{Resonant toppings cell|...}} with |name=, optional |cookies=, optional |elements=.
A cookie matches a set if their display name appears in |cookies= (normalized) or their element(s)
overlap |elements= (any). See code for details.

Output keys match data.js-style ids: e.g. "Crossed Fates" -> "Crossed_fates".

Requires Node (tools/extract_crk_characters.mjs) for name/displayName/element from data.js.

Usage:
  python import_wiki_resonants.py
  python import_wiki_resonants.py --out tools/imported_resonants.json
  python import_wiki_resonants.py --format text --out resonants.txt
  python import_wiki_resonants.py --out - --format text          # stdout
  python import_wiki_resonants.py --patch-data-js                # optional: write data.js resonants:
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import unicodedata
from typing import Any

import import_wiki_illustrations as illu

ROOT = illu.ROOT
DATA_JS = os.path.join(ROOT, "data.js")
DEFAULT_LIST_OUT = os.path.join(ROOT, "tools", "imported_resonants.json")
EXTRACT = os.path.join(ROOT, "tools", "extract_crk_characters.mjs")
TOPPINGS_PAGE = "Toppings"


def _http_json(url: str) -> dict[str, Any]:
    return illu.http_json(url)


def fetch_toppings_wikitext(api: str) -> str:
    import urllib.parse

    params = {"action": "parse", "page": TOPPINGS_PAGE, "prop": "wikitext", "format": "json"}
    url = api + "?" + urllib.parse.urlencode(params)
    data = _http_json(url)
    return (data.get("parse") or {}).get("wikitext", {}).get("*") or ""


def extract_resonant_section(wt: str) -> str:
    start = wt.find("==Resonant Toppings==")
    if start < 0:
        return ""
    # End before Mysterious Toppings or next == at line start (same level)
    rest = wt[start:]
    end_m = rest.find("\n==Mysterious Toppings")
    if end_m >= 0:
        return rest[:end_m]
    # fallback: next ==...== that's not ===
    m = re.search(r"\n==[^=][^=\n]*[^=]==\s*\n", rest[500:])
    if m:
        return rest[: 500 + m.start()]
    return rest


def _balanced_template_slice(s: str, start: int) -> tuple[str, int] | None:
    """If s[start:].startswith('{{'), return (full template including }}), index after it)."""
    if start < 0 or start + 2 > len(s) or s[start : start + 2] != "{{":
        return None
    depth = 0
    j = start
    n = len(s)
    while j < n:
        if s.startswith("{{", j):
            depth += 1
            j += 2
        elif s.startswith("}}", j):
            depth -= 1
            j += 2
            if depth == 0:
                return s[start:j], j
        else:
            j += 1
    return None


def parse_resonant_topping_cells(section: str) -> list[dict[str, str]]:
    """Each dict has keys: name, cookies (raw), elements (raw), lower keys optional."""
    out: list[dict[str, str]] = []
    needle = "{{Resonant toppings cell"
    i = 0
    low = section.lower()
    needle_l = needle.lower()
    while True:
        j = low.find(needle_l, i)
        if j < 0:
            break
        span = _balanced_template_slice(section, j)
        if not span:
            i = j + 4
            continue
        block, end_j = span
        inner = block[len("{{") :].strip()
        if not inner.lower().startswith("resonant toppings cell"):
            i = end_j
            continue
        # strip "Resonant toppings cell" and leading |
        inner = re.sub(
            r"^Resonant toppings cell\s*",
            "",
            inner,
            flags=re.I,
        ).strip()
        if inner.endswith("}}"):
            inner = inner[:-2].strip()
        params = _parse_template_params(inner)
        name = (params.get("name") or "").strip()
        if not name:
            i = end_j
            continue
        cell: dict[str, str] = {"name": name}
        if "cookies" in params:
            cell["cookies"] = params["cookies"]
        if "elements" in params:
            cell["elements"] = params["elements"]
        out.append(cell)
        i = end_j
    return out


def _parse_template_params(inner: str) -> dict[str, str]:
    """Pipe-separated k=v; values run until the next |param= (newline or same line)."""
    params: dict[str, str] = {}
    inner = inner.replace("\r", "")
    for m in re.finditer(r"\|([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*", inner):
        k = m.group(1).lower()
        start = m.end()
        nxt = re.search(r"\|([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*", inner[start:])
        if nxt:
            val = inner[start : start + nxt.start()]
        else:
            val = inner[start:]
        params[k] = val.strip()
    return params


def fold_ascii(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


def norm_cookie_label(s: str) -> str:
    t = fold_ascii(s).lower().replace("cookie", " ").strip()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return " ".join(t.split())


def wiki_name_to_data_key(wiki_name: str) -> str:
    parts = wiki_name.strip().split()
    if not parts:
        return ""
    first = parts[0]
    head = first[0].upper() + first[1:].lower() if len(first) > 1 else first.capitalize()
    if len(parts) == 1:
        return head
    tail = "_".join(p.lower() for p in parts[1:])
    return f"{head}_{tail}"


def element_set(el: Any) -> set[str]:
    if el is None:
        return set()
    if isinstance(el, str):
        return {el.strip()} if el.strip() else set()
    if isinstance(el, list):
        out: set[str] = set()
        for x in el:
            if isinstance(x, str) and x.strip():
                out.add(x.strip())
        return out
    return set()


def norm_element(s: str) -> str:
    return fold_ascii(s).strip().lower()


def split_comma_list(s: str) -> list[str]:
    return [x.strip() for x in s.split(",") if x.strip()]


def explicit_cookie_in_list(display_name: str, raw_cookies: str) -> bool:
    dn = norm_cookie_label(display_name)
    for token in split_comma_list(raw_cookies):
        if norm_cookie_label(token) == dn:
            return True
    return False


def element_match_cell(elements: Any, cell: dict[str, str]) -> bool:
    elset = {norm_element(x) for x in element_set(elements)}
    raw_el = cell.get("elements")
    if not raw_el or not elset:
        return False
    wiki_els = {norm_element(x) for x in split_comma_list(raw_el)}
    return bool(wiki_els & elset)


def build_resonants_for_cookie(
    display_name: str,
    elements: Any,
    cells: list[dict[str, str]],
) -> list[str]:
    """Explicit |cookies= hits first (wiki template order), then |elements= matches (wiki order)."""
    keys: list[str] = []
    seen: set[str] = set()
    for cell in cells:
        raw = cell.get("cookies") or ""
        if not raw.strip():
            continue
        if not explicit_cookie_in_list(display_name, raw):
            continue
        key = wiki_name_to_data_key(cell["name"])
        if key and key not in seen:
            seen.add(key)
            keys.append(key)
    for cell in cells:
        key = wiki_name_to_data_key(cell["name"])
        if not key or key in seen:
            continue
        if not element_match_cell(elements, cell):
            continue
        seen.add(key)
        keys.append(key)
    return keys


def load_char_rows() -> list[dict[str, Any]]:
    proc = subprocess.run(
        ["node", EXTRACT],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        sys.exit(1)
    return json.loads(proc.stdout)


def find_character_block(lines: list[str], cookie_name: str) -> tuple[int, int] | None:
    name_line = None
    for i, line in enumerate(lines):
        if not re.match(rf'^                    name:\s*"{re.escape(cookie_name)}",\s*$', line):
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


def find_resonants_line(lines: list[str], body_start: int, body_end: int) -> int | None:
    for i in range(body_start, body_end):
        if re.match(r"^                    resonants:\s", lines[i]):
            return i
    return None


def find_sets_line(lines: list[str], body_start: int, body_end: int) -> int | None:
    for i in range(body_start, body_end):
        if re.match(r"^                    sets:\s", lines[i]):
            return i
    return None


def format_resonants_line(keys: list[str]) -> str:
    inner = ", ".join(json.dumps(k, ensure_ascii=False) for k in keys)
    return f"                    resonants: [{inner}],\n"


def apply_resonants_to_data_js(
    mapping: dict[str, list[str]],
    *,
    dry_run: bool,
    only_name: str | None,
    data_path: str,
) -> list[str]:
    """Insert or update resonants line; ensure trailing comma on predecessor."""
    log: list[str] = []

    def ensure_comma(line: str) -> str:
        stripped = line.rstrip("\n")
        if stripped.endswith(",") or stripped.endswith("{") or stripped.endswith("["):
            return line
        return stripped + ",\n"

    with open(data_path, encoding="utf-8") as f:
        lines = f.readlines()

    for name, keys in sorted(mapping.items()):
        if only_name and name != only_name:
            continue
        block = find_character_block(lines, name)
        if not block:
            log.append(f"  [skip] no block for {name!r}")
            continue
        start, end = block
        body_start = start + 1
        body_end = end
        new_line = format_resonants_line(keys)
        ri = find_resonants_line(lines, body_start, body_end)
        if ri is not None:
            if lines[ri].rstrip("\n") == new_line.rstrip("\n"):
                continue
            log.append(f"  data {name}.resonants: update ({len(keys)} entries)")
            if not dry_run:
                lines[ri] = new_line
            continue

        if not keys:
            continue
        si = find_sets_line(lines, body_start, body_end)
        if si is None:
            log.append(f"  [skip] no sets: for {name!r}")
            continue
        log.append(f"  data {name}.resonants: insert ({len(keys)} entries)")
        if not dry_run:
            lines[si - 1] = ensure_comma(lines[si - 1])
            lines.insert(si, new_line)

    if not dry_run and any("data " in x for x in log):
        with open(data_path, "w", encoding="utf-8", newline="\n") as f:
            f.writelines(lines)
    return log


def write_list_output(
    mapping: dict[str, list[str]],
    out_path: str,
    fmt: str,
    *,
    only_name: str | None,
) -> None:
    """Write JSON (full map) or text (one line per cookie with ≥1 resonant). out_path '-' = stdout."""
    if only_name:
        mapping = {k: v for k, v in mapping.items() if k == only_name}

    if fmt == "json":
        body = json.dumps(mapping, ensure_ascii=False, indent=2)
        if out_path == "-":
            print(body, end="")
        else:
            d = os.path.dirname(out_path)
            if d:
                os.makedirs(d, exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(body)
    else:
        lines = [
            "# Resonant topping sets each cookie can use (from cookierun.wiki Toppings).",
            "# data.js name: keys usable with getToppingImagePath / sets.resonance",
            "",
        ]
        for name in sorted(mapping.keys()):
            keys = mapping[name]
            if not keys:
                continue
            lines.append(f"{name}: {', '.join(keys)}")
        body = "\n".join(lines) + "\n"
        if out_path == "-":
            print(body, end="")
        else:
            d = os.path.dirname(out_path)
            if d:
                os.makedirs(d, exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(body)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Generate list of resonant topping sets per cookie from the wiki (no data.js by default)"
    )
    ap.add_argument("--wiki-api", default=illu.API)
    ap.add_argument(
        "--out",
        default=DEFAULT_LIST_OUT,
        help=f"Output path, or '-' for stdout (default: {DEFAULT_LIST_OUT})",
    )
    ap.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="json: all cookies including empty arrays; text: only cookies with at least one resonant",
    )
    ap.add_argument("--name", help="Only this data.js cookie name (filters list and patch)")
    ap.add_argument(
        "--patch-data-js",
        action="store_true",
        help="Also patch resonants: lines in data.js (optional; list is still written)",
    )
    ap.add_argument("--data-js", default=DATA_JS)
    args = ap.parse_args()

    wt = fetch_toppings_wikitext(args.wiki_api)
    if not wt:
        print("Failed to fetch Toppings wikitext", file=sys.stderr)
        sys.exit(1)
    section = extract_resonant_section(wt)
    if not section:
        print("No ==Resonant Toppings== section found", file=sys.stderr)
        sys.exit(1)
    cells = parse_resonant_topping_cells(section)
    if not cells:
        print("No {{Resonant toppings cell}} templates found", file=sys.stderr)
        sys.exit(1)

    rows = load_char_rows()
    mapping: dict[str, list[str]] = {}
    for r in rows:
        name = r["name"]
        display = r.get("displayName") or name
        elements = r.get("element")
        mapping[name] = build_resonants_for_cookie(display, elements, cells)

    write_list_output(mapping, args.out, args.format, only_name=args.name)

    n = sum(1 for k, v in mapping.items() if v)
    dest = "stdout" if args.out == "-" else args.out
    print(
        f"Wrote {args.format} list -> {dest}  "
        f"({len(cells)} wiki sets; {n} cookies with at least one resonant)",
        file=sys.stderr,
    )

    if args.patch_data_js:
        log = apply_resonants_to_data_js(
            mapping,
            dry_run=False,
            only_name=args.name,
            data_path=args.data_js,
        )
        if log:
            print("data.js:", file=sys.stderr)
            for line in log:
                print(line, file=sys.stderr)
        else:
            print("data.js: no changes", file=sys.stderr)


if __name__ == "__main__":
    main()
