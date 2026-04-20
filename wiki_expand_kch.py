"""
Expand {{Kch|…}}, {{CookieHead|…}}, and {{ch|game=crk|…}} (Cookie Run Wiki) with balanced {{…}} and piped args.

Template: {{Kch|cookie_slug|Custom Name|icononly=true}}
 • Positional 1: wiki cookie id (e.g. olive, dark cacao)
  • Positional 2+: optional display text (joined with spaces)
  • Named args (icononly=, game=, …): ignored for site output; icononly does not hide text here.

{{ch|game=crk|sf}} — same output as Kch after stripping game=crk (wiki shorthand). Other game= values are left unexpanded.

Skill pipeline: icon before visible text (same order as status{…} + label): cookie{Name} then wording.
  e.g. {{Kch|manju}} → cookie{Manju} Manju Cookie; {{Kch|jagae|'s}} → cookie{Jagae} Jagae Cookie's; {{Kch|x|Custom}} → cookie{…} Custom.
Description pipeline: plain visible text only (see expand_wiki_head_icon_templates_plain).
"""
from __future__ import annotations

import re

from wiki_expand_status import _extract_balanced_mediawiki_template, split_balanced_piped_args

_KCH_HEAD_CH_OPEN_RE = re.compile(
    r"\{\{\s*(?P<tn>Kch|CookieHead|ch)\s*\|",
    re.I,
)
_GAME_CRK_RE = re.compile(r"^\s*game\s*=\s*crk\s*$", re.I)
_NAMED_KCH_ARG_RE = re.compile(r"^[a-z_][a-z0-9_]*\s*=", re.I)


def _prettify_wiki_slug(slug: str) -> str:
    slug = slug.strip()
    if not slug:
        return ""
    words = re.split(r"[\s_]+", slug.replace("_", " "))
    out: list[str] = []
    for w in words:
        if not w:
            continue
        if w.isupper() and len(w) > 1:
            out.append(w)
        else:
            out.append(w[:1].upper() + w[1:].lower())
    return " ".join(out)


def _possessive_cookie_label(slug: str) -> str:
    """{{Kch|slug|'s}} visible wording: matches in-game \"Name Cookie's\" (wiki second arg is just 's)."""
    base = _prettify_wiki_slug(slug)
    return f"{base} Cookie's" if base else "Cookie's"


def parse_kch_template_inner(inner: str) -> tuple[str, str | None]:
    """
    Split Kch/CookieHead inner on | (balanced). Drop named args. Return (slug, custom_display or None).
    """
    parts = split_balanced_piped_args(inner)
    positional: list[str] = []
    for p in parts:
        t = p.strip()
        if not t:
            continue
        if _NAMED_KCH_ARG_RE.match(t):
            continue
        positional.append(t)
    if not positional:
        return "", None
    slug = positional[0]
    if len(positional) == 1:
        return slug, None
    custom = " ".join(positional[1:]).strip()
    return slug, custom if custom else None


def parse_ch_template_inner(inner: str) -> tuple[str, str | None] | None:
    """
    Split {{ch|…}} inner when template includes game=crk (any arg position). Drop game=crk and other
    named args; remaining pipes match Kch. Returns None if not a CRK ch template (leave wikitext as-is).
    """
    parts = split_balanced_piped_args(inner)
    has_crk = False
    positional: list[str] = []
    for p in parts:
        t = p.strip()
        if not t:
            continue
        if _GAME_CRK_RE.match(t):
            has_crk = True
            continue
        if _NAMED_KCH_ARG_RE.match(t):
            continue
        positional.append(t)
    if not has_crk:
        return None
    if not positional:
        return "", None
    slug = positional[0]
    if len(positional) == 1:
        return slug, None
    custom = " ".join(positional[1:]).strip()
    return slug, custom if custom else None


def _data_js_cookie_key_to_display_name(ck: str) -> str:
    """e.g. Dark_choco → 'Dark Choco Cookie' (matches status{…} + label pattern)."""
    ck = (ck or "").strip()
    if not ck:
        return "Cookie"
    parts = [p for p in ck.split("_") if p]
    words = [p[:1].upper() + p[1:].lower() for p in parts if p]
    return f"{' '.join(words)} Cookie" if words else "Cookie"


