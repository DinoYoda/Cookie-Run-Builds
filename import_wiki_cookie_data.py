#!/usr/bin/env python3
"""
Fetch core Cookie Run: Kingdom cookie fields from the Cookie Run Wiki (MediaWiki API).

The wiki is served from cookierun.wiki (ABXY / standard MediaWiki — same API as other importers).

For each character from tools/extract_crk_characters.mjs, resolves a wiki page and parses:
  • Infobox {{Crk cookie infobox}} or {{Cookie infobox}} → element(s), type (role), position, rarity
    (comma-separated elements → element: ["A","B"]; type/position/rarity → Title Case to match data.js).
    Newer layouts indent lines after </gallery> (space before |); those are parsed. Keys are lowercased.
    A supplemental pass fills empty fields from any |key = value line in the infobox text.
  • Flavor text: == Game Description == on the resolved page (heading may use bold, e.g. =='''Game Description'''==);
    if absent, many Kingdom articles use ==Story== for the same blurb. If still missing on …/Kingdom, hub
    ==Description== <tabber> Kingdom= branch
  • CN-exclusive articles (data.js cnEx) often wrap Story in <tabber> Original Chinese / English Translation —
    we keep only the English Translation branch. The same split applies to any skill/description field that
    uses that tabber pair. Regular Kingdom pages are unchanged.
  • {{Kch|…}} / {{CookieHead|…}} — balanced {{…}}; named args (icononly=, game=, …) ignored; visible text
    or prettified slug, e.g. {{Kch|orange|one friend}} → one friend; {{Kch|x|'s}} → possessive. {{Sic}} → (sic).
  • {{Crk skill box}} — first on the page = base skill; further boxes under ===Magic Candy Skill=== /
    ===[[Crystal Jam]] Skill=== (or “crystal jam” / “magic candy” in the skill text) = mcSkill / cjSkill.
    Skill name: |Name=, |name=, |Skill=, |skill=; if still missing, infobox keys skill / skillname / base skill, etc.

Output: a .js file assigning to window, using data.js-like syntax (unquoted keys where valid).
  • cookies — array of stat objects (name, element, type, position, rarity, skill,
    optional cd + initial; optional mcSkill, cjSkill, mcInitial, cjInitial when present; cnEx when
    set in data.js (informational for importers / dry-run preview).
    MC/CJ Cooldown is parsed but not emitted as mcCd/cjCd — uncomment those lines in main if data.js adds them.
  • descriptions — description { slug: … }, skill_description { slug: base, slug_mc: MC, slug_cj: CJ }.
    Paragraph breaks from the wiki become <br><br>; single newlines become <br> for HTML display.
    Full regeneration of a descriptions file from wiki is the intended end state; this layout matches that.
  Use --format json for strict JSON. By default, after writing --out, also patches data.js and
  crk/crk_descriptions.js when values differ (same as apply_wiki_cookie_data.py). Use --no-apply to only write the artifact.

Page title resolution (first match with game data: {{Crk cookie infobox}} or {{Cookie infobox}} + skill box):
  Candidate order (deduped): data.js displayName, then optional entry in tools/wiki_cookie_name_overrides.json
  { "Data_js_name": "Alternate wiki article title" }. For each label, try "<label>/Kingdom" then "<label>" (strip /Kingdom as the hub fallback for ancients and similar layouts).

  If none resolve: wiki search for "{displayName} Kingdom".

  Redirect safety: the API’s canonical page title (after any redirects) must match this cookie’s
  expected stems (data.js name / displayName / wiki_cookie_name_overrides). We always enforce this —
  not only when MediaWiki lists redirects in the query — so a bad redirect or wrong search hit
  (e.g. Tengshe ↔ GingerBrave) cannot apply another cookie’s infobox.

Usage:
  python import_wiki_cookie_data.py
  python import_wiki_cookie_data.py --dry-run
  python import_wiki_cookie_data.py --name Camellia
  python import_wiki_cookie_data.py --out tools/imported_cookie_data.js
  python import_wiki_cookie_data.py --format json --out tools/imported_cookie_data.js
  python import_wiki_cookie_data.py --wiki-api https://cookierun.wiki/mw/api.php
  python import_wiki_cookie_data.py --no-apply  # import file only
  python apply_wiki_cookie_data.py              # merge only (re-fetches wiki)
  python apply_wiki_cookie_data.py --dry-run

Requires: Node.js, Python 3.9+
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import urllib.parse
from typing import Any

import import_wiki_illustrations as illu
from wiki_expand_kch import expand_wiki_head_icon_templates_plain
from wiki_expand_status import (
    expand_wiki_status_templates,
    expand_wiki_tip_templates,
    split_balanced_piped_args,
)

ROOT = illu.ROOT
NAME_ALTERNATES_PATH = os.path.join(ROOT, "tools", "wiki_cookie_name_overrides.json")
DEFAULT_OUT = os.path.join(ROOT, "tools", "imported_cookie_data.js")
DEFAULT_GLOBAL = "WIKI_IMPORTED_COOKIE_DATA"
DEFAULT_DATA_JS = os.path.join(ROOT, "data.js")
DEFAULT_DESC_JS = os.path.join(ROOT, "crk", "crk_descriptions.js")
SKILL_HEADER_HEX_PATH = os.path.join(ROOT, "tools", "wiki_cookie_skill_header_hex.json")
_skill_header_hex_map: dict[str, str] | None = None

INFOBOX_START = "{{Crk cookie infobox"
INFOBOX_FALLBACK = "{{Cookie infobox"
SKILL_BOX_START = "{{Crk skill box"


def load_cookie_name_alternates() -> dict[str, str]:
    """Map data.js `name` → alternate wiki article title (tried after …/Kingdom + hub for displayName)."""
    if not os.path.isfile(NAME_ALTERNATES_PATH):
        return {}
    with open(NAME_ALTERNATES_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k): str(v) for k, v in raw.items()}


def load_title_overrides() -> dict[str, str]:
    """Deprecated alias for ``load_cookie_name_alternates`` (old wiki page override name)."""
    return load_cookie_name_alternates()


def api_get(base: str, params: dict) -> dict:
    params = {**params, "format": "json"}
    url = base + "?" + urllib.parse.urlencode(params)
    return illu.http_json(url)


def _wiki_title_stem_for_match(title: str) -> str:
    """Normalize a wiki page title (compare using same rules as displayName / alternate labels)."""
    base = (title or "").split("/")[0].strip()
    stem = illu.display_name_plain_slug(base)
    if stem.endswith("_cookie"):
        stem = stem[: -len("_cookie")].rstrip("_")
    return stem


def _allowed_wiki_title_stems(
    name: str, display_name: str, name_alternates: dict[str, str]
) -> set[str]:
    """Stems that are valid for this data.js character (resolved page must match one when redirects were used)."""
    stems: set[str] = set()
    stems.add(illu.cookie_name_to_wiki_slug(name))
    for label in (display_name, (name_alternates.get(name) or "").strip()):
        if not label:
            continue
        p = illu.display_name_plain_slug(label)
        if p:
            stems.add(p)
            if p.endswith("_cookie"):
                stems.add(p[: -len("_cookie")].rstrip("_"))
    return {x for x in stems if x}


def wiki_resolved_title_matches_cookie(
    resolved_title: str | None,
    name: str,
    display_name: str,
    name_alternates: dict[str, str],
) -> bool:
    if not resolved_title:
        return False
    stem = _wiki_title_stem_for_match(resolved_title)
    allowed = _allowed_wiki_title_stems(name, display_name, name_alternates)
    return stem in allowed


def fetch_wikitext_with_meta(
    api: str, title: str
) -> tuple[str | None, str | None, bool]:
    """
    Returns (wikitext, canonical_page_title_after_redirects, api_followed_a_redirect).
    Missing page → (None, None, False).
    """
    data = api_get(
        api,
        {
            "action": "query",
            "prop": "revisions",
            "rvprop": "content",
            "rvslots": "main",
            "titles": title,
            "redirects": 1,
        },
    )
    pages = data.get("query", {}).get("pages", {})
    followed = bool(data.get("query", {}).get("redirects"))
    for p in pages.values():
        if not isinstance(p, dict) or "missing" in p:
            continue
        try:
            if int(p.get("pageid", 0)) < 0:
                continue
        except (TypeError, ValueError):
            continue
        revs = p.get("revisions")
        if not revs:
            continue
        final_title = (p.get("title") or "").strip() or None
        slot = revs[0].get("slots", {}).get("main", {})
        wt = slot.get("*")
        return wt, final_title, followed
    return None, None, False


def fetch_wikitext(api: str, title: str) -> str | None:
    wt, _, _ = fetch_wikitext_with_meta(api, title)
    return wt


def has_cookie_infobox(text: str) -> bool:
    return INFOBOX_START.lower() in text.lower()


def has_usable_kingdom_page(text: str) -> bool:
    """Kingdom article with CRK infobox, or Cookie infobox plus at least one Crk skill box."""
    if has_cookie_infobox(text):
        return True
    if find_template_start(text, INFOBOX_FALLBACK) < 0:
        return False
    return find_template_start(text, SKILL_BOX_START) >= 0


def find_template_start(wikitext: str, canonical: str) -> int:
    """Case-insensitive start index of {{... template, or -1."""
    low = wikitext.lower()
    needle = canonical.lower()
    return low.find(needle)


def _wiki_title_candidates(display_name: str, alternate_label: str | None) -> list[str]:
    """Ordered titles: each base label adds '<base>/Kingdom' then '<base>' (ancients / hub fallback)."""
    out: list[str] = []
    seen: set[str] = set()

    def add_pair(base: str) -> None:
        b = (base or "").strip()
        if not b:
            return
        kingdom = f"{b}/Kingdom"
        for t in (kingdom, b):
            if t not in seen:
                seen.add(t)
                out.append(t)

    add_pair(display_name)
    if alternate_label:
        add_pair(alternate_label)
    return out


def resolve_wiki_title(api: str, name: str, display_name: str, name_alternates: dict[str, str]) -> str | None:
    alt = (name_alternates.get(name) or "").strip() or None
    for t in _wiki_title_candidates(display_name, alt):
        wt, resolved, _followed = fetch_wikitext_with_meta(api, t)
        if not wt or not has_usable_kingdom_page(wt):
            continue
        if not wiki_resolved_title_matches_cookie(
            resolved, name, display_name, name_alternates
        ):
            continue
        return t
    # search fallback: first exact-ish Kingdom hub
    term = f"{display_name} Kingdom"
    data = api_get(
        api,
        {
            "action": "query",
            "list": "search",
            "srsearch": term,
            "srnamespace": 0,
            "srlimit": 10,
        },
    )
    for hit in data.get("query", {}).get("search", []):
        tit = hit.get("title", "")
        if tit.endswith("/Kingdom") and "/Kingdom/" not in tit:
            wt, resolved, _followed = fetch_wikitext_with_meta(api, tit)
            if not wt or not has_usable_kingdom_page(wt):
                continue
            if not wiki_resolved_title_matches_cookie(
                resolved, name, display_name, name_alternates
            ):
                continue
            return tit
    return None


def extract_balanced_template(wikitext: str, start_marker: str) -> str | None:
    idx = find_template_start(wikitext, start_marker)
    if idx < 0:
        return None
    depth = 0
    j = idx
    n = len(wikitext)
    while j < n:
        if wikitext.startswith("{{", j):
            depth += 1
            j += 2
        elif wikitext.startswith("}}", j):
            depth -= 1
            j += 2
            if depth == 0:
                return wikitext[idx:j]
        else:
            j += 1
    return None


def _strip_trailing_infobox_close(s: str) -> str:
    """Remove trailing }} when the last field shares a line with the template end (|element=Dark}})."""
    return re.sub(r"\}\}\s*$", "", (s or "").strip()).strip()


def infobox_key_values(block: str) -> dict[str, str]:
    """
    Parse piped fields inside a template block (handles multiline values).
    Lines may be indented (e.g. after </gallery>); leading whitespace before | is ignored.
    """
    out: dict[str, str] = {}
    lines = block.split("\n")
    current_key: str | None = None
    buf: list[str] = []
    for line in lines:
        leader = line.lstrip()
        if leader.startswith("|"):
            if current_key is not None:
                out[current_key] = _strip_trailing_infobox_close("\n".join(buf))
            rest = leader[1:]
            if "=" not in rest:
                current_key = rest.strip()
                buf = []
                continue
            k, _, v = rest.partition("=")
            current_key = k.strip()
            buf = [_strip_trailing_infobox_close(v)]
        elif current_key is not None:
            if re.fullmatch(r"\s*\}\}\s*", line):
                out[current_key] = _strip_trailing_infobox_close("\n".join(buf))
                current_key = None
                buf = []
                continue
            buf.append(line)
    if current_key is not None:
        out[current_key] = _strip_trailing_infobox_close("\n".join(buf))
    return {k.strip().lower(): v for k, v in out.items()}


# Any line in the infobox that looks like |key = value (wiki often indents after </gallery>).
_INFOBOX_LOOSE_PIPE_RE = re.compile(r"(?m)^\s*\|\s*([^\s=|]+?)\s*=\s*(.*)$")


def supplement_infobox_fields_from_pipe_lines(block: str, fields: dict[str, str]) -> None:
    """
    Fill keys that are still empty after infobox_key_values. Newer wiki layouts indent
    parameters; if those were mis-attached to a previous multiline value, this pass still
    picks up |rarity=, |role=, |position=, |element(s)=, etc.
    """
    for m in _INFOBOX_LOOSE_PIPE_RE.finditer(block):
        k = m.group(1).strip().lower()
        v = _strip_trailing_infobox_close(m.group(2))
        if not k or not v:
            continue
        prev = fields.get(k)
        if prev is None or not str(prev).strip():
            fields[k] = v


def normalize_element(raw: str | None) -> str | list[str] | None:
    """Infobox `elements` may be comma-separated; one value → str, several → list (matches data.js)."""
    if not raw or not raw.strip():
        return None
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    normed: list[str] = []
    for p in parts:
        low = p.lower()
        if low in ("none", "n/a", "-", ""):
            continue
        normed.append(p.title() if p.isascii() else p)
    if not normed:
        return None
    if len(normed) == 1:
        return normed[0]
    return normed


# Wiki templates often use lowercase; data.js uses Title Case (per-word), with a few exceptions.
_INFOBOX_LABEL_WORD_OVERRIDES: dict[str, str] = {
    "bts": "BTS",
}


def normalize_infobox_label(raw: str | None) -> str | None:
    """Normalize role/type, position, and rarity strings to match data.js capitalization."""
    if not raw or not raw.strip():
        return None
    t = re.sub(r"\s+", " ", raw.strip())
    parts: list[str] = []
    for w in t.split():
        wl = w.lower()
        if wl in _INFOBOX_LABEL_WORD_OVERRIDES:
            parts.append(_INFOBOX_LABEL_WORD_OVERRIDES[wl])
        else:
            parts.append(wl.capitalize())
    return " ".join(parts)


def normalize_rarity(raw: str | None) -> str | None:
    return normalize_infobox_label(raw)


def prefer_english_tabber_branch(text: str | None) -> str | None:
    """
    CN wiki pages use <tabber> with Original Chinese vs English Translation.
    If present, keep only the English Translation panel body (through </tabber>).
    """
    if not text or "<tabber" not in text.lower():
        return text
    m = re.search(r"\|-\|\s*English\s+Translation\s*=\s*", text, flags=re.I)
    if not m:
        return text
    rest = text[m.end() :]
    m_close = re.search(r"</tabber\s*>", rest, flags=re.I)
    body = rest[: m_close.start()].strip() if m_close else rest.strip()
    return body or text


def extract_game_description(wikitext: str) -> str | None:
    """Match == Game Description == even when the wiki wraps the title in bold (=='''Game Description'''==)."""
    m = re.search(
        r"(?m)^==[^=\n][^\n]*?Game Description[^\n]*?==\s*$",
        wikitext,
    )
    if m:
        nl = wikitext.find("\n", m.start())
        rest = wikitext[nl + 1 :] if nl >= 0 else ""
    else:
        rest = None
        for marker in ("== Game Description ==", "==Game Description==", "== Game Description=="):
            idx = wikitext.find(marker)
            if idx >= 0:
                rest = wikitext[idx + len(marker) :]
                break
        if rest is None:
            return None
    m2 = re.search(r"^==[^=]", rest, re.MULTILINE)
    end = m2.start() if m2 else len(rest)
    chunk = rest[:end].strip()
    if "\n===" in chunk:
        chunk = chunk.split("\n===", 1)[0].strip()
    chunk = prefer_english_tabber_branch(chunk) or chunk
    chunk = re.sub(r"^''+|''+$", "", chunk)
    chunk = chunk.strip()
    if chunk.startswith("''") and chunk.endswith("''"):
        chunk = chunk[2:-2].strip()
    return chunk or None


def extract_story_section(wikitext: str) -> str | None:
    """Kingdom pages that omit Game Description often put flavor text under ==Story== (same layout as that section)."""
    m = re.search(
        r"(?m)^==[^=\n][^\n]*?\bStory\b[^\n]*?==\s*$",
        wikitext,
    )
    if m:
        nl = wikitext.find("\n", m.start())
        rest = wikitext[nl + 1 :] if nl >= 0 else ""
    else:
        rest = None
        for marker in ("==Story==", "== Story ==", "=='''Story'''==", "== '''Story''' =="):
            idx = wikitext.find(marker)
            if idx >= 0:
                rest = wikitext[idx + len(marker) :]
                break
        if rest is None:
            return None
    m2 = re.search(r"^==[^=]", rest, re.MULTILINE)
    end = m2.start() if m2 else len(rest)
    chunk = rest[:end].strip()
    if "\n===" in chunk:
        chunk = chunk.split("\n===", 1)[0].strip()
    chunk = prefer_english_tabber_branch(chunk) or chunk
    chunk = re.sub(r"^''+|''+$", "", chunk)
    chunk = chunk.strip()
    if chunk.startswith("''") and chunk.endswith("''"):
        chunk = chunk[2:-2].strip()
    return chunk or None


def extract_hub_kingdom_tab_description(wikitext: str) -> str | None:
    """Hub pages often put CRK flavor text under ==Description== → <tabber> → Kingdom= … |-|."""
    m_hdr = re.search(
        r"(?m)^==[^=\n][^\n]*?\bDescription\b[^\n]*?==\s*$",
        wikitext,
    )
    if m_hdr:
        nl = wikitext.find("\n", m_hdr.start())
        rest = wikitext[nl + 1 :] if nl >= 0 else ""
    else:
        rest = None
        for marker in ("== Description ==", "==Description=="):
            idx = wikitext.find(marker)
            if idx >= 0:
                rest = wikitext[idx + len(marker) :]
                break
        if rest is None:
            return None
    m2 = re.search(r"^==[^=]", rest, re.MULTILINE)
    end = m2.start() if m2 else len(rest)
    chunk = rest[:end]
    if "<tabber" not in chunk.lower():
        return None
    m_tab = re.search(r"Kingdom\s*=\s*\n([\s\S]*?)(?=\n\|-\|)", chunk, re.IGNORECASE)
    if not m_tab:
        return None
    body = m_tab.group(1).strip()
    body = prefer_english_tabber_branch(body) or body
    if body.startswith("''") and body.endswith("''"):
        body = body[2:-2].strip()
    return body or None


def parse_wiki_number(raw: str | None) -> int | float | None:
    if not raw:
        return None
    s = raw.strip()
    if not s or s in (".", "-", "—", "N/A", "n/a"):
        return None
    s = re.sub(r"\s+", "", s)
    try:
        if "." in s:
            v = float(s)
            if v == int(v):
                return int(v)
            return v
        return int(s, 10)
    except ValueError:
        return None


# Next top-level field in {{Crk skill box|…}} (not inside nested {{…}} e.g. {{Color|…|#hex|size=15}}).
_SKILL_BOX_NEXT_PARAM_AT = re.compile(
    r"^\|\s*(?:[A-Za-z_][A-Za-z0-9_ ]*|\d+)\s*=",
)


def _skill_box_param_value(block: str, key: str) -> str | None:
    """Raw value for |Key=… up to the next top-level |Param=. Ignores |foo= inside nested {{…}}."""
    m = re.search(rf"\|\s*{re.escape(key)}\s*=\s*", block, re.I)
    if not m:
        return None
    rest = block[m.end() :]
    i = 0
    n = len(rest)
    depth = 0
    while i < n:
        if i + 2 <= n and rest[i : i + 2] == "{{":
            depth += 1
            i += 2
            continue
        if i + 2 <= n and rest[i : i + 2] == "}}" and depth > 0:
            depth -= 1
            i += 2
            continue
        if depth == 0 and rest[i] == "|" and _SKILL_BOX_NEXT_PARAM_AT.match(rest[i:]):
            val = rest[:i].strip()
            return _strip_trailing_infobox_close(val) if val else None
        i += 1
    val = _strip_trailing_infobox_close(rest.strip())
    return val if val else None


def extract_skill_box_name(block: str) -> str | None:
    """|Name= / |Skill= on the skill box; strip wiki markup. Handles |Name=X|Cooldown=… on one line."""
    for key in ("Name", "Skill"):
        raw = _skill_box_param_value(block, key)
        if raw is None:
            continue
        if not raw or raw.lower() in ("none", "n/a", "tba", "-", "—", "null"):
            continue
        cleaned = strip_wiki_markup(raw).strip()
        if cleaned:
            return cleaned.split("\n")[0].split("<br")[0].strip()
    return None


_INFOBOX_SKILL_NAME_KEYS = frozenset(
    {
        "skill",
        "skillname",
        "skill name",
        "skill_name",
        "baseskill",
        "base skill",
        "base_skill",
        "skill1",
    }
)


def skill_name_from_infobox(fields: dict[str, str]) -> str | None:
    """Some cookies use infobox skill fields instead of |Name= in {{Crk skill box}}."""
    for k, v in fields.items():
        nk = re.sub(r"\s+", " ", k.strip().lower())
        if nk not in _INFOBOX_SKILL_NAME_KEYS:
            continue
        raw = (v or "").strip()
        if not raw or raw.lower() in ("none", "n/a", "tba", "-", "—", "null"):
            continue
        cleaned = strip_wiki_markup(raw).strip()
        if cleaned:
            return cleaned.split("\n")[0].split("<br")[0].strip()
    return None


def parse_skill_box_block(
    block: str,
) -> tuple[str | None, str | None, int | float | None, int | float | None]:
    name = extract_skill_box_name(block)
    desc_raw = _skill_box_param_value(block, "Description")
    desc = desc_raw.strip() if desc_raw else None
    cd_raw = _skill_box_param_value(block, "Cooldown")
    init_raw = _skill_box_param_value(block, "Initial")
    cd = parse_wiki_number(cd_raw) if cd_raw else None
    initial = parse_wiki_number(init_raw) if init_raw else None
    return name, desc, cd, initial


def parse_skill_box(
    wikitext: str,
) -> tuple[str | None, str | None, int | float | None, int | float | None]:
    block = extract_balanced_template(wikitext, SKILL_BOX_START)
    if not block:
        return None, None, None, None
    return parse_skill_box_block(block)


def find_all_skill_box_blocks(wikitext: str) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    idx = 0
    while True:
        pos = wikitext.find(SKILL_BOX_START, idx)
        if pos < 0:
            break
        block = extract_balanced_template(wikitext[pos:], SKILL_BOX_START)
        if block:
            out.append((pos, block))
            idx = pos + len(block)
        else:
            idx = pos + 1
    return out


def last_wiki_heading_before(wikitext: str, pos: int, lookback: int = 5000) -> str:
    chunk = wikitext[max(0, pos - lookback) : pos]
    heads = re.findall(r"(?m)^={2,4}([^=\n].*?)={2,4}\s*$", chunk)
    return heads[-1].strip() if heads else ""


def classify_mc_cj_heading(heading_inner: str) -> str | None:
    """Return 'mc', 'cj', or None from heading text between === … ===."""
    if not heading_inner:
        return None
    h = heading_inner
    h = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", h)
    low = h.lower()
    if "crystal jam" in low:
        return "cj"
    if "magic candy" in low:
        return "mc"
    return None


def classify_mc_cj_block(pos: int, block: str, wikitext: str) -> str | None:
    hkind = classify_mc_cj_heading(last_wiki_heading_before(wikitext, pos))
    if hkind:
        return hkind
    _n, desc, _c, _i = parse_skill_box_block(block)
    if not desc:
        return None
    low = desc.lower()
    if "crystal jam" in low:
        return "cj"
    if "magic candy" in low:
        return "mc"
    return None


_COLOR_OPEN_RE = re.compile(r"\{\{\s*Color\s*\|", re.I)


def _wiki_hex_for_css(hex_digits: str) -> str:
    """Normalize wiki hex (3/6/8 digit, no #) for a CSS color value."""
    hx = hex_digits.upper()
    if len(hx) == 3:
        return "".join(c + c for c in hx)
    return hx


def _load_skill_header_hex_map() -> dict[str, str]:
    """data.js / wiki slug → 6-digit hex for color-header{HEX:…} (tools/wiki_cookie_skill_header_hex.json)."""
    global _skill_header_hex_map
    if _skill_header_hex_map is not None:
        return _skill_header_hex_map
    _skill_header_hex_map = {}
    if os.path.isfile(SKILL_HEADER_HEX_PATH):
        with open(SKILL_HEADER_HEX_PATH, encoding="utf-8") as f:
            raw = json.load(f)
        for k, v in raw.items():
            if v is None or not str(v).strip():
                continue
            hx = str(v).strip().lstrip("#").upper()
            if re.fullmatch(r"[0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8}", hx):
                _skill_header_hex_map[str(k).strip()] = _wiki_hex_for_css(hx) if len(hx) == 3 else hx
    return _skill_header_hex_map


def _skill_header_hex_for_slug(cookie_slug: str | None) -> str | None:
    if not cookie_slug:
        return None
    return _load_skill_header_hex_map().get(cookie_slug.strip())


def _mw_balanced_double_brace_span(s: str, start: int) -> tuple[int, int] | None:
    """If s[start:].startswith('{{'), return [start, end) covering the matching outer {{…}}."""
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
                return start, j
        else:
            j += 1
    return None


def _color_template_block_to_site(block: str, cookie_slug: str | None) -> str:
    """
    {{Color|label|#hex|…}} → color-header{HEX:label} (label may contain status{…}; balanced | for nested Status).
    Single-arg or missing hex → color-header from tools/wiki_cookie_skill_header_hex.json, else slug fallback.
    """
    b = block.strip()
    m_open = re.match(r"^\{\{\s*Color\s*\|", b, re.I)
    if not m_open or not b.endswith("}}"):
        return block
    inner = b[m_open.end() : -2]
    inner = expand_wiki_status_templates(inner)
    raw_parts = split_balanced_piped_args(inner)
    theme_hex = _skill_header_hex_for_slug(cookie_slug)

    def _emit_header(label: str) -> str:
        if theme_hex and label:
            return f"color-header{{{theme_hex}:{label}}}"
        if cookie_slug and label:
            return f"color-header{{{cookie_slug}:{label}}}"
        return label if label else block

    if len(raw_parts) < 2:
        lone = raw_parts[0].strip() if raw_parts else ""
        if lone:
            return _emit_header(lone)
        return block
    title = raw_parts[0].strip()
    hex_candidate = raw_parts[1].strip()
    hex_m = re.match(
        r"^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
        hex_candidate,
    )
    if hex_m and title:
        hx = _wiki_hex_for_css(hex_m.group(1))
        return f"color-header{{{hx}:{title}}}"
    return _emit_header(title)


def expand_wiki_color_templates(s: str, *, cookie_slug: str | None = None) -> str:
    """
    {{Color|Visible text|#RRGGBB|size=…|…}} → color-header{HEX:…} (extra params dropped).
    Uses balanced {{…}} matching so inner | and }} in other params do not break parsing.
    """
    out: list[str] = []
    i = 0
    while True:
        m = _COLOR_OPEN_RE.search(s, i)
        if not m:
            out.append(s[i:])
            break
        out.append(s[i : m.start()])
        span = _mw_balanced_double_brace_span(s, m.start())
        if not span:
            out.append(s[m.start() : m.start() + 2])
            i = m.start() + 2
            continue
        start, end = span
        out.append(_color_template_block_to_site(s[start:end], cookie_slug))
        i = end
    return "".join(out)


def strip_wiki_markup(s: str) -> str:
    if not s:
        return s
    s = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", s)
    s = re.sub(r"\[\[([^\]]+)\]\]", r"\1", s)
    s = expand_wiki_tip_templates(s)
    s = re.sub(r"\{\{Element\|([^|}|]+)\|([^}]+)\}\}", r"\2", s)
    s = re.sub(r"\{\{PatchCRK\|[^}]+\}\}", "", s)
    s = re.sub(r"\{\{Translation\}\}\s*", "", s, flags=re.I)
    s = expand_wiki_head_icon_templates_plain(s)
    s = re.sub(r"\{\{Type\|([^}]+)\}\}", r"\1", s)
    s = re.sub(r"\{\{Sic\}\}", "(sic)", s, flags=re.I)
    s = expand_wiki_status_templates(s)
    s = expand_wiki_color_templates(s)
    s = re.sub(r"\{\{[^}]+\}\}", "", s)
    s = re.sub(r"'''?", "", s)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def finalize_crk_description_for_html(s: str | None) -> str | None:
    """Turn wiki paragraph/line breaks into HTML for CRK_DESCRIPTIONS (site renders via innerHTML / <br> splits)."""
    if s is None:
        return None
    t = s.replace("\r\n", "\n").replace("\r", "\n")
    t = re.sub(r"\n{2,}", "<br><br>", t)
    t = re.sub(r"\n", "<br>", t)
    return t.strip()


def descriptions_js_key(name: str) -> str:
    return illu.cookie_name_to_wiki_slug(name)


def js_key(k: str) -> str:
    if re.fullmatch(r"[A-Za-z_$][\w$]*", k):
        return k
    return json.dumps(k, ensure_ascii=False)


def format_js_value(v: Any, indent: int) -> str:
    sp = "    " * indent
    ch = "    " * (indent + 1)
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        if v != v or v in (float("inf"), float("-inf")):
            return "null"
        return str(v)
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):
        if not v:
            return "[]"
        parts = [f"{ch}{format_js_value(item, indent + 1)}" for item in v]
        return "[\n" + ",\n".join(parts) + "\n" + sp + "]"
    if isinstance(v, dict):
        if not v:
            return "{}"
        parts = [f"{ch}{js_key(str(k))}: {format_js_value(val, indent + 1)}" for k, val in v.items()]
        return "{\n" + ",\n".join(parts) + "\n" + sp + "}"
    raise TypeError(f"unsupported {type(v)}")


