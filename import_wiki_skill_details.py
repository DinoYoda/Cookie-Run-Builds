#!/usr/bin/env python3
"""
Convert Cookie Run Wiki {{Crk skill box}} |Base= / |Max= / |Notes= (and MC |10=|20=|30=, |1A=…|5A=)
into site strings + skillAttr aligned with crk/crk_descriptions.js.

Emitted per cookie (when applicable):
  • skill_details — Base+Max merged main body only (rally div text → rally_effects). Rally lines
    repeated in the main body are stripped (leading/trailing; status{…} ids may differ from
    rally_effects). Orphan color-header lines left after stripping are removed when appropriate.
  • skillAttr — %{attrN} placeholders
  • skill_notes — from |Notes= (not mixed into skill_details)
  • rally_effects — merged subsection from optional <div>…Rally Effect…</div> in Base/Max
  • rally_effects — its own string in crk_descriptions (not part of skill_details). Placeholders
    %{attrN} are filled at display time from the same object as the jam skill: cjSkillAttr,
    skillAttrMc, or skillAttr (see char-ui: cjSkillAttr ?? skillAttr for rally).
    For cookies with cjSkill / mcSkill in data.js, the normal wiki box omits rally merge so
    skillAttr stays base-skill only; rally text is taken from the jam skill box when present.
  • enchants — MC-only: |10= / |20= / |30= as <slug>_10 / _20 / _30
  • ascension_effects — MC-only: |1A= … |5= as <slug>_1 … _5

Wiki templates expanded toward crk/crk_descriptions.js conventions:
  {{Element|Light|675.4%}}     → light{675.4%}
  {{Color|Title|#hex|sh=true}} → <span style="color:#…">Title</span> (inline wiki hex)
  {{Crk treasure|Feather}}     → treasure{<slug>} + full name from tools/wiki_treasure_keyword_display.json
                                 (keywords from https://cookierun.wiki/w/Template:Crk_treasure); slug from wiki_treasure_slug_map.json
  {{Kch|dc}} / {{Kch|olive|Custom}} → cookie{…} then optional label (icon before text, like status{…});
    balanced | args; icononly= ignored;
    tools/wiki_kch_module_crk.json + wiki_kch_to_cookie_key.json)
  {{Type|Charge}}            → type{charge}
  {{Tip|wiki text|…}}          → wiki text (balanced; status{…} / nested {{…}} in visible OK)
  {{Status|…}}                 → status{Id|…} + visible label (wiki param 2, or Status/data-style text
                                 for ATK Up / CRIT DMG Up / Weakness + element; icononly → icon only)
  [[Link|text]]                → text

Where Base and Max lines align, differing percentages / decimals become %{attr1}, %{attr2}, …
and skillAttr lists [base, max] (int if the wiki omitted a decimal point, else float — e.g. 94 vs 94.0;
the UI adds % for %{attrN}). Comma thousands in wiki numbers (e.g. 1,401.8%) are normalized for merging.
If Base and Max have different line counts, the first min(lines) pairs are still merged for attrs; extra
Base lines are expanded without placeholders (extra Max lines ignored). Previously the whole section fell
back to Base-only and dropped all attr merging, which misaligned CJ skill vs rally %{attrN} numbering.

skillAttr / cjSkillAttr / mcSkillAttr max values: for each attr key, max is max(wiki, data.js)
so a stale wiki max (e.g. before a level cap raise) never overwrites a higher max already in
data.js. Disable with --no-clamp-attr-max.

Usage:
  python import_wiki_skill_details.py --name Sugar_swan
  python import_wiki_skill_details.py --name Purple_yam --format json --out tools/imported_skill_details.json
  python import_wiki_skill_details.py --dry-run    # all characters with skill boxes (stderr progress)
  python import_wiki_skill_details.py --no-clamp-attr-max --name X   # trust wiki max over data.js
  python import_wiki_skill_details.py --no-apply   # import file only

By default, after writing --out, also patches data.js and crk/crk_descriptions.js when values differ
(same as apply_wiki_skill_details.py). Use --no-apply to only write the import artifact.

  python apply_wiki_skill_details.py [--dry-run] [--name Cookie_name]   # merge from file only
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
    classify_mc_cj_block,
    expand_wiki_color_templates,
    fetch_wikitext,
    find_all_skill_box_blocks,
    load_cookie_name_alternates,
    resolve_wiki_title,
)
from wiki_expand_kch import expand_wiki_kch_templates_for_skill
from wiki_expand_status import expand_wiki_status_templates, expand_wiki_tip_templates

ROOT = illu.ROOT
TREASURE_MAP_PATH = os.path.join(ROOT, "tools", "wiki_treasure_slug_map.json")
TREASURE_KEYWORD_DISPLAY_PATH = os.path.join(ROOT, "tools", "wiki_treasure_keyword_display.json")
_treasure_keyword_display_cache: dict[str, str] | None = None
KCH_MAP_PATH = os.path.join(ROOT, "tools", "wiki_kch_to_cookie_key.json")
KCH_MODULE_CRK_PATH = os.path.join(ROOT, "tools", "wiki_kch_module_crk.json")
DEFAULT_OUT = os.path.join(ROOT, "tools", "imported_skill_details.js")
DEFAULT_DATA_JS = os.path.join(ROOT, "data.js")
DEFAULT_DESC_JS = os.path.join(ROOT, "crk", "crk_descriptions.js")

_NUM_PAIR_RE = re.compile(r"((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?)(%?)")
_ELEM_TMPL_RE = re.compile(
    r"\{\{Element\|([^|}|]+)\|((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?%?)\}\}",
    re.I,
)
_ELEM_HOLD = "__IMPORT_ELEMENT_%s__"


def _load_treasure_map() -> dict[str, str]:
    if not os.path.isfile(TREASURE_MAP_PATH):
        return {}
    with open(TREASURE_MAP_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k).strip(): str(v).strip() for k, v in raw.items()}


def _load_treasure_keyword_display() -> dict[str, str]:
    """Wiki {{{1}}} keywords (Template:Crk treasure) → in-game style full treasure name for visible label."""
    global _treasure_keyword_display_cache
    if _treasure_keyword_display_cache is not None:
        return _treasure_keyword_display_cache
    if not os.path.isfile(TREASURE_KEYWORD_DISPLAY_PATH):
        _treasure_keyword_display_cache = {}
        return _treasure_keyword_display_cache
    with open(TREASURE_KEYWORD_DISPLAY_PATH, encoding="utf-8") as f:
        raw = json.load(f)
    _treasure_keyword_display_cache = {str(k).strip(): str(v).strip() for k, v in raw.items()}
    return _treasure_keyword_display_cache


def _load_kch_map() -> dict[str, str]:
    """
    Wiki Kch param (lowercase) → data.js `name`. Merges optional tools/wiki_kch_module_crk.json
    (paste from https://cookierun.wiki/wiki/Module:GetCookieName/data/crk.json when needed), then
    tools/wiki_kch_to_cookie_key.json overrides for hand-tuned slugs.
    """
    out: dict[str, str] = {}

    def merge_obj(raw: object) -> None:
        if not isinstance(raw, dict):
            return
        blob = raw.get("aliases") if isinstance(raw.get("aliases"), dict) else raw
        if not isinstance(blob, dict):
            return
        for k, v in blob.items():
            if v is None:
                continue
            key = str(k).strip().lower()
            out[key] = str(v).strip()

    if os.path.isfile(KCH_MODULE_CRK_PATH):
        with open(KCH_MODULE_CRK_PATH, encoding="utf-8") as f:
            merge_obj(json.load(f))
    if os.path.isfile(KCH_MAP_PATH):
        with open(KCH_MAP_PATH, encoding="utf-8") as f:
            merge_obj(json.load(f))
    return out


def _norm_num_token(tok: str) -> str:
    """Strip thousands separators for float parsing; keep % suffix."""
    if tok.endswith("%"):
        return tok[:-1].replace(",", "").strip() + "%"
    return tok.replace(",", "").strip()


def _parse_skill_attr_scalar(norm: str) -> int | float:
    """
    Parse a wiki numeric token (no commas; % already stripped) for skillAttr storage.
    If the wiki wrote a decimal point (e.g. 94.0%), keep float so data.js can match in-game style;
    plain integers (e.g. 94%) stay int.
    """
    s = norm.strip()
    if not s:
        raise ValueError("empty numeric token")
    if "." in s:
        return float(s)
    return int(s, 10)


def _strip_html_comments(s: str) -> str:
    return re.sub(r"<!--[\s\S]*?-->", "", s)


def _strip_skill_html(s: str) -> str:
    """Normalize wiki HTML wrappers in skill fields so line-based parsing works."""
    t = s.replace("\r\n", "\n").replace("\r", "\n")
    t = re.sub(r"<br\s*/?>", "\n", t, flags=re.I)
    t = re.sub(r"</div\s*>", "\n", t, flags=re.I)
    t = re.sub(r"<div[^>]*>", "\n", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    return t


def _first_line_is_rally_effect_heading(inner: str) -> bool:
    """
    True if the rally div starts with a real Rally Effect section header — plain wikitext, or
    color-header{…:Rally Effect} (wiki pattern). Avoids treating random paragraphs that mention
    “rally effect” as a split-out rally block.
    """
    t = _strip_skill_html(_strip_html_comments(inner))
    lines = section_to_lines(t)
    if not lines:
        return False
    s = lines[0].strip()
    low = s.lower()
    s_plain = re.sub(r"^'+", "", s)
    s_plain = re.sub(r"'+$", "", s_plain).strip().lower()
    if s_plain == "rally effect":
        return True
    if "color-header{" in s and "rally effect" in low:
        return True
    # Unexpanded wiki: first line is often {{Color|Rally Effect|#…|…}} (see Sea Fairy CJ box).
    if re.match(r"^\{\{\s*Color\s*\|\s*Rally Effect\s*\|", s, re.I):
        return True
    return False


def _extract_rally_div(raw: str) -> tuple[str, str]:
    """If a <div>…</div> opens with a Rally Effect heading, return (body_without_div, inner)."""
    if not raw or "<div" not in raw.lower():
        return raw, ""
    for m in re.finditer(r"<div[^>]*>([\s\S]*?)</div\s*>", raw, re.I):
        inner = m.group(1)
        if "rally effect" not in inner.lower():
            continue
        if not _first_line_is_rally_effect_heading(inner):
            continue
        body = (raw[: m.start()] + "\n" + raw[m.end() :]).strip()
        return body, inner.strip()
    return raw, ""


def _details_to_nonempty_lines(s: str) -> list[str]:
    t = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    return [ln.strip() for ln in t.split("\n") if ln.strip()]


def _lines_to_skill_details(lines: list[str]) -> str | None:
    return "<br>".join(lines) if lines else None


def _norm_rally_line_for_dedupe(line: str) -> str:
    """Compare lines ignoring status/color tag payloads (wiki repeats rally with different status ids)."""
    t = re.sub(r"<br\s*/?>", " ", line, flags=re.I)
    t = re.sub(r"status\{[^}]*\}", "status{}", t)
    t = re.sub(r"color-header\{[^}]*\}", "color-header{}", t)
    t = re.sub(
        r"(?:grass|water|fire|ice|electricity|wind|earth|light|dark|darkness|poison|steel|chaos)\{[^}]*\}",
        "elem{}",
        t,
        flags=re.I,
    )
    t = re.sub(r"\s+", " ", t).strip().lower()
    return t


def _lines_equiv_rally(a: str, b: str) -> bool:
    return _norm_rally_line_for_dedupe(a) == _norm_rally_line_for_dedupe(b)


def _strip_duplicate_rally_from_skill_details(text: str | None, rally: str | None) -> str | None:
    """Drop rally copy repeated in skill body (wiki often duplicates it outside the rally div)."""
    if not text or not rally:
        return text
    rally = rally.strip()
    if len(rally) < 12:
        return text
    tl = _details_to_nonempty_lines(text)
    rl = _details_to_nonempty_lines(rally)
    if not rl or not tl:
        return text

    def _equiv_block(chunk: list[str]) -> bool:
        return len(chunk) == len(rl) and all(
            _lines_equiv_rally(chunk[j], rl[j]) for j in range(len(rl))
        )

    # Embedded duplicate (CJ pages often paste the full rally block after the jam skill lines)
    if len(rl) >= 1 and len(tl) >= len(rl):
        max_passes = 5
        for _ in range(max_passes):
            removed = False
            for i in range(len(tl) - len(rl) + 1):
                chunk = tl[i : i + len(rl)]
                if chunk == rl or _equiv_block(chunk):
                    tl = tl[:i] + tl[i + len(rl) :]
                    removed = True
                    break
            if not removed:
                break

    # Leading duplicate (exact or status-agnostic)
    if len(tl) >= len(rl):
        if tl[: len(rl)] == rl:
            tl = tl[len(rl) :]
        elif all(_lines_equiv_rally(tl[i], rl[i]) for i in range(len(rl))):
            tl = tl[len(rl) :]

    # Trailing duplicate (e.g. Legendary Tree line repeated with different status{…} than rally_effects)
    if len(tl) >= len(rl):
        suf = tl[-len(rl) :]
        if suf == rl or all(_lines_equiv_rally(suf[i], rl[i]) for i in range(len(rl))):
            tl = tl[: -len(rl)]
            while tl and re.match(r"^\s*color-header\{", tl[-1]) and tl[-1] not in rally:
                tl.pop()

    # Single-line rally repeated as final paragraph without matching line breaks
    if len(rl) == 1 and len(tl) >= 1 and _lines_equiv_rally(tl[-1], rl[0]) and tl[-1] != rl[0]:
        tl = tl[:-1]
        while tl and re.match(r"^\s*color-header\{", tl[-1]) and tl[-1] not in rally:
            tl.pop()

    out = _lines_to_skill_details(tl)
    return out if (out and out.strip()) else None


def _strip_outer_skill_box(block: str) -> str:
    t = block.strip()
    if t.startswith("{{"):
        t = t[2:]
    if t.rstrip().endswith("}}"):
        t = t[:-2].strip()
    t = re.sub(r"^\s*Crk skill box\s*", "", t, flags=re.I).strip()
    return t


_FIELD_HEAD_RE = re.compile(r"\|\s*([A-Za-z0-9][A-Za-z0-9_ ]*?)\s*=\s*")


def parse_skill_box_fields(block: str) -> dict[str, str]:
    """Split inner {{Crk skill box …}} on |Key = boundaries (multiline values).
    |foo= inside nested templates (e.g. {{Color|…|#hex on the next line |size=15}}) is not a new field."""
    inner = _strip_outer_skill_box(block)
    if not inner.startswith("|"):
        inner = "|" + inner
    boundaries: list[tuple[int, str]] = []
    i = 0
    n = len(inner)
    depth = 0
    while i < n:
        if i + 2 <= n and inner[i : i + 2] == "{{":
            depth += 1
            i += 2
            continue
        if i + 2 <= n and inner[i : i + 2] == "}}" and depth > 0:
            depth -= 1
            i += 2
            continue
        if depth == 0 and inner[i] == "|":
            m = _FIELD_HEAD_RE.match(inner, i)
            if m:
                key = re.sub(r"\s+", " ", m.group(1).strip())
                boundaries.append((i, key))
        i += 1

    fields: dict[str, str] = {}
    for j, (pos, key) in enumerate(boundaries):
        m = _FIELD_HEAD_RE.match(inner, pos)
        if not m:
            continue
        v0 = m.end()
        v1 = boundaries[j + 1][0] if j + 1 < len(boundaries) else n
        fields[key] = inner[v0:v1].strip()
    return fields


def _expand_wikilinks(s: str) -> str:
    s = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", s)
    s = re.sub(r"\[\[([^\]]+)\]\]", r"\1", s)
    return s


def _expand_element(s: str) -> str:
    def repl(m: re.Match[str]) -> str:
        el, pct = m.group(1).strip(), m.group(2).strip()
        tag = el.lower().replace(" ", "")
        return f"{tag}{{{pct}}}"

    s = re.sub(r"\{\{Element\|([^|}|]+)\|([^}]+)\}\}", repl, s, flags=re.I)

    def repl_single(m: re.Match[str]) -> str:
        el = m.group(1).strip()
        tag = el.lower().replace(" ", "")
        return f"{tag}{{{el}}}"

    s = re.sub(r"\{\{Element\|([^}|]+)\}\}", repl_single, s, flags=re.I)
    return s


def _treasure_display_label(wiki_key: str, slug: str, tmap: dict[str, str], kw: dict[str, str]) -> str:
    """Full treasure name after treasure{{slug}}, using Template:Crk treasure keyword table when possible."""
    k = (wiki_key or "").strip()
    slug = (slug or "").strip()
    slug_l = slug.lower()

    def from_kw(key: str) -> str | None:
        if key in kw:
            return kw[key]
        k2 = key.replace("_", " ")
        if k2 in kw:
            return kw[k2]
        return None

    hit = from_kw(k)
    if hit:
        return hit

    for mk, ms in tmap.items():
        if ms.lower() != slug_l:
            continue
        hit = from_kw(mk)
        if hit:
            return hit

    if k in tmap and tmap[k].lower() == slug_l:
        hit = from_kw(k)
        return hit if hit else k

    key_as_slug = re.sub(r"[^a-z0-9_]+", "_", k.lower()).strip("_")
    if key_as_slug == slug_l:
        for mk, ms in tmap.items():
            if ms.lower() != slug_l:
                continue
            hit = from_kw(mk)
            if hit:
                return hit
        return " ".join(p.capitalize() for p in slug.split("_") if p)

    if k:
        return k
    return " ".join(p.capitalize() for p in slug.split("_") if p)


def _expand_crk_treasure(s: str, tmap: dict[str, str]) -> str:
    kw = _load_treasure_keyword_display()

    def repl(m: re.Match[str]) -> str:
        key = m.group(1).strip()
        slug = tmap.get(key) or tmap.get(key.replace("_", " "))
        if slug:
            inner = slug
        else:
            inner = re.sub(r"[^a-z0-9_]+", "_", key.lower()).strip("_")
        base = f"treasure{{{inner}}}"
        label = _treasure_display_label(key, inner, tmap, kw)
        return f"{base} {label}" if label else base

    return re.sub(r"\{\{Crk treasure\|([^}]+)\}\}", repl, s, flags=re.I)


def _expand_type(s: str) -> str:
    def repl(m: re.Match[str]) -> str:
        t = m.group(1).strip().lower().replace(" ", "_")
        return f"type{{{t}}}"

    return re.sub(r"\{\{Type\|([^}]+)\}\}", repl, s, flags=re.I)


def _strip_misc_templates(s: str) -> str:
    s = re.sub(r"\{\{PatchCRK\|[^}]+\}\}", "", s, flags=re.I)
    s = re.sub(r"\{\{Sic\}\}", "(sic)", s, flags=re.I)
    s = re.sub(r"\{\{[^}]+\}\}", "", s)
    return s


def _shield_elements(s: str) -> tuple[str, list[str]]:
    holds: list[str] = []

    def repl(m: re.Match[str]) -> str:
        holds.append(m.group(0))
        return _ELEM_HOLD % str(len(holds) - 1)

    return _ELEM_TMPL_RE.sub(repl, s), holds


def _unshield_elements(s: str, holds: list[str]) -> str:
    for i, h in enumerate(holds):
        s = s.replace(_ELEM_HOLD % str(i), h)
    return s


def _strip_bold(s: str) -> str:
    return re.sub(r"'''?", "", s)


def expand_wiki_skill_fragment(
    raw: str,
    cookie_slug: str,
    tmap: dict[str, str],
    kmap: dict[str, str],
    *,
    expand_element: bool = True,
) -> str:
    if not raw:
        return ""
    t = raw.replace("\r\n", "\n").replace("\r", "\n")
    for _ in range(10):
        prev = t
        t = _expand_wikilinks(t)
        t = expand_wiki_tip_templates(t)
        if expand_element:
            t = _expand_element(t)
        t = expand_wiki_kch_templates_for_skill(t, kmap)
        t = _expand_type(t)
        t = _expand_crk_treasure(t, tmap)
        # Status before Color so {{Color|{{Status|Id}}|#hex}} resolves; sole {{Color|…}} inside Status is expanded in wiki_expand_status.
        t = expand_wiki_status_templates(t)
        t = expand_wiki_color_templates(t, cookie_slug=cookie_slug)
        if t == prev:
            break
    t = re.sub(r"<br\s*/?>", "<br>", t, flags=re.I)
    if not expand_element:
        t, elem_holds = _shield_elements(t)
        t = _strip_misc_templates(t)
        t = _unshield_elements(t, elem_holds)
    else:
        t = _strip_misc_templates(t)
    t = _strip_bold(t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def section_to_lines(section: str) -> list[str]:
    out: list[str] = []
    for line in section.replace("\r\n", "\n").split("\n"):
        s = line.strip()
        if not s:
            continue
        if s.startswith(";"):
            s = s[1:].strip()
        if s.startswith("*"):
            s = s[1:].strip()
        if s:
            out.append(s)
    return out


def _split_numeric_tokens(s: str) -> list[str]:
    """Split into alternating text / number+% segments (regex-based)."""
    parts: list[str] = []
    pos = 0
    for m in _NUM_PAIR_RE.finditer(s):
        if m.start() > pos:
            parts.append(s[pos : m.start()])
        parts.append(m.group(0))
        pos = m.end()
    if pos < len(s):
        parts.append(s[pos:])
    return parts


def merge_line_pair_element(
    base_ln: str,
    max_ln: str,
    next_attr: list[int],
    skill_attr: dict[str, list[int | float]],
) -> str | None:
    if base_ln == max_ln:
        return base_ln
    stripped_b = _ELEM_TMPL_RE.sub("§E§", base_ln, count=1)
    stripped_m = _ELEM_TMPL_RE.sub("§E§", max_ln, count=1)
    if stripped_b != stripped_m:
        return None
    mb = list(_ELEM_TMPL_RE.finditer(base_ln))
    mm = list(_ELEM_TMPL_RE.finditer(max_ln))
    if len(mb) != 1 or len(mm) != 1:
        return None
    eb, em = mb[0], mm[0]
    if eb.group(1).strip().lower() != em.group(1).strip().lower():
        return None
    yb, ym = eb.group(2), em.group(2)
    if _norm_num_token(yb) == _norm_num_token(ym):
        return base_ln
    n = next_attr[0]
    next_attr[0] += 1
    key = f"attr{n}"
    skill_attr[key] = [
        _parse_skill_attr_scalar(_norm_num_token(yb).rstrip("%")),
        _parse_skill_attr_scalar(_norm_num_token(ym).rstrip("%")),
    ]
    tag = eb.group(1).strip().lower()
    return base_ln[: eb.start()] + f"{tag}{{%{{{key}}}}}" + base_ln[eb.end() :]


def merge_line_pair(
    base_ln: str,
    max_ln: str,
    next_attr: list[int],
    skill_attr: dict[str, list[int | float]],
) -> str:
    if base_ln == max_ln:
        return base_ln
    tb = _split_numeric_tokens(base_ln)
    tm = _split_numeric_tokens(max_ln)
    if len(tb) != len(tm):
        return base_ln
    out: list[str] = []
    for a, b in zip(tb, tm):
        if _NUM_PAIR_RE.fullmatch(a) and _NUM_PAIR_RE.fullmatch(b):
            if _norm_num_token(a) == _norm_num_token(b):
                out.append(a)
                continue
            n = next_attr[0]
            next_attr[0] += 1
            key = f"attr{n}"
            bv = _parse_skill_attr_scalar(_norm_num_token(a).rstrip("%"))
            mv = _parse_skill_attr_scalar(_norm_num_token(b).rstrip("%"))
            skill_attr[key] = [bv, mv]
            if a.endswith("%"):
                out.append(f"%{{{key}}}")
            else:
                out.append(f"%{{{key}|flat}}")
        else:
            if a != b:
                return base_ln
            out.append(a)
    return "".join(out)


def merge_base_max_sections(
    base_raw: str,
    max_raw: str,
    cookie_slug: str,
    tmap: dict[str, str],
    kmap: dict[str, str],
    warnings: list[str],
) -> tuple[str, dict[str, list[int | float]]]:
    """
    Merge Base vs Max into %{attrN} placeholders. If line counts differ, merge the first
    min(base,max) pairs so skill attrs stay aligned; extra Base lines are expanded without
    placeholders; extra Max lines are ignored (wiki layout glitch). Previously we used Base
    only for the whole section, which dropped all attr merging and made rally attrs reuse attr1+.
    """
    b_lines_raw = section_to_lines(base_raw)
    m_lines_raw = section_to_lines(max_raw)
    b_lines = [
        expand_wiki_skill_fragment(x, cookie_slug, tmap, kmap, expand_element=False) for x in b_lines_raw
    ]
    m_lines = [
        expand_wiki_skill_fragment(x, cookie_slug, tmap, kmap, expand_element=False) for x in m_lines_raw
    ]
    skill_attr: dict[str, list[int | float]] = {}
    next_attr = [1]
    merged: list[str] = []

    def _merge_one_line_pair(bl: str, ml: str) -> str:
        el_merged = merge_line_pair_element(bl, ml, next_attr, skill_attr)
        if el_merged is not None:
            return expand_wiki_skill_fragment(el_merged, cookie_slug, tmap, kmap, expand_element=True)
        bl2 = expand_wiki_skill_fragment(bl, cookie_slug, tmap, kmap, expand_element=True)
        ml2 = expand_wiki_skill_fragment(ml, cookie_slug, tmap, kmap, expand_element=True)
        return merge_line_pair(bl2, ml2, next_attr, skill_attr)

    if len(b_lines) != len(m_lines):
        n = min(len(b_lines), len(m_lines))
        warnings.append(
            f"Base/Max line count mismatch ({len(b_lines)} vs {len(m_lines)}); "
            f"merged first {n} line pairs, extra Base lines expanded without attr merge."
        )
        if len(m_lines) > len(b_lines):
            warnings.append(
                f"  (Ignored {len(m_lines) - len(b_lines)} extra Max line(s).)"
            )
        for i in range(n):
            merged.append(_merge_one_line_pair(b_lines[i], m_lines[i]))
        for i in range(n, len(b_lines)):
            merged.append(
                expand_wiki_skill_fragment(
                    b_lines_raw[i], cookie_slug, tmap, kmap, expand_element=True
                )
            )
    else:
        for i in range(len(b_lines)):
            merged.append(_merge_one_line_pair(b_lines[i], m_lines[i]))
    text = "<br>".join(merged)
    return text, skill_attr


def _build_skill_notes(
    notes: str,
    cookie_slug: str,
    tmap: dict[str, str],
    kmap: dict[str, str],
) -> str | None:
    notes = _strip_html_comments(notes or "").strip()
    if not notes:
        return None
    raw_lines = section_to_lines(_strip_skill_html(notes))
    pruned: list[str] = []
    i = 0
    while i < len(raw_lines):
        nxt = raw_lines[i + 1] if i + 1 < len(raw_lines) else ""
        if re.match(r"^\s*TBA\s*$", nxt, re.I):
            i += 2
            continue
        pruned.append(raw_lines[i])
        i += 1
    n_exp = [expand_wiki_skill_fragment(x, cookie_slug, tmap, kmap) for x in pruned]
    n_exp = [x for x in n_exp if x and not re.match(r"^TBA$", x, re.I)]
    if not n_exp:
        return None
    return "<br>".join(n_exp)


def _expand_lines_join(lines: list[str], cookie_slug: str, tmap: dict[str, str], kmap: dict[str, str]) -> str:
    exp = [expand_wiki_skill_fragment(x, cookie_slug, tmap, kmap) for x in lines]
    exp = [x for x in exp if x]
    return "<br>".join(exp) if exp else ""


def _jam_kind_from_data(has_mc: bool, has_cj: bool, wiki_kind: str | None) -> str | None:
    """CJ vs MC comes from data.js (extract_crk_characters hasMc/hasCj), not wiki headings or rarity."""
    if has_cj and not has_mc:
        return "cj"
    if has_mc and not has_cj:
        return "mc"
    if has_cj and has_mc:
        return wiki_kind if wiki_kind in ("cj", "mc") else "cj"
    return wiki_kind if wiki_kind in ("cj", "mc") else None


_ATTR_KEY_RE = re.compile(r"^attr(\d+)$")


def _next_attr_index(attrs: dict[str, list[int | float]]) -> int:
    hi = 0
    for k in attrs:
        m = _ATTR_KEY_RE.match(k)
        if m:
            hi = max(hi, int(m.group(1)))
    return hi + 1


def _renumber_attr_placeholders(
    s: str,
    rallied: dict[str, list[int | float]],
    start: int,
) -> tuple[str, dict[str, list[int | float]]]:
    """Rename %{attrN} in *s* and keys in *rallied* so new indices begin at *start*."""
    from_str = {int(m.group(1)) for m in re.finditer(r"%\{attr(\d+)\}", s)}
    from_keys: set[int] = set()
    for k in rallied:
        m = _ATTR_KEY_RE.match(k)
        if m:
            from_keys.add(int(m.group(1)))
    old_nums = sorted(from_str | from_keys)
    if not old_nums:
        return s, rallied
    mapping = {old: start + i for i, old in enumerate(old_nums)}
    out_attrs: dict[str, list[int | float]] = {}
    for old in old_nums:
        ok = f"attr{old}"
        nk = f"attr{mapping[old]}"
        if ok in rallied:
            out_attrs[nk] = rallied[ok]

    def repl(m: re.Match[str]) -> str:
        old = int(m.group(1))
        return f"%{{attr{mapping[old]}}}" if old in mapping else m.group(0)

    return re.sub(r"%\{attr(\d+)\}", repl, s), out_attrs


def build_for_skill_box(
    block: str,
    cookie_js_name: str,
    tmap: dict[str, str],
    kmap: dict[str, str],
    warnings: list[str],
    *,
    omit_rally_merge: bool = False,
) -> dict[str, Any]:
    fields = parse_skill_box_fields(block)
    base = fields.get("Base") or ""
    maxv = fields.get("Max") or ""
    cookie_slug = illu.cookie_name_to_wiki_slug(cookie_js_name)
    desc_key = cookie_slug

    base_body, rally_b_raw = _extract_rally_div(base)
    max_body, rally_m_raw = _extract_rally_div(maxv)
    base_body = _strip_skill_html(_strip_html_comments(base_body))
    max_body = _strip_skill_html(_strip_html_comments(max_body))

    rb_lines = section_to_lines(_strip_skill_html(_strip_html_comments(rally_b_raw)))
    rm_lines = section_to_lines(_strip_skill_html(_strip_html_comments(rally_m_raw)))
    if omit_rally_merge:
        # Jam cookies: rally lives in rally_effects + uses jam attrs at render time; base skillAttr is body only.
        rb_lines = []
        rm_lines = []
    n_rally = len(rb_lines)
    if n_rally and len(rm_lines) != n_rally:
        warnings.append(
            f"Rally line count mismatch in skill box ({n_rally} Base vs {len(rm_lines)} Max); attrs may misalign."
        )

    body_b_lines = section_to_lines(base_body)
    body_m_lines = section_to_lines(max_body)
    bb = "\n".join(body_b_lines)
    bm = "\n".join(body_m_lines)

    skill_notes = _build_skill_notes(fields.get("Notes") or "", cookie_slug, tmap, kmap)

    rally_effects: str | None = None
    text: str | None = None
    attrs: dict[str, list[int | float]] = {}

    if bb.strip() and bm.strip():
        text, attrs = merge_base_max_sections(bb, bm, cookie_slug, tmap, kmap, warnings)
        text = text.strip() or None
    elif bb.strip():
        text = _expand_lines_join(section_to_lines(bb), cookie_slug, tmap, kmap) or None
    elif bm.strip():
        text = _expand_lines_join(section_to_lines(bm), cookie_slug, tmap, kmap) or None

    if n_rally:
        rb = "\n".join(rb_lines)
        rm = "\n".join(rm_lines)
        rtxt: str | None = None
        rattrs: dict[str, list[int | float]] = {}
        if rb.strip() and rm.strip():
            rtxt, rattrs = merge_base_max_sections(rb, rm, cookie_slug, tmap, kmap, warnings)
            rtxt = rtxt.strip() or None
        elif rb.strip():
            rtxt = _expand_lines_join(section_to_lines(rb), cookie_slug, tmap, kmap) or None
        elif rm.strip():
            rtxt = _expand_lines_join(section_to_lines(rm), cookie_slug, tmap, kmap) or None

        if rtxt:
            if rattrs:
                if attrs:
                    start = _next_attr_index(attrs)
                    rtxt2, rattrs2 = _renumber_attr_placeholders(rtxt, rattrs, start)
                    attrs = {**attrs, **rattrs2}
                    rally_effects = rtxt2
                else:
                    attrs = {**attrs, **rattrs}
                    rally_effects = rtxt
            else:
                rally_effects = rtxt

    enchants: dict[str, str] = {}
    for tier in ("10", "20", "30"):
        sec = fields.get(tier)
        if not sec or not sec.strip() or re.match(r"^\s*TBA\s*$", sec, re.I):
            continue
        lines = section_to_lines(_strip_skill_html(_strip_html_comments(sec)))
        exp = [expand_wiki_skill_fragment(x, cookie_slug, tmap, kmap) for x in lines]
        exp = [x for x in exp if x]
        if exp:
            enchants[f"{desc_key}_{tier}"] = "<br>".join(exp)

    ascension_effects: dict[str, str] = {}
    for ak in ("1A", "2A", "3A", "4A", "5A"):
        sec = fields.get(ak)
        if not sec or not sec.strip() or re.match(r"^\s*TBA\s*$", sec, re.I):
            continue
        n = ak[:-1]
        lines = section_to_lines(_strip_skill_html(_strip_html_comments(sec)))
        exp = [expand_wiki_skill_fragment(x, cookie_slug, tmap, kmap) for x in lines]
        exp = [x for x in exp if x]
        if exp:
            ascension_effects[f"{desc_key}_{n}"] = "<br>".join(exp)

    if text and rally_effects:
        text = _strip_duplicate_rally_from_skill_details(text, rally_effects)

    return {
        "skill_details": text,
        "attrs": attrs,
        "skill_notes": skill_notes,
        "rally_effects": rally_effects,
        "enchants": enchants or None,
        "ascension_effects": ascension_effects or None,
    }


def descriptions_key(name: str) -> str:
    return illu.cookie_name_to_wiki_slug(name)


def _attr_keys_in_skill_text(text: str | None) -> set[str]:
    """attrN keys referenced as %{attrN} or %{attrN|flat} in skill/rally strings."""
    if not text or not isinstance(text, str):
        return set()
    return {f"attr{m.group(1)}" for m in re.finditer(r"%\{attr(\d+)", text)}


def _merge_skill_attr_max_with_data(
    wiki_attrs: dict[str, list[int | float]],
    data_attrs: Any,
    warnings: list[str],
    *,
    label: str,
    trust_wiki_max_keys: set[str] | None = None,
) -> dict[str, list[int | float]]:
    """
    Per attrN, use max(wiki_max, data_max) so data.js can retain higher caps than the wiki — except
    for *rally-only* attrs (placeholders only in rally_effects, not in the MC/CJ skill body). Those
    use wiki max so a bad duplicate in data.js cannot inflate rally lines (e.g. Sea Fairy attr5).
    """
    if not wiki_attrs:
        return wiki_attrs
    if not data_attrs or not isinstance(data_attrs, dict):
        return wiki_attrs
    trust = trust_wiki_max_keys or set()
    out: dict[str, list[int | float]] = {}
    for key, wpair in wiki_attrs.items():
        pair = list(wpair) if isinstance(wpair, (list, tuple)) else []
        if len(pair) < 2:
            out[key] = wiki_attrs[key]
            continue
        dpair = data_attrs.get(key)
        if not isinstance(dpair, (list, tuple)) or len(dpair) < 2:
            out[key] = [pair[0], pair[1]]
            continue
        try:
            base_w = float(pair[0])
            base_d = float(dpair[0])
            max_w = float(pair[1])
            max_d = float(dpair[1])
        except (TypeError, ValueError):
            out[key] = [pair[0], pair[1]]
            continue
        # After wiki/import renumbering, attrN may refer to a different stat than data.js for the same
        # key; max(data) would then corrupt the pair (e.g. Rising Tide max on Tidal Waves line).
        if abs(base_w - base_d) > 1e-3:
            out[key] = [pair[0], pair[1]]
            continue
        if key in trust:
            merged_max = max_w
            if max_d != max_w:
                warnings.append(
                    f"{label}.{key}: rally-only attr; wiki max {max_w} (ignored data.js max {max_d})"
                )
        else:
            merged_max = max(max_w, max_d)
            if max_d > max_w:
                warnings.append(
                    f"{label}.{key}: data.js max {max_d} > wiki max {max_w}; kept {merged_max}"
                )
        base_keep = pair[0]
        if merged_max == int(merged_max):
            max_keep: int | float = int(merged_max)
        else:
            max_keep = float(merged_max)
        out[key] = [base_keep, max_keep]
    return out


def import_one(
    api: str,
    name: str,
    display: str,
    name_alternates: dict[str, str],
    tmap: dict[str, str],
    kmap: dict[str, str],
    *,
    has_mc: bool = False,
    has_cj: bool = False,
    data_js_attrs: dict[str, Any] | None = None,
    clamp_attr_max: bool = True,
) -> dict[str, Any] | None:
    title = resolve_wiki_title(api, name, display, name_alternates)
    if not title:
        return None
    wt = fetch_wikitext(api, title)
    if not wt:
        return None
    boxes = find_all_skill_box_blocks(wt)
    if not boxes:
        return None
    out: dict[str, Any] = {
        "wikiTitle": title,
        "keys": {},
        "enchants": {},
        "ascension_effects": {},
        "warnings": [],
    }
    # Base skill
    w0: list[str] = []
    b0 = build_for_skill_box(
        boxes[0][1],
        name,
        tmap,
        kmap,
        warnings=w0,
        omit_rally_merge=has_cj,
    )
    if b0.get("skill_details") or b0.get("rally_effects"):
        dk = descriptions_key(name)
        entry: dict[str, Any] = {}
        if b0.get("skill_details"):
            entry["skill_details"] = b0["skill_details"]
        if b0.get("attrs"):
            attrs0 = b0["attrs"]
            if clamp_attr_max and data_js_attrs:
                attrs0 = _merge_skill_attr_max_with_data(
                    attrs0,
                    data_js_attrs.get("skillAttr"),
                    out["warnings"],
                    label="skillAttr",
                )
            entry["skillAttr"] = attrs0
        if b0.get("skill_notes"):
            entry["skill_notes"] = b0["skill_notes"]
        if b0.get("rally_effects"):
            entry["rally_effects"] = b0["rally_effects"]
        out["keys"][dk] = entry
        out["warnings"].extend(w0)
    # Additional boxes (MC / CJ)
    for pos, block in boxes[1:]:
        wiki_kind = classify_mc_cj_block(pos, block, wt)
        kind = _jam_kind_from_data(has_mc, has_cj, wiki_kind)
        if not kind:
            continue
        wn: list[str] = []
        b1 = build_for_skill_box(block, name, tmap, kmap, warnings=wn)
        if not b1.get("skill_details") and not b1.get("rally_effects"):
            continue
        dk2 = f"{descriptions_key(name)}_{kind}"
        attr_key = "cjSkillAttr" if kind == "cj" else "mcSkillAttr"
        entry2: dict[str, Any] = {}
        if b1.get("skill_details"):
            entry2["skill_details"] = b1["skill_details"]
        if b1.get("attrs"):
            attrs1 = b1["attrs"]
            if clamp_attr_max and data_js_attrs:
                if kind == "cj":
                    dattrs = data_js_attrs.get("cjSkillAttr")
                else:
                    dattrs = data_js_attrs.get("skillAttrMc") or data_js_attrs.get(
                        "mcSkillAttr"
                    )
                rally_txt_for_keys = b1.get("rally_effects") or ""
                skill_txt_for_keys = b1.get("skill_details") or ""
                rally_keys = _attr_keys_in_skill_text(rally_txt_for_keys)
                skill_keys = _attr_keys_in_skill_text(skill_txt_for_keys)
                trust_wiki = rally_keys - skill_keys
                attrs1 = _merge_skill_attr_max_with_data(
                    attrs1,
                    dattrs,
                    out["warnings"],
                    label=attr_key,
                    trust_wiki_max_keys=trust_wiki,
                )
            entry2[attr_key] = attrs1
        if b1.get("skill_notes"):
            entry2["skill_notes"] = b1["skill_notes"]
        rally_txt = b1.get("rally_effects")
        if rally_txt:
            dk0 = descriptions_key(name)
            if kind in ("mc", "cj") and dk0 in out["keys"]:
                if not out["keys"][dk0].get("rally_effects"):
                    out["keys"][dk0]["rally_effects"] = rally_txt
            else:
                entry2["rally_effects"] = rally_txt
        out["keys"][dk2] = entry2
        out["warnings"].extend(wn)
        if b1.get("enchants"):
            out["enchants"].update(b1["enchants"])
        if b1.get("ascension_effects"):
            out["ascension_effects"].update(b1["ascension_effects"])
    for entry in out["keys"].values():
        sd = entry.get("skill_details")
        ry = entry.get("rally_effects")
        if sd and ry:
            entry["skill_details"] = _strip_duplicate_rally_from_skill_details(sd, ry)
    dk_base = descriptions_key(name)
    base_ent = out["keys"].get(dk_base)
    rally_for_strip = (base_ent or {}).get("rally_effects")
    if rally_for_strip:
        for suf in ("_cj", "_mc"):
            dk_x = f"{dk_base}{suf}"
            ent_x = out["keys"].get(dk_x)
            if not ent_x:
                continue
            sd_x = ent_x.get("skill_details")
            if sd_x:
                ent_x["skill_details"] = (
                    _strip_duplicate_rally_from_skill_details(sd_x, rally_for_strip) or sd_x
                )
    if not out["keys"]:
        return None
    if not out["enchants"]:
        del out["enchants"]
    if not out["ascension_effects"]:
        del out["ascension_effects"]
    return out


def format_js_output(doc: dict[str, Any], global_name: str) -> str:
    body = json.dumps(doc, ensure_ascii=False, indent=2)
    return (
        f"// Generated by import_wiki_skill_details.py\n"
        f"window.{global_name} = {body};\n"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Import wiki Crk skill box Base/Max → skill_details + skillAttr")
    ap.add_argument("--name", help="data.js cookie name (e.g. Sugar_swan)")
    ap.add_argument("--dry-run", action="store_true", help="Process all characters; print counts to stderr")
    ap.add_argument("--out", default=DEFAULT_OUT, help="Output .js or .json path")
    ap.add_argument("--format", choices=("js", "json"), default="js")
    ap.add_argument("--global-name", default="WIKI_IMPORTED_SKILL_DETAILS", help="window.* name for --format js")
    ap.add_argument("--wiki-api", default=illu.API)
    ap.add_argument(
        "--no-clamp-attr-max",
        action="store_true",
        help="Use wiki Base/Max only for skillAttr max values (ignore data.js caps)",
    )
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
    miss = 0
    for r in rows:
        name = r["name"]
        display = r.get("displayName") or name
        data_blob = {
            k: r[k]
            for k in ("skillAttr", "cjSkillAttr", "skillAttrMc", "mcSkillAttr")
            if k in r and r[k] is not None
        }
        doc = import_one(
            args.wiki_api,
            name,
            display,
            name_alternates,
            tmap,
            kmap,
            has_mc=bool(r.get("hasMc")),
            has_cj=bool(r.get("hasCj")),
            data_js_attrs=data_blob or None,
            clamp_attr_max=not args.no_clamp_attr_max,
        )
        if not doc or not doc.get("keys"):
            miss += 1
            if args.dry_run:
                print(f"[skip] {name}", file=sys.stderr)
            continue
        merged["cookies"][name] = doc
        ok += 1
        if args.dry_run:
            print(f"[ok] {name} keys={list(doc['keys'].keys())}", file=sys.stderr)

    if args.dry_run:
        print(f"Done. ok={ok} skip={miss}", file=sys.stderr)

    if args.format == "json":
        out_txt = json.dumps(merged, ensure_ascii=False, indent=2)
    else:
        out_txt = format_js_output(merged, args.global_name)

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(out_txt)
    print(f"Wrote {args.out} ({args.format}) cookies={ok} skipped={miss}")

    if not args.dry_run and not args.no_apply:
        import apply_wiki_skill_details as _apply

        data_changed, desc_changed, log = _apply.apply_skill_import_doc(
            merged,
            dry_run=False,
            filter_name=args.name,
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


if __name__ == "__main__":
    main()