def kch_slug_to_data_js_name(slug: str, kmap: dict[str, str]) -> str:
    """Map wiki kch param to data.js character name (underscores, Title_Segments)."""
    raw = slug.strip()
    if not raw:
        return ""
    low = raw.lower()
    low_us = re.sub(r"\s+", "_", low)
    ck = (
        kmap.get(low)
        or kmap.get(low.replace("_", " "))
        or kmap.get(low_us)
        or kmap.get(raw.strip())
    )
    if ck:
        return ck
    parts = [p for p in re.split(r"[\s_]+", low) if p]
    if not parts:
        return raw
    return "_".join(p[:1].upper() + p[1:] for p in parts)


def format_kch_for_skill_site(slug: str, custom: str | None, kmap: dict[str, str]) -> str:
    """cookie{Name} first, then label (matches status icon + text; wiki {{Kch|slug}} shows both)."""
    ck = kch_slug_to_data_js_name(slug, kmap)
    if not ck:
        return ""
    if custom and re.fullmatch(r"[\u2019']s", custom.strip()):
        return f"cookie{{{ck}}} {_possessive_cookie_label(slug)}"
    if custom:
        return f"cookie{{{ck}}} {custom}"
    return f"cookie{{{ck}}} {_data_js_cookie_key_to_display_name(ck)}"


def format_kch_plain_text(slug: str, custom: str | None) -> str:
    """Flavor text: visible words only (no cookie tag)."""
    if not slug.strip():
        return ""
    if custom and re.fullmatch(r"[\u2019']s", custom.strip()):
        return _possessive_cookie_label(slug)
    if custom:
        return custom
    return _prettify_wiki_slug(slug)


def expand_wiki_kch_templates_for_skill(s: str, kmap: dict[str, str]) -> str:
    """Replace {{Kch|…}}, {{CookieHead|…}}, {{ch|game=crk|…}} with cookie{…} tags (+ optional custom prefix)."""
    out: list[str] = []
    i = 0
    while True:
        m = _KCH_HEAD_CH_OPEN_RE.search(s, i)
        if not m:
            out.append(s[i:])
            break
        out.append(s[i : m.start()])
        span = _extract_balanced_mediawiki_template(s, m.start())
        if not span:
            out.append(s[m.start() : m.start() + 2])
            i = m.start() + 2
            continue
        _start, end = span
        inner = s[m.end() : end - 2]
        tn = (m.group("tn") or "").lower()
        if tn == "ch":
            parsed = parse_ch_template_inner(inner)
            if parsed is None:
                out.append(s[m.start() : end])
                i = end
                continue
            slug, custom = parsed
            if not (slug or "").strip():
                out.append(s[m.start() : end])
                i = end
                continue
        else:
            slug, custom = parse_kch_template_inner(inner)
        out.append(format_kch_for_skill_site(slug, custom, kmap) if slug else "")
        i = end
    return "".join(out)


def expand_wiki_head_icon_templates_plain(s: str) -> str:
    """Replace {{Kch|…}} / {{CookieHead|…}} / {{ch|game=crk|…}} with plain visible text (game descriptions)."""
    out: list[str] = []
    i = 0
    while True:
        m = _KCH_HEAD_CH_OPEN_RE.search(s, i)
        if not m:
            out.append(s[i:])
            break
        out.append(s[i : m.start()])
        span = _extract_balanced_mediawiki_template(s, m.start())
        if not span:
            out.append(s[m.start() : m.start() + 2])
            i = m.start() + 2
            continue
        _start, end = span
        inner = s[m.end() : end - 2]
        tn = (m.group("tn") or "").lower()
        if tn == "ch":
            parsed = parse_ch_template_inner(inner)
            if parsed is None:
                out.append(s[m.start() : end])
                i = end
                continue
            slug, custom = parsed
            if not (slug or "").strip():
                out.append(s[m.start() : end])
                i = end
                continue
        else:
            slug, custom = parse_kch_template_inner(inner)
        out.append(format_kch_plain_text(slug, custom) if slug else "")
        i = end
    return "".join(out)