def write_output(path: str, data: dict[str, Any], fmt: str, global_name: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    if fmt == "json":
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return
    if fmt != "js":
        raise ValueError(f"unknown format {fmt}")
    body = format_js_value(data, 0)
    with open(path, "w", encoding="utf-8") as f:
        f.write(
            "// Generated by import_wiki_cookie_data.py — cookies[] → data.js characters; "
            "descriptions → merge into crk/crk_descriptions.js (or replace when doing a full regen).\n"
        )
        f.write(f"window.{global_name} = ")
        f.write(body)
        f.write(";\n")


def build_import_document(
    rows: list[dict[str, Any]],
    api: str,
    name_alternates: dict[str, str],
    verbose: bool = False,
) -> tuple[dict[str, Any], int, int]:
    """Fetch wiki data for each row; return (document, resolved_count, missing_count)."""
    out_doc: dict[str, Any] = {
        "wikiApi": api,
        "cookies": [],
        "descriptions": {
            "description": {},
            "skill_description": {},
        },
    }
    ok = 0
    fail = 0

    for r in rows:
        name = r["name"]
        display = r.get("displayName") or name
        if verbose:
            print("...", name, display, file=sys.stderr)

        title = resolve_wiki_title(api, name, display, name_alternates)
        if not title:
            if verbose:
                print("  [no page]", name, file=sys.stderr)
            fail += 1
            continue

        wt = fetch_wikitext(api, title)
        if not wt:
            fail += 1
            continue

        infobox_block = extract_balanced_template(wt, INFOBOX_START)
        if not infobox_block:
            infobox_block = extract_balanced_template(wt, INFOBOX_FALLBACK)
        if not infobox_block:
            fail += 1
            continue
        fields = infobox_key_values(infobox_block)
        supplement_infobox_fields_from_pipe_lines(infobox_block, fields)

        role = normalize_infobox_label((fields.get("role") or fields.get("type") or "").strip() or None)
        pos = normalize_infobox_label((fields.get("position") or "").strip() or None)
        rarity = normalize_infobox_label((fields.get("rarity") or "").strip() or None)
        if rarity and rarity.replace(" ", "").lower() == "awakenedancient":
            rarity = "AncientA"
        elem_raw = fields.get("elements") or fields.get("element")

        game_desc = extract_game_description(wt) or extract_story_section(wt)
        if not game_desc and title.endswith("/Kingdom"):
            hub_title = title[: -len("/Kingdom")]
            hub_wt = fetch_wikitext(api, hub_title)
            if hub_wt:
                game_desc = extract_hub_kingdom_tab_description(hub_wt)

        skill_boxes = find_all_skill_box_blocks(wt)
        if not skill_boxes:
            fail += 1
            continue
        skill_name, skill_desc, skill_cd, skill_initial = parse_skill_box_block(skill_boxes[0][1])
        if not skill_name:
            skill_name = skill_name_from_infobox(fields)
        if skill_desc:
            skill_desc = prefer_english_tabber_branch(skill_desc) or skill_desc

        mc_skill: str | None = None
        mc_desc_raw: str | None = None
        mc_cd: int | float | None = None
        mc_initial: int | float | None = None
        cj_skill: str | None = None
        cj_desc_raw: str | None = None
        cj_cd: int | float | None = None
        cj_initial: int | float | None = None
        for box_pos, block in skill_boxes[1:]:
            kind = classify_mc_cj_block(box_pos, block, wt)
            if not kind:
                continue
            sn, sd, scd, si = parse_skill_box_block(block)
            if sd:
                sd = prefer_english_tabber_branch(sd) or sd
            if kind == "mc" and mc_skill is None:
                mc_skill, mc_desc_raw, mc_cd, mc_initial = sn, sd, scd, si
            elif kind == "cj" and cj_skill is None:
                cj_skill, cj_desc_raw, cj_cd, cj_initial = sn, sd, scd, si

        elem = normalize_element(elem_raw)
        game_plain = finalize_crk_description_for_html(strip_wiki_markup(game_desc)) if game_desc else None
        skill_plain = finalize_crk_description_for_html(strip_wiki_markup(skill_desc)) if skill_desc else None

        dk = descriptions_js_key(name)
        cookie_row: dict[str, Any] = {
            "name": name,
            "element": elem,
            "type": role,
            "position": pos,
            "rarity": rarity,
            "skill": skill_name,
        }
        if skill_cd is not None:
            cookie_row["cd"] = skill_cd
        if skill_initial is not None:
            cookie_row["initial"] = skill_initial
        if r.get("cnEx"):
            cookie_row["cnEx"] = True
        if mc_skill:
            cookie_row["mcSkill"] = mc_skill
        # if mc_cd is not None:
        #     cookie_row["mcCd"] = mc_cd  # not in data.js; re-enable if the schema adds it
        if mc_initial is not None:
            cookie_row["mcInitial"] = mc_initial
        if cj_skill:
            cookie_row["cjSkill"] = cj_skill
        # if cj_cd is not None:
        #     cookie_row["cjCd"] = cj_cd  # not in data.js; re-enable if the schema adds it
        if cj_initial is not None:
            cookie_row["cjInitial"] = cj_initial
        if game_plain:
            out_doc["descriptions"]["description"][dk] = game_plain
        if skill_plain:
            out_doc["descriptions"]["skill_description"][dk] = skill_plain
        if mc_desc_raw:
            mc_plain = finalize_crk_description_for_html(strip_wiki_markup(mc_desc_raw))
            if mc_plain:
                out_doc["descriptions"]["skill_description"][f"{dk}_mc"] = mc_plain
        if cj_desc_raw:
            cj_plain = finalize_crk_description_for_html(strip_wiki_markup(cj_desc_raw))
            if cj_plain:
                out_doc["descriptions"]["skill_description"][f"{dk}_cj"] = cj_plain

        if verbose:
            print(f"[ok] {name} <- {title}", file=sys.stderr)
            print(
                f"     element={elem} type={role} skill={skill_name} cd={skill_cd} initial={skill_initial} "
                f"mc={mc_skill} cj={cj_skill}",
                file=sys.stderr,
            )
        out_doc["cookies"].append(cookie_row)
        ok += 1

    return out_doc, ok, fail


def main() -> None:
    ap = argparse.ArgumentParser(description="Import cookie stats/descriptions from Cookie Run Wiki API")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--name", help="Only this data.js cookie name")
    ap.add_argument("--out", default=DEFAULT_OUT, help="Output path (.js or .json)")
    ap.add_argument(
        "--format",
        choices=("js", "json"),
        default="js",
        help="Output format (default: js for window.* assignment)",
    )
    ap.add_argument(
        "--global-name",
        default=DEFAULT_GLOBAL,
        help=f"window property name when --format js (default: {DEFAULT_GLOBAL})",
    )
    ap.add_argument("--wiki-api", default=illu.API, help="MediaWiki api.php URL")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument(
        "--no-apply",
        action="store_true",
        help="Do not patch data.js / crk_descriptions.js after import (only write --out)",
    )
    ap.add_argument("--data-js", default=DEFAULT_DATA_JS, help="With apply: data.js path")
    ap.add_argument(
        "--descriptions-js",
        default=DEFAULT_DESC_JS,
        help="With apply: crk/crk_descriptions.js path",
    )
    ap.add_argument("--no-data", action="store_true", help="With apply: skip data.js")
    ap.add_argument(
        "--no-descriptions",
        action="store_true",
        help="With apply: skip crk_descriptions.js",
    )
    args = ap.parse_args()

    name_alternates = load_cookie_name_alternates()
    rows = illu.load_char_rows()
    if args.name:
        rows = [r for r in rows if r["name"] == args.name]
        if not rows:
            print("No character named", args.name, file=sys.stderr)
            sys.exit(1)

    out_doc, ok, fail = build_import_document(rows, args.wiki_api, name_alternates, verbose=args.verbose)

    if not args.dry_run:
        write_output(args.out, out_doc, args.format, args.global_name)
        print(f"Wrote {args.out} ({args.format})  cookies={ok} missing={fail}")
        if not args.no_apply:
            import apply_wiki_cookie_data as _apply

            data_changed, desc_changed, log = _apply.apply_wiki_import_doc(
                out_doc,
                dry_run=False,
                data_js=args.data_js,
                descriptions_js=args.descriptions_js,
                no_data=args.no_data,
                no_descriptions=args.no_descriptions,
            )
            if log:
                print("Apply (data.js / crk_descriptions.js):")
                for line in log:
                    print(line)
            else:
                print("Apply: no differences to patch.")
    else:
        print(f"Dry-run done. resolved={ok} missing={fail}")


if __name__ == "__main__":
    main()
