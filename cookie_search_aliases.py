"""
Shared cookie alias map for search and wiki {{Kch|…}} expansion.

File: tools/cookie_search_aliases.json
  { "aliases": { "sf": "Sea_fairy", ... } }

Auto-generated initials from data.js names are merged at runtime (unique only).
JSON aliases override auto-initials when both exist.
"""

from __future__ import annotations

import json
import os

import import_wiki_illustrations as illu

ROOT = os.path.dirname(os.path.abspath(__file__))
ALIASES_PATH = os.path.join(ROOT, "tools", "cookie_search_aliases.json")


def normalize_alias_key(key: str) -> str:
    return str(key or "").strip().lower()


def merge_alias_dict(out: dict[str, str], raw: object) -> None:
    if not isinstance(raw, dict):
        return
    blob = raw.get("aliases") if isinstance(raw.get("aliases"), dict) else raw
    if not isinstance(blob, dict):
        return
    for k, v in blob.items():
        if v is None:
            continue
        key = normalize_alias_key(k)
        if not key or key.startswith("_"):
            continue
        out[key] = str(v).strip()


def build_auto_abbrev_from_char_rows(char_rows: list[dict]) -> dict[str, str]:
    by_abbrev: dict[str, set[str]] = {}
    for row in char_rows:
        name = str(row.get("name") or "").strip()
        if not name or "_" not in name:
            continue
        parts = [p for p in name.split("_") if p]
        if len(parts) < 2:
            continue
        ab = "".join(p[0].lower() for p in parts if p and p[0].isalnum())
        if len(ab) < 2:
            continue
        by_abbrev.setdefault(ab, set()).add(name)
    out: dict[str, str] = {}
    for ab, names in by_abbrev.items():
        if len(names) == 1:
            out[ab] = next(iter(names))
    return out


def load_aliases_file() -> dict[str, str]:
    if not os.path.isfile(ALIASES_PATH):
        return {}
    with open(ALIASES_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    # Current: { aliases: { ... } }
    merge_alias_dict(out, raw)
    # Legacy: { wiki: {}, custom: {} }
    merge_alias_dict(out, raw.get("wiki"))
    merge_alias_dict(out, raw.get("custom"))
    return out


def build_merged_alias_map(char_rows: list[dict] | None = None) -> dict[str, str]:
    """Full alias map for importers and search (auto initials + JSON aliases)."""
    rows = char_rows if char_rows is not None else illu.load_char_rows()
    out: dict[str, str] = {}
    merge_alias_dict(out, build_auto_abbrev_from_char_rows(rows))
    merge_alias_dict(out, load_aliases_file())
    return out
