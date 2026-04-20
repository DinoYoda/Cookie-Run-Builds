"""
Expand {{Status|…}} (Cookie Run Wiki) into site tags: status{id|…} plus trailing visible label.
Also provides {{Tip|visible|tooltip}} → visible (balanced, so visible may contain status{…} or nested templates).

Mirrors Template:Status / Template:Status/data for common cases (element + ATK Up / CRIT DMG Up /
Weakness, explicit second positional, icononly). Unknown statuses fall back to the wiki's first
parameter as the label. Balanced {{…}} matching supports nested templates (e.g. {{Color|…}}).

When |nodispel= is omitted, undispellable buff/debuff (and optional auto element) are filled from
tools/wiki_status_auto.json — same names as Template:Status undispel auto-list.
"""
from __future__ import annotations

import json
import os
import re

_ROOT = os.path.dirname(os.path.abspath(__file__))
_STATUS_AUTO_PATH = os.path.join(_ROOT, "tools", "wiki_status_auto.json")
_status_auto_json: dict[str, dict] | None = None

_STATUS_OPEN_RE = re.compile(r"\{\{\s*Status\s*\|", re.I)
_TIP_OPEN_RE = re.compile(r"\{\{\s*Tip\s*\|", re.I)
_COLOR_OPEN_START_RE = re.compile(r"^\{\{\s*Color\s*\|", re.I)
# MediaWiki named args use simple keys (icononly, element, …) — not HTML attributes (class=…).
_NAMED_STATUS_ARG_RE = re.compile(r"^[a-z_][a-z0-9_]*\s*=", re.I)


def _load_wiki_status_auto() -> dict[str, dict]:
    global _status_auto_json
    if _status_auto_json is not None:
        return _status_auto_json
    if not os.path.isfile(_STATUS_AUTO_PATH):
        _status_auto_json = {}
        return _status_auto_json
    with open(_STATUS_AUTO_PATH, encoding="utf-8") as f:
        _status_auto_json = json.load(f)
    return _status_auto_json


def _merge_status_auto_defaults(main_display: str, kvs: dict[str, str]) -> None:
    """Wiki Template:Status auto-undispellable / auto-element when |nodispel= / |element= not set."""
    row = _load_wiki_status_auto().get(main_display.strip())
    if not row:
        return
    if not (kvs.get("nodispel") or "").strip():
        ud = row.get("undispel")
        if ud is not None and str(ud).strip():
            kvs["nodispel"] = str(ud).strip().lower()
    if not (kvs.get("element") or "").strip():
        el = row.get("element")
        if el is not None and str(el).strip():
            kvs["element"] = str(el).strip()


def _wiki_status_id(name: str) -> str:
    return re.sub(r"\s+", "_", name.strip())


def _wiki_element_slug(raw: str) -> str:
    """Normalize wiki |element=… to char-ui element keys (fire, darkness, …)."""
    if not raw or not str(raw).strip():
        return ""
    s = str(raw).strip().lower().replace("-", " ")
    s = re.sub(r"\s+", "", s)
    if s == "dark":
        return "darkness"
    return s


def _status_brace_inner(sid: str, kvs: dict[str, str]) -> str:
    """Build status{…} payload: Id [|und_buff|el |und_debuff|el |und_buff |und_debuff |0|el]."""
    el = _wiki_element_slug(kvs.get("element", ""))
    nod = (kvs.get("nodispel") or "").strip().lower()
    und: str | None
    if nod == "buff":
        und = "und_buff"
    elif nod in ("debuff", "debuffs"):
        und = "und_debuff"
    else:
        und = None
    segs: list[str] = [sid]
    if und and el:
        segs.extend([und, el])
    elif und:
        segs.append(und)
    elif el:
        segs.extend(["0", el])
    return "|".join(segs)


def split_balanced_piped_args(inner: str) -> list[str]:
    """Split template inner on top-level | respecting nested {{…}} and single {…}."""
    parts: list[str] = []
    buf: list[str] = []
    depth_wiki = 0
    depth_brace = 0
    i = 0
    n = len(inner)
    while i < n:
        if inner.startswith("{{", i):
            depth_wiki += 1
            buf.append("{{")
            i += 2
            continue
        if inner.startswith("}}", i) and depth_wiki > 0:
            depth_wiki -= 1
            buf.append("}}")
            i += 2
            continue
        ch = inner[i]
        if ch == "|" and depth_wiki == 0 and depth_brace == 0:
            parts.append("".join(buf).strip())
            buf = []
            i += 1
            continue
        if ch == "{":
            depth_brace += 1
        elif ch == "}":
            depth_brace = max(0, depth_brace - 1)
        buf.append(ch)
        i += 1
    if buf:
        parts.append("".join(buf).strip())
    return [p for p in parts if p]


def _extract_balanced_mediawiki_template(s: str, start: int) -> tuple[int, int] | None:
    """If s[start:].startswith('{{'), return (start, end) with s[start:end] the full template."""
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


def _wiki_ucfirst_element(el: str) -> str:
    """Match wiki {{ucfirst:{{{element}}}}} for display (all → All, fire → Fire)."""
    t = el.strip()
    if not t:
        return t
    return t[0].upper() + t[1:].lower()


def _wiki_status_visible_label(main: str, kvs: dict[str, str]) -> str:
    """
    Plain label when wiki has no second positional arg: Template:Status tooltip + Status/data
    for element-tinted names. Otherwise the first parameter is the visible name.
    """
    main = main.strip()
    el_raw = (kvs.get("element") or "").strip()
    if not el_raw:
        return main
    u = _wiki_ucfirst_element(el_raw)
    if main == "ATK Up":
        return f"{u}-type ATK Up"
    if main == "CRIT DMG Up":
        return f"{u}-type CRIT DMG Up"
    if main == "Weakness":
        suffix = "s" if u == "All" else ""
        return f"{u}-type{suffix} DMG Up"
    return main


def _status_template_to_site(inner: str) -> str:
    parts = split_balanced_piped_args(inner)
    if not parts:
        return ""
    main0 = parts[0].strip()
    if _COLOR_OPEN_START_RE.match(main0):
        span = _extract_balanced_mediawiki_template(main0, 0)
        if span and span[1] == len(main0):
            import import_wiki_cookie_data as icd

            return icd.expand_wiki_color_templates(main0, cookie_slug=None)
    main = parts[0]
    rest = parts[1:]
    kvs: dict[str, str] = {}
    plain_rest: list[str] = []
    for p in rest:
        if _NAMED_STATUS_ARG_RE.match(p):
            a, _, b = p.partition("=")
            kvs[a.strip().lower()] = b.strip()
        else:
            plain_rest.append(p)
    _merge_status_auto_defaults(main, kvs)
    sid = _wiki_status_id(main)
    brace_inner = _status_brace_inner(sid, kvs)
    base = f"status{{{brace_inner}}}"

    if kvs.get("icononly", "").lower() == "true":
        return base

    if plain_rest:
        tail = " ".join(plain_rest)
        return f"{base} {tail}" if tail else base

    label = _wiki_status_visible_label(main, kvs)
    return f"{base} {label}" if label else base


def expand_wiki_tip_templates(s: str) -> str:
    """{{Tip|visible|tooltip}} → visible (tooltip dropped). Supports | and {{…}} inside *visible*."""
    out: list[str] = []
    i = 0
    while True:
        m = _TIP_OPEN_RE.search(s, i)
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
        parts = split_balanced_piped_args(inner)
        visible = parts[0].strip() if parts else ""
        out.append(visible)
        i = end
    return "".join(out)


def expand_wiki_status_templates(s: str) -> str:
    """Expand every {{Status|…}} using balanced {{…}} matching."""
    out: list[str] = []
    i = 0
    while True:
        m = _STATUS_OPEN_RE.search(s, i)
        if not m:
            out.append(s[i:])
            break
        abs_start = m.start()
        out.append(s[i:abs_start])
        span = _extract_balanced_mediawiki_template(s, abs_start)
        if not span:
            out.append(s[abs_start : abs_start + 2])
            i = abs_start + 2
            continue
        _, end = span
        block = s[abs_start:end]
        inner = block[m.end() - abs_start : -2]
        out.append(_status_template_to_site(inner))
        i = end
    return "".join(out)
