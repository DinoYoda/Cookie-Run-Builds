/**
 * Renders tagged skill text (ice{}, status{}, %{attr}, etc.) to HTML.
 * @param {string} tagged - Tagged text
 * @param {object} skillAttr - e.g. { attr1: [67.8, 144.2], attr2: [271.2, 576.9] }
 * @param {number} levelIndex - 0 = base, 1 = max
 */
function buildEnchantsHtml(enchantsObj, skillAttr, slugPrefix) {
  if (!enchantsObj || typeof enchantsObj !== "object") return ""
  const prefix = slugPrefix + "_"
  const entries = []
  for (const [key, text] of Object.entries(enchantsObj)) {
    if (!key.startsWith(prefix) || !text || typeof text !== "string") continue
    const suffix = key.slice(prefix.length)
    const parts = suffix.split("_")
    const level = parseInt(parts[0], 10)
    if (isNaN(level)) continue
    const index = parts[1] ? parseInt(parts[1], 10) : 0
    entries.push({ level, index: isNaN(index) ? 0 : index, text })
  }
  if (entries.length === 0) return ""
  entries.sort((a, b) => a.level - b.level || a.index - b.index)
  const byLevel = {}
  for (const e of entries) {
    if (!byLevel[e.level]) byLevel[e.level] = []
    const lines = e.text.split(/<br>/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed) byLevel[e.level].push(renderSkillTaggedText(trimmed, skillAttr, 1))
    }
  }
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b)
  let html = `<div class="char-skill-enchants"><div class="char-skill-enchants-divider"></div>`
  for (const level of levels) {
    html += `<h5 class="char-skill-enchants-header">At +${level}</h5>`
    for (const rendered of byLevel[level]) {
      html += `<div class="char-skill-enchants-line">${rendered}</div>`
    }
  }
  html += `</div>`
  return html
}

function wrapEnchantsToggleable(html, skillKey, visible) {
  if (!html) return ""
  const hideClass = visible ? "" : " char-skill-enchants-hidden"
  return `<div class="char-skill-enchants-wrap${hideClass}" data-enchants-for="${skillKey}">${html}</div>`
}

function buildAscensionHtml(ascensionObj, skillAttr, slugPrefix) {
  if (!ascensionObj || typeof ascensionObj !== "object") return ""
  const prefix = slugPrefix + "_"
  const entries = []
  for (const [key, text] of Object.entries(ascensionObj)) {
    if (!key.startsWith(prefix) || !text || typeof text !== "string") continue
    const suffix = key.slice(prefix.length)
    const parts = suffix.split("_")
    const level = parseInt(parts[0], 10)
    if (isNaN(level) || level < 1 || level > 5) continue
    const index = parts[1] ? parseInt(parts[1], 10) : 0
    entries.push({ level, index: isNaN(index) ? 0 : index, text })
  }
  if (entries.length === 0) return ""
  entries.sort((a, b) => a.level - b.level || a.index - b.index)
  const byLevel = {}
  for (const e of entries) {
    if (!byLevel[e.level]) byLevel[e.level] = []
    byLevel[e.level].push(renderSkillTaggedText(e.text, skillAttr, 1))
  }
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b)
  let html = `<div class="char-skill-ascension"><div class="char-skill-ascension-divider"></div>`
  for (const level of levels) {
    html += `<h5 class="char-skill-ascension-header">★${level}A Effect</h5>`
    for (const rendered of byLevel[level]) {
      html += `<div class="char-skill-ascension-line">${rendered}</div>`
    }
  }
  html += `</div>`
  return html
}

function wrapAscensionToggleable(html, skillKey, visible) {
  if (!html) return ""
  const hideClass = visible ? "" : " char-skill-ascension-hidden"
  return `<div class="char-skill-ascension-wrap${hideClass}" data-ascension-for="${skillKey}">${html}</div>`
}

function wrapGameplayNotesBubble(notesContent, skillKey, visible) {
  if (!notesContent) return ""
  const hideClass = visible ? "" : " char-gameplay-notes-hidden"
  return `<div class="char-gameplay-notes-wrap${hideClass}" data-gameplay-notes-for="${skillKey}"><div class="char-skill-bubble char-gameplay-notes-bubble"><div class="char-skill-content">${notesContent}</div></div></div>`
}

function buildGameplayNotesHtml(notesObj, skillAttr, notesPrefix) {
  if (!notesObj || typeof notesObj !== "object") return ""
  const text = notesObj[notesPrefix]
  if (!text || typeof text !== "string") return ""
  return renderSkillTaggedText(text, skillAttr, 1)
}

const _esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
/** Encode a file name (single path segment) for img/src URLs — % ' ! etc. break on GitHub Pages without this. */
const _urlFile = (name) => encodeURIComponent(String(name))

/** Wiki / data.js ids are snake_case; icon files on disk use Status_<Pascal_Segments>.png for stable Git casing. */
function _statusIconBaseFromMainId(mainId) {
  const raw = String(mainId || "").trim()
  if (!raw) return ""
  return raw
    .split("_")
    .map((seg) => {
      const s = String(seg || "")
      if (!s) return ""
      if (/^[A-Z]{2,}$/.test(s)) return s
      if (/^[0-9]/.test(s) || /%/.test(s)) return s.charAt(0).toUpperCase() + s.slice(1)
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    })
    .filter(Boolean)
    .join("_")
}

function _statusIconImgTag(pic, mainId, altText) {
  const base = _statusIconBaseFromMainId(mainId)
  if (!base) return ""
  const primary = `${pic}/icons/status/${_urlFile(`Status_${base}.png`)}`
  const legacy = `${pic}/icons/status/${_urlFile(`status_${base}.png`)}`
  return `<img src="${primary}" data-status-alt-src="${_esc(legacy)}" alt="${_esc(altText)}" class="skill-status-icon" onerror="${_imgErrStatusIconAttr()}">`
}

/** Display label for status{mainId|…} hover (internal ids use SNAKE_CASE). */
function _statusIdToHoverLabel(mainId) {
  const raw = String(mainId || "").trim()
  if (!raw) return ""
  return raw.split("_").map((seg) => {
    if (!seg) return ""
    if (/^[A-Z0-9]+$/.test(seg)) {
      if (seg.length <= 4) return seg
      return seg.charAt(0) + seg.slice(1).toLowerCase()
    }
    return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
  }).filter(Boolean).join(" ")
}

const _CURSOR_TIP_SELECTOR = [
  ".skill-status-hover-wrap[data-status-tip]",
  ".char-skill-cd-pill[data-status-tip]",
  ".char-inline-hover[data-hover]",
  ".char-build-rank-icon-wrap[data-tooltip]",
  ".teams-treasure-item[data-cursor-tip]",
].join(", ")

function _cursorTipLabelFromEl(el) {
  if (!el || !el.dataset) return ""
  const d = el.dataset
  if (d.statusTip) return d.statusTip
  if (d.hover) return d.hover
  if (d.tooltip) return d.tooltip
  if (d.cursorTip) return d.cursorTip
  return ""
}

/** Keep the floating tip on-screen while anchoring near the pointer. */
function _positionCursorTipEl(tipEl, clientX, clientY, offsetX, offsetY) {
  const pad = 10
  tipEl.style.left = `${clientX + offsetX}px`
  tipEl.style.top = `${clientY + offsetY}px`
  const r = tipEl.getBoundingClientRect()
  let x = clientX + offsetX
  let y = clientY + offsetY
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (r.right > vw - pad) x = vw - r.width - pad
  if (r.bottom > vh - pad) y = vh - r.height - pad
  if (x < pad) x = pad
  if (y < pad) y = pad
  tipEl.style.left = `${Math.round(x)}px`
  tipEl.style.top = `${Math.round(y)}px`
}

let _skillStatusCursorTipBound = false
function _ensureSkillStatusCursorTip() {
  if (_skillStatusCursorTipBound || typeof document === "undefined") return
  _skillStatusCursorTipBound = true
  let tipEl = document.getElementById("skill-status-cursor-tip")
  if (!tipEl) {
    tipEl = document.createElement("div")
    tipEl.id = "skill-status-cursor-tip"
    tipEl.className = "skill-status-cursor-tip"
    tipEl.setAttribute("aria-hidden", "true")
    document.body.appendChild(tipEl)
  }
  let activeWrap = null
  const hide = () => {
    activeWrap = null
    tipEl.classList.remove("is-visible", "skill-status-cursor-tip--wrap")
    tipEl.textContent = ""
  }
  const offsetX = 14
  const offsetY = 18
  document.addEventListener(
    "mousemove",
    (e) => {
      const wrap =
        e.target && e.target.closest ? e.target.closest(_CURSOR_TIP_SELECTOR) : null
      const label = _cursorTipLabelFromEl(wrap)
      if (!label) {
        if (activeWrap) hide()
        return
      }
      activeWrap = wrap
      tipEl.textContent = label
      tipEl.classList.add("is-visible")
      if (
        wrap.classList.contains("char-inline-hover") ||
        wrap.classList.contains("teams-treasure-item")
      ) {
        tipEl.classList.add("skill-status-cursor-tip--wrap")
      } else {
        tipEl.classList.remove("skill-status-cursor-tip--wrap")
      }
      _positionCursorTipEl(tipEl, e.clientX, e.clientY, offsetX, offsetY)
    },
    true
  )
  document.addEventListener("scroll", () => { if (activeWrap) hide() }, true)
}
/** Clear onerror before changing src so missing fallbacks cannot loop forever */
const _imgErrHide = "this.onerror=null;this.style.display='none'"
/** Main skill icon: one fallback to unknown, then stop (avoids loop if unknown.png is missing) */
function _imgErrSkillIconAttr() {
  const u = getGamePictureRoot() + "/skills/unknown.png"
  return "this.onerror=null;if(this.src.indexOf('unknown.png')===-1){this.src='" + u.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'}else{this.style.display='none'}"
}
function _imgErrToppingAttr() {
  const u = getGamePictureRoot() + "/toppings/unknown.png"
  return "if(!this.dataset.fallbackDone&&this.dataset.fallbackSrc){this.dataset.fallbackDone='1';this.src=this.dataset.fallbackSrc}else{this.onerror=null;this.src='" + u.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'}"
}
function _imgErrStatusIconAttr() {
  return "if(!this.dataset.fbStatus&&this.dataset.statusAltSrc){this.dataset.fbStatus='1';this.src=this.dataset.statusAltSrc}else{this.onerror=null;this.style.display='none'}"
}
const _TAG_BASE_NAMES = ["ice", "fire", "status", "light", "dark", "color", "steel", "darkness", "poison", "water", "wind", "grass", "electricity", "chaos", "earth", "rally", "header", "cookie", "treasure", "skill", "type", "position", "hover"]
const _STANDARD_TAG_PREFIXES = (() => {
  const out = []
  for (const tag of _TAG_BASE_NAMES) {
    out.push({ prefix: `${tag}-header{`, tag, noIcon: true })
    out.push({ prefix: `${tag}{`, tag, noIcon: false })
  }
  return out.sort((a, b) => b.prefix.length - a.prefix.length)
})()
const _EL_ICONS = { ice: "Ice", fire: "Fire", light: "Light", dark: "Darkness", steel: "Steel", poison: "Poison", water: "Water", wind: "Wind", grass: "Grass", electricity: "Electricity", chaos: "Chaos", earth: "Earth", darkness: "Darkness" }
const _COLOR_HEADER_PREFIX = "color-header{"

function _extractBalancedBraceContent(text, openBraceIndex) {
  if (openBraceIndex < 0 || openBraceIndex >= text.length || text[openBraceIndex] !== "{") return null
  let depth = 0
  for (let j = openBraceIndex; j < text.length; j++) {
    const c = text[j]
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return { inner: text.slice(openBraceIndex + 1, j), end: j + 1 }
    }
  }
  return null
}

function _findNextStandardTag(text, fromIndex) {
  let best = null
  for (const p of _STANDARD_TAG_PREFIXES) {
    const idx = text.indexOf(p.prefix, fromIndex)
    if (idx >= 0 && (!best || idx < best.index)) {
      best = { index: idx, tag: p.tag, noIcon: p.noIcon, openBrace: idx + p.prefix.length - 1 }
    }
  }
  return best
}

/** Lowercase key → { name: data.js name, displayName } for cookie{…} links (char= is case-sensitive). */
let _cookieLinkLookup = null

function _buildCookieLinkLookup() {
  const m = new Map()
  try {
    const data = typeof window !== "undefined" ? window.CRK_DATA : null
    if (!data?.games) return m
    const gid = getSelectedGameId()
    const game = data.games.find((g) => g.id === gid) || data.games[0]
    const chars = Array.isArray(game?.characters) ? game.characters : []
    for (const c of chars) {
      if (!c?.name) continue
      const name = String(c.name)
      const displayName = c.displayName != null ? String(c.displayName).trim() : ""
      const rec = { name, displayName: displayName || name }
      m.set(name.toLowerCase(), rec)
      if (displayName) {
        const dk = displayName.toLowerCase()
        if (!m.has(dk)) m.set(dk, rec)
        const noCookie = displayName.replace(/\s+Cookie\s*$/i, "").trim()
        if (noCookie) {
          const nk = noCookie.toLowerCase()
          if (!m.has(nk)) m.set(nk, rec)
        }
      }
    }
  } catch {
    /* ignore */
  }
  return m
}

function _resolveCookieForLink(raw) {
  const key = String(raw ?? "").trim()
  if (!key) return { name: "", displayName: "" }
  if (!_cookieLinkLookup) _cookieLinkLookup = _buildCookieLinkLookup()
  const hit = _cookieLinkLookup.get(key.toLowerCase())
  if (hit) return { name: hit.name, displayName: hit.displayName }
  return { name: key, displayName: key }
}

function _renderSingleTag(tag, noIcon, content, pic) {
  if (tag === "header") return `<span class="text-tag text-bold">${_esc(content)}</span>`
  if (tag === "cookie") {
    const { name: cookieName, displayName: cookieLabel } = _resolveCookieForLink(content)
    if (!cookieName) return ""
    const href = `character.html?char=${encodeURIComponent(cookieName)}`
    return `<a class="skill-cookie-link" href="${href}"><img src="${pic}/icons/cookie/${_urlFile(`${cookieName}_head.png`)}" alt="${_esc(cookieLabel)}" class="skill-status-icon" onerror="${_imgErrHide}"></a>`
  }
  if (tag === "treasure") {
    const { main, iconOnly } = parseTreasureBracketInner(content)
    const tmap = typeof CRK_TREASURE_SLUG_MAP === "object" && CRK_TREASURE_SLUG_MAP ? CRK_TREASURE_SLUG_MAP : {}
    const kw = typeof CRK_TREASURE_KEYWORD_DISPLAY === "object" && CRK_TREASURE_KEYWORD_DISPLAY ? CRK_TREASURE_KEYWORD_DISPLAY : {}
    const { slug, display } = resolveTreasureWiki(main, tmap, kw)
    const alt = display || main
    const img = `<img src="${pic}/treasures/${_urlFile(`Treasure_${slug}.png`)}" alt="${_esc(alt)}" class="skill-status-icon" onerror="${_imgErrHide}">`
    if (!iconOnly && display) {
      return `<span class="skill-treasure-inline">${img}<span class="skill-treasure-inline-label"> ${_esc(display)}</span></span>`
    }
    return img
  }
  if (tag === "skill") {
    const s = content.trim()
    return `<img src="${pic}/skills/${_urlFile(`${s}_skill.png`)}" alt="${_esc(s)}" class="skill-status-icon" onerror="${_imgErrHide}">`
  }
  if (tag === "status") {
    const p = content.split("|").map(s => s.trim())
    const mainId = p[0] || ""
    const overlay = p[1]
    const element = p[2]
    let html = _statusIconImgTag(pic, mainId, mainId)
    if (overlay === "und_debuff" || overlay === "und_buff") {
      const ovName = overlay === "und_debuff" ? "Undispellable_Debuff" : "Undispellable_Buff"
      const ovPrimary = `${pic}/icons/status/${_urlFile(`Status_${ovName}.png`)}`
      const ovLegacy = `${pic}/icons/status/${_urlFile(`status_${ovName}.png`)}`
      html = `<span class="skill-status-icon-wrap"><img src="${ovPrimary}" data-status-alt-src="${_esc(ovLegacy)}" alt="${_esc(overlay)}" class="skill-status-icon skill-status-icon-overlay" onerror="${_imgErrStatusIconAttr()}">${html}</span>`
    }
    if (element) {
      const elIconName = _EL_ICONS[element.toLowerCase()] || (element.charAt(0).toUpperCase() + element.slice(1))
      const elImg = `<img src="${pic}/icons/${_urlFile(`${elIconName}.png`)}" alt="${_esc(element)}" class="skill-status-icon skill-status-icon-element" onerror="${_imgErrHide}">`
      html = `<span class="skill-status-icon-wrap">${html}${elImg}</span>`
    }
    const tip = _statusIdToHoverLabel(mainId)
    const tipAttr = tip ? ` data-status-tip="${_esc(tip)}"` : ""
    return `<span class="skill-status-hover-wrap"${tipAttr}>${html}</span>`
  }
  if (tag === "type") {
    const t = content.trim()
    return `<img src="${pic}/icons/${_urlFile(`${t}.png`)}" alt="${_esc(t)}" class="skill-status-icon" onerror="${_imgErrHide}">`
  }
  if (tag === "position") {
    const p = content.trim()
    return `<img src="${pic}/icons/${_urlFile(`${p}.png`)}" alt="${_esc(p)}" class="skill-status-icon" onerror="${_imgErrHide}">`
  }
  if (tag === "hover") {
    const raw = String(content || "")
    const i = raw.indexOf(":")
    const hoverText = i >= 0 ? raw.slice(0, i).trim() : raw.trim()
    const visibleText = i >= 0 ? raw.slice(i + 1).trim() : raw.trim()
    if (!visibleText) return ""
    const visibleHtml = _expandColorHeaderBlocks(visibleText, pic)
    return `<span class="char-inline-hover" data-hover="${_esc(hoverText || visibleText)}">${visibleHtml}</span>`
  }
  if (tag === "color") {
    const ci = content.indexOf(":"), key = ci >= 0 ? content.slice(0, ci).trim() : content
    const disp = ci >= 0 ? content.slice(ci + 1).trim() : content
    const hexKey = String(key).trim()
    if (/^[0-9a-f]{3}$/i.test(hexKey) || /^[0-9a-f]{6}$/i.test(hexKey) || /^[0-9a-f]{8}$/i.test(hexKey)) {
      const hx = /^[0-9a-f]{3}$/i.test(hexKey) ? hexKey.split("").map((c) => c + c).join("") : hexKey
      return `<span class="text-tag text-bold" style="color:#${_esc(hx)}">${_expandColorHeaderBlocks(disp, pic)}</span>`
    }
    const keyNorm = String(key).trim().toLowerCase()
    const elementToCss = {
      ice: "ice",
      fire: "fire",
      light: "light",
      dark: "darkness",
      darkness: "darkness",
      steel: "steel",
      poison: "poison",
      water: "water",
      wind: "wind",
      grass: "grass",
      electricity: "electricity",
      chaos: "chaos",
      earth: "earth"
    }
    const elCss = elementToCss[keyNorm]
    if (elCss) {
      return `<span class="text-tag text-${elCss} text-bold">${_expandColorHeaderBlocks(disp, pic)}</span>`
    }
    return `<span class="text-tag text-color-${_esc(key)} text-bold">${_expandColorHeaderBlocks(disp, pic)}</span>`
  }
  if (tag === "rally") {
    return `<span class="text-tag text-rally text-bold">${_esc(content)}</span>`
  }
  const span = `<span class="text-tag text-${tag} text-bold">${_esc(content)}</span>`
  if (noIcon) return span
  const iconName = _EL_ICONS[tag] || tag.charAt(0).toUpperCase() + tag.slice(1)
  return `<img src="${pic}/icons/${_urlFile(`${iconName}.png`)}" alt="${_esc(tag)}" class="skill-status-icon text-tag" onerror="${_imgErrHide}">${span}`
}

/** Remaining text: standard tag{…} tokens only (no color-header — use balanced expand first). */
function _replaceStandardTags(text, pic) {
  if (!text || typeof text !== "string") return ""
  let i = 0
  let out = ""
  while (i < text.length) {
    const hit = _findNextStandardTag(text, i)
    if (!hit) {
      out += text.slice(i)
      break
    }
    out += text.slice(i, hit.index)
    const block = _extractBalancedBraceContent(text, hit.openBrace)
    if (!block) {
      out += text.slice(hit.index, hit.index + 1)
      i = hit.index + 1
      continue
    }
    out += _renderSingleTag(hit.tag, hit.noIcon, block.inner, pic)
    i = block.end
  }
  return out
}

/**
 * color-header{HEX:…} or color-header{slug:…} with balanced {…} so payload may contain status{…|…}.
 */
function _expandColorHeaderBlocks(text, pic) {
  if (!text || typeof text !== "string") return ""
  let i = 0
  let out = ""
  while (i < text.length) {
    const k = text.indexOf(_COLOR_HEADER_PREFIX, i)
    if (k < 0) {
      out += _replaceStandardTags(text.slice(i), pic)
      break
    }
    out += _replaceStandardTags(text.slice(i, k), pic)
    const openBrace = k + _COLOR_HEADER_PREFIX.length - 1
    let depth = 0
    let j = openBrace
    for (; j < text.length; j++) {
      const c = text[j]
      if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) {
          j++
          break
        }
      }
    }
    if (depth !== 0) {
      out += text.slice(k)
      break
    }
    const inner = text.slice(openBrace + 1, j - 1)
    const hexHdr = inner.match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}):([\s\S]*)$/i)
    if (hexHdr) {
      const key = hexHdr[1]
      const disp = hexHdr[2]
      const hx = key.length === 3 ? key.split("").map((c) => c + c).join("") : key
      out += `<span class="text-tag text-bold" style="color:#${_esc(hx)}">${_expandColorHeaderBlocks(disp, pic)}</span>`
    } else {
      const colon = inner.indexOf(":")
      const slug = colon >= 0 ? inner.slice(0, colon).trim() : inner.trim()
      const disp = colon >= 0 ? inner.slice(colon + 1) : ""
      out += `<span class="text-tag text-color-${_esc(slug)} text-bold">${_expandColorHeaderBlocks(disp, pic)}</span>`
    }
    i = j
  }
  return out
}

function tagParser(text) {
  if (!text || typeof text !== "string") return ""
  return _expandColorHeaderBlocks(text, getGamePictureRoot())
}

/**
 * Skill detail / %{attr} display: insert thousands separators (e.g. 1087 → 1,087) without rounding
 * or changing fractional digits (matches in-game style).
 */
function formatSkillAttrNumberForDisplay(val) {
  const s = String(val).trim()
  if (!s || /[eE]/.test(s)) return s
  const neg = s.startsWith("-")
  const rest = neg ? s.slice(1) : s
  const dot = rest.indexOf(".")
  const intPart = dot >= 0 ? rest.slice(0, dot) : rest
  const fracPart = dot >= 0 ? rest.slice(dot) : ""
  if (!/^\d+$/.test(intPart)) return s
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return (neg ? "-" : "") + withCommas + fracPart
}

function lineStartsWithSectionHeader(line) {
  let s = line
  while (s.startsWith("indent{}")) s = s.slice("indent{}".length)
  return /^(?:color-|rally-)?header\{/.test(s)
}

function renderSkillTaggedText(tagged, skillAttr, levelIndex) {
  if (!tagged || typeof tagged !== "string") return ""
  let text = tagged
  if (skillAttr && levelIndex != null) {
    text = text.replace(/%\{([^}]+)\}/g, (_, inner) => {
      const pipe = inner.indexOf("|")
      const attrKey = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim()
      const modifier = pipe >= 0 ? inner.slice(pipe + 1).trim().toLowerCase() : ""
      const arr = skillAttr[attrKey]
      if (!arr || !Array.isArray(arr)) return `%{${inner}}`
      const val = arr[levelIndex]
      if (val == null) return "%"
      const isFlat = modifier === "flat"
      // Never round attr values; use the exact precision provided in data.
      const formatted = formatSkillAttrNumberForDisplay(val)
      const suffix = isFlat ? "" : "%"
      return formatted + suffix
    })
  }
  const parts = []
  let lisBuf = []
  let forceHeaderNext = false
  const flushUl = () => { if (lisBuf.length) { parts.push(`<ul class="char-skill-details-list">${lisBuf.join("")}</ul>`); lisBuf = [] } }
  text.split(/<br>/).forEach((line) => {
    const isRallyHeader = /rally-header\{/.test(line) && lineStartsWithSectionHeader(line)
    const isHeader = lineStartsWithSectionHeader(line) || forceHeaderNext
    if (isHeader) {
      flushUl()
      const tightClass = forceHeaderNext ? " char-skill-details-line-tight" : ""
      parts.push(`<div class="char-skill-details-line${tightClass}">${tagParser(line)}</div>`)
      forceHeaderNext = isRallyHeader
    } else {
      let stripped = line
      let indentLevel = 0
      while (stripped.startsWith("indent{}")) { stripped = stripped.slice("indent{}".length); indentLevel++ }
      const style = indentLevel ? ` style="margin-left:${indentLevel * 1.5}em"` : ""
      lisBuf.push(`<li${style}>${tagParser(stripped)}</li>`)
      forceHeaderNext = false
    }
  })
  flushUl()
  return parts.join("")
}

function renderInlineTaggedText(text) {
  return tagParser(text)
}

function getCharacterFromURL(){
    const params = new URLSearchParams(window.location.search)
    return params.get("char")
}

function getSelectedGameId() {
    try {
        const s = JSON.parse(localStorage.getItem("tierlistUIState") || "{}")
        if (s.game && typeof s.game === "string") return s.game
    } catch {}
    return "crk"
}

function getGamePictureRoot() {
    const data = window.CRK_DATA
    const id = getSelectedGameId()
    const game = data?.games?.find(g => g.id === id)
    const folder = (game && game.assetsBase != null) ? game.assetsBase : (game?.id || "crk")
    const inCrkSubdir = /\/crk\/[^/]*$/i.test((window.location.pathname || "").replace(/\\/g, "/"))
    if (!inCrkSubdir) return `${folder}/pictures`
    // character/info pages live in /crk; resolve assets relative to this subdir without relying on <base>.
    return folder === "crk" ? "pictures" : `../${folder}/pictures`
}

function getPageImagePath(name) {
    return `${getGamePictureRoot()}/chars/${_urlFile(`${name}_illustration.png`)}`
}

function isLegendaryTartBonus(bonusEffect) {
  const v = bonusEffect
  return v != null && String(v).trim() !== ""
}

/** @deprecated use isLegendaryTartBonus */
function isLegendaryTartSet(topSet) {
  return isLegendaryTartBonus(topSet?.bonusEffect)
}

const BUILD_RANK_SORT_ORDER = { best: 0, recommended: 1 }

function compareBuildIdsForDisplay(a, b, builds) {
  const rankA = BUILD_RANK_SORT_ORDER[builds[a]?.rank] ?? 2
  const rankB = BUILD_RANK_SORT_ORDER[builds[b]?.rank] ?? 2
  if (rankA !== rankB) return rankA - rankB
  const numA = parseInt(a, 10)
  const numB = parseInt(b, 10)
  if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB
  return String(a).localeCompare(String(b))
}

function getSortedBuildIds(builds) {
  if (!builds || typeof builds !== "object") return []
  return Object.keys(builds)
    .filter((k) => k !== "notes")
    .sort((a, b) => compareBuildIdsForDisplay(a, b, builds))
}

/** Builds are archived unless explicitly marked `active: true` in data.js. */
function isBuildActive(build) {
  return !!(build && typeof build === "object" && build.active === true)
}

function partitionBuildIdsByActive(builds) {
  const active = []
  const archived = []
  for (const id of getSortedBuildIds(builds)) {
    const build = builds[id]
    if (!build || typeof build !== "object") continue
    if (isBuildActive(build)) active.push(id)
    else archived.push(id)
  }
  return { active, archived }
}

function getSetIndicesReferencedByBuildIds(builds, buildIds) {
  const toppings = new Set()
  const beascuit = new Set()
  for (const id of buildIds) {
    const build = builds[id]
    if (!build || typeof build !== "object") continue
    const t = build.toppings
    const b = build.beascuit
    if (Number.isInteger(t) && t >= 1) toppings.add(t)
    if (Number.isInteger(b) && b >= 1) beascuit.add(b)
  }
  return { toppings, beascuit }
}

function partitionSetIndicesByActive(totalCount, activeIndices) {
  const active = []
  const archived = []
  for (let i = 1; i <= totalCount; i++) {
    if (activeIndices.has(i)) active.push(i)
    else archived.push(i)
  }
  return { active, archived }
}

function buildCatalogGroupHtml(title, innerHtml, options) {
  const cardCount = options?.cardCount ?? 0
  if (!innerHtml || cardCount <= 0) return ""
  const kind = options?.kind === "archived" ? " char-build-catalog-group--archived" : ""
  const wrapperSingleClass = cardCount === 1 ? " char-build-section-wrapper-single" : ""
  const wrapperClass = options?.wrapperClass || "char-build-section-wrapper"
  const setsSingleClass = options?.setsSingle ? " char-build-sets-wrapper-single" : ""
  const titleTag = options?.titleTag || "h4"
  const titleClass = titleTag === "h5" ? "char-sets-subsection-title" : "char-build-catalog-title"
  const headingHtml = title
    ? `<${titleTag} class="${titleClass}">${title}</${titleTag}>`
    : ""
  return `<div class="char-build-catalog-group${kind}">
    ${headingHtml}
    <div class="${wrapperClass}${wrapperSingleClass}${setsSingleClass}">${innerHtml}</div>
  </div>`
}

function buildSetsGridHtml(title, innerHtml, cardCount) {
  if (!innerHtml || cardCount <= 0) return ""
  const setsSingleClass = cardCount === 1 ? " char-build-sets-wrapper-single" : ""
  return `<div class="char-build-sets-subgroup">
    <h5 class="char-sets-subsection-title">${title}</h5>
    <div class="char-build-sets-wrapper${setsSingleClass}">${innerHtml}</div>
  </div>`
}

/** Tart art tiers: 3 = epic, 4 = legendary (falls back to epic when missing). */
function getToppingImagePath(type, resonance, isTart, tartLegendary) {
  const pic = getGamePictureRoot()
  if (isTart) {
    const level = tartLegendary ? 4 : 3
    return `${pic}/toppings/tart/${_urlFile(`Topping_tart_${type}_${level}.png`)}`
  }
  if (resonance) {
    return `${pic}/toppings/${type}/${_urlFile(`Topping_${type}_${resonance.toLowerCase()}.png`)}`
  }
  return `${pic}/toppings/${type}/${_urlFile(`Topping_${type}_3.png`)}`
}

/** Pre-tart era plate art (no slot 6); lives in toppings/ root, not tart/. */
function getToppingPlateBackPath() {
  const pic = getGamePictureRoot()
  return `${pic}/toppings/${_urlFile("Topping_main_back.png")}`
}

/** In-game selectable art: `toppings/resonant/Topping_selectable_<resonance_slug>.png` (slug lowercased). */
function getResonantSelectableImagePath(resonanceSlug) {
  const pic = getGamePictureRoot()
  const raw = String(resonanceSlug || "").trim().toLowerCase().replace(/\s+/g, "_")
  if (!raw) return `${pic}/toppings/${_urlFile("unknown.png")}`
  return `${pic}/toppings/resonant/${_urlFile(`Topping_selectable_${raw}.png`)}`
}

function formatResonanceSetLabel(slug) {
  const s = String(slug || "").trim()
  if (!s) return ""
  return s
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ")
}

function siteRelativePath(file) {
  const p = (location.pathname || "").replace(/\\/g, "/")
  if (/\/crk\/[^/]+\.html$/i.test(p)) return `../${file}`
  return file
}

function _runWhenIdle(fn) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(fn, { timeout: 250 })
  } else {
    setTimeout(fn, 0)
  }
}

let _resonantToppingsMapPromise = null
async function loadResonantToppingsMap() {
  if (_resonantToppingsMapPromise) return _resonantToppingsMapPromise
  _resonantToppingsMapPromise = fetch(siteRelativePath("tools/resonant_toppings.json"))
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && typeof j === "object" && !Array.isArray(j) ? j : null))
    .catch(() => null)
  return _resonantToppingsMapPromise
}

function renderResonantToppingsSection(charData, name) {
  const resonantEl = document.getElementById("char-resonant-toppings")
  if (!resonantEl) return
  if (!charData) {
    resonantEl.hidden = true
    resonantEl.innerHTML = ""
    return
  }
  void loadResonantToppingsMap().then((resonantMap) => {
    const resonants = getResonancesForCookieFromMap(resonantMap, charData.name || name)
      .map((r) => String(r || "").trim())
      .filter(Boolean)
    if (resonants.length === 0) {
      resonantEl.hidden = true
      resonantEl.innerHTML = ""
      return
    }
    resonantEl.hidden = false
    const items = resonants.map((res) => {
      const label = getResonanceDisplayNameFromMap(resonantMap, res) || formatResonanceSetLabel(res)
      const src = getResonantSelectableImagePath(res)
      return `<div class="char-resonant-item">
        <img src="${src}" alt="${_esc(label)}" title="${_esc(label)}" class="char-resonant-preview" loading="lazy" decoding="async" onerror="${_imgErrToppingAttr()}">
        <span class="char-resonant-item-label">${_esc(label)}</span>
      </div>`
    }).join("")
    resonantEl.innerHTML = `<div class="char-resonant-inner">
      <h3 class="char-resonant-heading">Resonant Toppings</h3>
      <div class="char-resonant-list">${items}</div>
    </div>`
  })
}

function getResonancesForCookieFromMap(mapObj, cookieName) {
  if (!mapObj || !cookieName) return []
  const target = String(cookieName).trim().toLowerCase()
  if (!target) return []
  const out = []
  for (const [slug, raw] of Object.entries(mapObj)) {
    if (!slug) continue
    const cookies = raw && Array.isArray(raw.cookies) ? raw.cookies : []
    const hit = cookies.some((c) => String(c || "").trim().toLowerCase() === target)
    if (hit) out.push(String(slug))
  }
  return out
}

function getResonanceDisplayNameFromMap(mapObj, slug) {
  if (!mapObj || !slug) return ""
  const raw = mapObj[String(slug)]
  if (raw && typeof raw === "object" && !Array.isArray(raw) && typeof raw.name === "string") {
    const name = raw.name.trim()
    if (name) return name
  }
  return ""
}

function getBeascuitStatLabel(val) {
  const map = { drb: "DMR", cd: "CD", atk: "ATK", hp: "HP" }
  const v = String(val || "").toLowerCase()
  if (v === "bypass") return "Bypass"
  return map[v]
}

function getBeascuitName(element, cookieType, tainted) {
  const elementMap = {
    darkness: "Dark",
    electricity: "Thunderous",
    fire: "Burning",
    earth: "Earthen",
    poison: "Poisonous",
    light: "Gleaming",
    water: "Surging",
    ice: "Frozen",
    steel: "Steelen",
    grass: "Verdant",
    wind: "Wuthering",
    chaos: "Chaotic"
  }
  
  const typeMap = {
    ambush: "Crispy",
    defense: "Hard",
    charge: "Chewy",
    ranged: "Light",
    bomber: "Spicy",
    magic: "Zesty",
    support: "Hearty",
    healing: "Sweet"
  }
  
  const elementName = elementMap[element?.toLowerCase()] || ""
  const typeName = typeMap[cookieType?.toLowerCase()] || ""
  const prefix = tainted ? "Tainted" : "Legendary"
  return `${prefix}${elementName ? " " + elementName : ""} ${typeName} Beascuit`
}

function getBeascuitBaseNumber(element) {
  if (!element) return "01"
  
  const el = element.toLowerCase()
  if (el === null || el === undefined || el === "") return "01"
  if (el === "darkness" || el === "electricity") return "02"
  if (el === "fire" || el === "earth") return "03"
  if (el === "poison" || el === "light" || el === "water") return "04"
  if (el === "ice" || el === "steel") return "05"
  if (el === "grass" || el === "wind") return "06"
  if (el === "chaos") return "07"
  
  return "01"
}

function getBeascuitTypeSuffix(element) {
  return getBeascuitBaseNumber(element)
}

function getBeascuitTypeImagePath(pic, cookieType, element) {
  const suffix = getBeascuitTypeSuffix(element)
  return `${pic}/beascuit/${cookieType}${suffix}.png`
}

function getBeascuitBaseImagePath(pic, cookieType, tainted) {
  const file = tainted
    ? `Beascuit_tainted_${cookieType}_legendary.png`
    : `Beascuit_${cookieType}_legendary.png`
  return `${pic}/beascuit/${file}`
}

const _lazyImgAttrs = (lazy) => (lazy ? ' loading="lazy" decoding="async"' : "")

const _CJ_RARITIES = ["Dragon", "Legendary", "Ancient", "Beast", "Witch"]

function charHasCrystalJam(charData) {
  const normalizedRarity = normalizeRarity(charData?.rarity || "")
  return !!(_CJ_RARITIES.includes(normalizedRarity) && charData?.cjSkill)
}

function charShowsMcSkill(charData) {
  return typeof shouldRenderMcSkill === "function" ? shouldRenderMcSkill(charData) : !!charData?.mcSkill
}

function buildCharReviewBlockHtml(title, review, rating, skillAttr) {
  if (!review && !rating) return ""
  const ratingHtml = rating
    ? `<div class="char-review-rating" data-rating="${rating}">
           <span class="char-review-rating-label">Rating</span>
           <span class="char-review-rating-letter">${rating}</span>
       </div>`
    : ""
  const bodyHtml = review
    ? `<div class="char-review-body">${renderInlineTaggedText(review, skillAttr)}</div>`
    : ""
  return `
    <div class="char-review-block">
      <div class="char-review-header-bar">
        <h3 class="char-section-title">${title}</h3>
      </div>
      <div class="char-section-divider"></div>
      <div class="char-review-content">${bodyHtml}${ratingHtml}</div>
    </div>
  `
}

function renderMcCjReviewSection(charData) {
  const section = document.getElementById("char-mccj-review-section")
  if (!section) return

  let html = ""
  if (charShowsMcSkill(charData) && (charData?.mcReview || charData?.mcRating)) {
    html = buildCharReviewBlockHtml(
      "Magic Candy Review",
      charData.mcReview,
      charData.mcRating,
      charData.skillAttrMc ?? charData?.skillAttr
    )
  } else if (charHasCrystalJam(charData) && (charData?.cjReview || charData?.cjRating)) {
    html = buildCharReviewBlockHtml(
      "Crystal Jam Review",
      charData.cjReview,
      charData.cjRating,
      charData.cjSkillAttr ?? charData?.skillAttr
    )
  }

  if (html) {
    section.innerHTML = html
    section.style.display = "block"
  } else {
    section.innerHTML = ""
    section.style.display = "none"
  }
}

/** Topping row + optional build substats / tart bonus HTML */
function buildToppingsSetBlockHtml(topSet, options) {
  if (!topSet || typeof topSet !== "object") return { starHtml: "", substatsHtml: "", bonusEffectHtml: "" }
  const lazy = !!(options && options.lazyImages)
  const lazyAttr = _lazyImgAttrs(lazy)
  let resonance = topSet.resonance
  if (options && Object.prototype.hasOwnProperty.call(options, "resonance")) {
    resonance = options.resonance
  }
  const substats = Array.isArray(options?.substats) ? options.substats : []
  const bonusEffect = options?.bonusEffect
  const legendaryTart = isLegendaryTartBonus(bonusEffect)
  const showTart = !(options && options.showTart === false)
  const showLegendaryTart = !(options && options.showLegendaryTart === false)
  const useLegendaryTart = legendaryTart && showLegendaryTart
  const toppingSlots = []
  for (let s = 1; s <= 6; s++) {
    if (s === 6 && !showTart) continue
    const type = topSet[s]
    if (!type) continue
    const isTart = s === 6
    const src = getToppingImagePath(type, isTart ? null : resonance, isTart, isTart && useLegendaryTart)
    const fallbackSrc = isTart && useLegendaryTart
      ? getToppingImagePath(type, null, true, false)
      : getToppingImagePath(type, null, isTart)
    toppingSlots.push({ src, fallbackSrc, type, isTart, slot: s })
  }
  const regularToppings = toppingSlots.filter(t => !t.isTart)
  const tart = toppingSlots.find(t => t.isTart)
  const usePlateBack = !showTart && regularToppings.length > 0
  const hasPlate = tart || usePlateBack
  const rowClass = hasPlate ? "char-toppings-row" : "char-toppings-row char-toppings-row--no-tart"
  let rowHtml = `<div class="${rowClass}"><div class="char-toppings-plate">`
  if (tart) {
    const tartClass = useLegendaryTart ? "char-topping-tart-base char-topping-tart-legendary" : "char-topping-tart-base"
    rowHtml += `<img src="${tart.src}" data-fallback-src="${tart.fallbackSrc || ""}" alt="${tart.type}" class="${tartClass}"${lazyAttr} onerror="${_imgErrToppingAttr()}">`
  } else if (usePlateBack) {
    rowHtml += `<img src="${getToppingPlateBackPath()}" alt="" class="char-topping-tart-base char-topping-plate-back"${lazyAttr} onerror="${_imgErrToppingAttr()}">`
  }
  rowHtml += `<div class="char-toppings-items">`
  regularToppings.forEach((t, i) => {
    const pos = i + 1
    const imgHtml = `<img src="${t.src}" data-fallback-src="${t.fallbackSrc || ""}" alt="${t.type}" class="char-topping-item"${lazyAttr} onerror="${_imgErrToppingAttr()}">`
    if (hasPlate && pos === 4) {
      rowHtml += `<div class="char-topping-star-slot char-topping-pos-4-split char-topping-pos-4-split--back"><div class="char-topping-graphic">${imgHtml}</div></div>`
      rowHtml += `<div class="char-topping-star-slot char-topping-pos-4-split char-topping-pos-4-split--front"><div class="char-topping-graphic">${imgHtml}</div></div>`
    } else {
      rowHtml += `<div class="char-topping-star-slot char-topping-pos-${pos}"><div class="char-topping-graphic">${imgHtml}</div></div>`
    }
  })
  rowHtml += `</div></div></div>`
  const substatsHtml = substats.map(s => `<div class="char-build-substat">- ${s}</div>`).join("")
  let bonusEffectHtml = ""
  if (showTart && useLegendaryTart) {
    const label =
      typeof getTartBonusEffectDisplayLabel === "function"
        ? getTartBonusEffectDisplayLabel(bonusEffect)
        : String(bonusEffect).trim()
    if (label) {
      bonusEffectHtml = `<div class="char-build-bonus-effect"><div class="char-build-bonus-effect-title">Bonus Effect</div><div class="char-build-bonus-effect-value">${label}</div></div>`
    }
  }
  return { starHtml: rowHtml, substatsHtml, bonusEffectHtml }
}

/** Substats + tart bonus panel (character builds: separate boxes; teams: separate compact boxes). */
function buildToppingsDetailsHtml(options) {
  const substats = Array.isArray(options?.substats) ? options.substats.filter(Boolean) : []
  const bonusEffect = options?.bonusEffect
  const showTart = !(options && options.showTart === false)
  const showLegendaryTart = !(options && options.showLegendaryTart === false)
  const teamsCompact = !!(options && options.teamsCompact)
  const legendaryTart = isLegendaryTartBonus(bonusEffect)
  const useLegendaryTart = legendaryTart && showLegendaryTart
  let bonusLabel = ""
  if (showTart && useLegendaryTart) {
    bonusLabel =
      typeof getTartBonusEffectDisplayLabel === "function"
        ? getTartBonusEffectDisplayLabel(bonusEffect)
        : String(bonusEffect || "").trim()
  }
  if (!substats.length && !bonusLabel) return ""

  if (teamsCompact) {
    const panel = (title, body) =>
      `<div class="teams-toppings-stats-panel"><div class="char-build-beascuit-stats-title">${title}</div>${body}</div>`
    let html = `<div class="char-build-toppings-details teams-toppings-stats-stack">`
    if (substats.length) {
      html += panel("Substats", substats.map(s => `<div class="char-build-beascuit-stat">- ${s}</div>`).join(""))
    }
    if (bonusLabel) {
      html += `<div class="teams-toppings-stats-panel teams-toppings-stats-panel--bonus"><div class="char-build-beascuit-stats-title">Bonus Effect</div><div class="char-build-beascuit-stat">${bonusLabel}</div></div>`
    }
    html += `</div>`
    return html
  }

  const substatsHtml = substats.map(s => `<div class="char-build-substat">- ${s}</div>`).join("")
  const subBlock = substats.length
    ? `<div class="char-build-substats"><div class="char-build-substats-title">Substats</div>${substatsHtml}</div>`
    : ""
  const bonusBlock = bonusLabel
    ? `<div class="char-build-bonus-effect"><div class="char-build-bonus-effect-title">Bonus Effect</div><div class="char-build-bonus-effect-value">${bonusLabel}</div></div>`
    : ""
  return `<div class="char-build-toppings-details">${subBlock}${bonusBlock}</div>`
}

/**
 * Beascuit column inner HTML for one entry in sets.beascuit
 * @param {{ teamsImageOverlay?: boolean }} [options] - If teamsImageOverlay, omit the name and paint stats on top of the image (teams cards).
 */
function buildBeascuitSetBlockHtml(biscuitSet, charData, options) {
  if (!biscuitSet || typeof biscuitSet !== "object") {
    return { beascuitNameHtml: "", beascuitRowHtml: "" }
  }
  const teamsImageOverlay = !!(options && options.teamsImageOverlay)
  const lazyAttr = _lazyImgAttrs(!!(options && options.lazyImages))
  const el = (biscuitSet.element || "").trim()
  const cookieType = (charData?.type || "unknown").toLowerCase()
  const tainted = !!biscuitSet.tainted
  const pic = getGamePictureRoot()
  const beascuitName = getBeascuitName(el, cookieType, tainted)
  let statsLines = []
  if (tainted) {
    if (el) statsLines.push(`${el.charAt(0).toUpperCase() + el.slice(1)} Taint`)
    statsLines.push(...[biscuitSet["2"], biscuitSet["3"], biscuitSet["4"]].filter(Boolean))
  } else {
    statsLines = [biscuitSet["1"], biscuitSet["2"], biscuitSet["3"], biscuitSet["4"]].filter(Boolean)
  }
  const beascuitNameHtml = teamsImageOverlay
    ? ""
    : (beascuitName ? `<div class="char-beascuit-name">${beascuitName}</div>` : "")
  const imgAlt = _esc(beascuitName || "Beascuit")
  let statsBeside = ""
  let statsOnImage = ""
  if (statsLines.length > 0) {
    if (teamsImageOverlay) {
      statsOnImage = `<div class="char-build-beascuit-stats teams-beascuit-stats-on-image" aria-label="Beascuit stats">${statsLines.map(s => `<div class="char-build-beascuit-stat">- ${s}</div>`).join("")}</div>`
    } else {
      statsBeside = `<div class="char-build-beascuit-stats"><div class="char-build-beascuit-stats-title">Stats</div>${statsLines.map(s => `<div class="char-build-beascuit-stat">- ${s}</div>`).join("")}</div>`
    }
  }
  const wrapExtraClass = teamsImageOverlay && statsOnImage ? " teams-beascuit-image-has-stats" : ""
  const beascuitImageHtml = `<div class="char-beascuit-image-wrapper${wrapExtraClass}">
    <img src="${getBeascuitBaseImagePath(pic, cookieType, tainted)}" alt="" class="char-beascuit-base-overlay"${lazyAttr} onerror="${_imgErrHide}">
    <img src="${getBeascuitTypeImagePath(pic, cookieType, el)}" alt="${imgAlt}" class="char-beascuit-icon"${lazyAttr} onerror="${_imgErrHide}">
    ${teamsImageOverlay ? statsOnImage : ""}
  </div>`
  let beascuitRowHtml = ""
  if (teamsImageOverlay) {
    beascuitRowHtml = beascuitImageHtml
      ? `<div class="char-beascuit-content-row teams-beascuit-row-teams">${beascuitImageHtml}</div>`
      : ""
  } else {
    beascuitRowHtml = (beascuitImageHtml || statsBeside)
      ? `<div class="char-beascuit-content-row">${beascuitImageHtml}${statsBeside}</div>`
      : ""
  }
  return { beascuitNameHtml, beascuitRowHtml }
}

/** Rarity bucket for filters / CJ eligibility (AncientA → Ancient, Zhencang → Special). */
function rarityFilterBucket(rarity) {
  if (rarity === "AncientA") return "Ancient"
  if (rarity === "Zhencang") return "Special"
  if (rarity === "New Legendary") return "Legendary"
  if (rarity === "New Dragon") return "Dragon"
  return rarity
}

/** Icon filename stem under pictures/icons/ (New Legendary / New Dragon use dedicated art when present). */
function rarityIconBasename(rarity) {
  if (rarity === "New Legendary") return "New Legendary"
  if (rarity === "New Dragon") return "New Dragon"
  if (rarity === "AncientA") return "Ancient"
  return rarity
}

/** Fallback icon stem when the dedicated rarity asset is missing. */
function rarityIconFallbackBasename(rarity) {
  if (rarity === "New Dragon") return "Dragon"
  return null
}

function rarityIconOnErrorHandler(rawRarity, pic) {
  const fallback = rarityIconFallbackBasename(rawRarity)
  if (!fallback) return _imgErrHide
  const fbPath = `${pic}/icons/${_urlFile(`${fallback}.png`)}`
  return `this.onerror=null;if(this.dataset.rarityFb!=='1'){this.dataset.rarityFb='1';this.src='${fbPath}'}else{this.style.display='none'}`
}

function normalizeRarity(rarity) {
  return rarityFilterBucket(rarity)
}

/** Match CSS breakpoint in styles.css (wide build columns / sets grid). */
const BUILD_MASONRY_MIN_WIDTH = 1800

function isBuildMasonryWideViewport() {
  return window.matchMedia(`(min-width: ${BUILD_MASONRY_MIN_WIDTH}px)`).matches
}

function isCharacterBuildSectionHidden(el) {
  if (!el) return true
  if (el.style.display === "none") return true
  return getComputedStyle(el).display === "none"
}

function scheduleCharacterBuildsMasonryAfterImages(root) {
  if (!root) return
  root.querySelectorAll("img").forEach((img) => {
    const onDone = () => {
      if (img.classList.contains("char-topping-item") && typeof initToppingGraphic === "function") {
        initToppingGraphic(img)
      }
      scheduleCharacterBuildsMasonrySync()
    }
    if (img.complete) return
    img.addEventListener("load", onDone, { once: true })
    img.addEventListener("error", onDone, { once: true })
  })
}

function applyBuildMasonryFromFlatWrapper(wrapper) {
  const cards = Array.from(wrapper.querySelectorAll(".char-build-card[data-build-id]"))
  if (cards.length <= 1) return
  const masonry = document.createElement("div")
  masonry.className = "char-build-masonry"
  const colA = document.createElement("div")
  colA.className = "char-build-masonry-col"
  const colB = document.createElement("div")
  colB.className = "char-build-masonry-col"
  masonry.appendChild(colA)
  masonry.appendChild(colB)
  wrapper.innerHTML = ""
  wrapper.appendChild(masonry)
  colA.appendChild(cards[0])
  colB.appendChild(cards[1])
  for (let i = 2; i < cards.length; i++) {
    const aH = colA.getBoundingClientRect().height
    const bH = colB.getBoundingClientRect().height
    ;(aH <= bH ? colA : colB).appendChild(cards[i])
  }
}

function flattenBuildMasonryWrapper(wrapper) {
  if (!wrapper.querySelector(".char-build-masonry")) return
  const cards = Array.from(wrapper.querySelectorAll(".char-build-card[data-build-id]"))
  if (!cards.length) return
  cards.sort((a, b) =>
    String(a.dataset.buildId).localeCompare(String(b.dataset.buildId), undefined, { numeric: true })
  )
  const frag = document.createDocumentFragment()
  cards.forEach((c) => frag.appendChild(c))
  wrapper.innerHTML = ""
  wrapper.appendChild(frag)
}

function syncBuildMasonryWrapper(wrapper, buildsVisible, wide) {
  if (!wrapper || wrapper.classList.contains("char-build-section-wrapper-single")) return
  const cardCount = wrapper.querySelectorAll(".char-build-card[data-build-id]").length
  if (cardCount <= 1) return
  const hasMasonry = !!wrapper.querySelector(".char-build-masonry")
  if (!wide) {
    if (hasMasonry) flattenBuildMasonryWrapper(wrapper)
    return
  }
  if (!buildsVisible) return
  if (hasMasonry) flattenBuildMasonryWrapper(wrapper)
  applyBuildMasonryFromFlatWrapper(wrapper)
}

function syncCharacterBuildsMasonryLayout() {
  const buildSection = document.getElementById("Builds")
  if (!buildSection || isCharacterBuildSectionHidden(buildSection)) return

  const buildsPanel = buildSection.querySelector('.char-build-panel[data-panel="builds"]')
  if (!buildsPanel) return

  const wide = isBuildMasonryWideViewport()
  const buildsVisible = buildsPanel.style.display !== "none"
  buildsPanel.querySelectorAll(".char-build-section-wrapper").forEach((wrapper) => {
    syncBuildMasonryWrapper(wrapper, buildsVisible, wide)
  })
}

let characterBuildMasonryResizeTimer = null
let characterBuildMasonryResizeBound = false

function scheduleCharacterBuildsMasonrySync() {
  if (characterBuildMasonryResizeTimer) clearTimeout(characterBuildMasonryResizeTimer)
  characterBuildMasonryResizeTimer = setTimeout(() => {
    characterBuildMasonryResizeTimer = null
    syncCharacterBuildsMasonryLayout()
  }, 120)
}

function renderCharPageUpdatedLine(charData) {
  const foot = document.querySelector(".site-copyright")
  if (!foot) return
  const raw = charData?.pageUpdated
  if (!raw || !String(raw).trim()) {
    const el = document.getElementById("siteLastUpdated")
    if (el) {
      el.remove()
    }
    return
  }
  const iso = String(raw).trim()
  const fmt =
    typeof window.formatManualPageDate === "function" ? window.formatManualPageDate(iso) : iso
  let el = document.getElementById("siteLastUpdated")
  if (!el) {
    el = document.createElement("p")
    el.id = "siteLastUpdated"
    el.className = "site-last-updated"
    foot.insertBefore(el, foot.firstChild)
  }
  el.hidden = false
  el.replaceChildren()
  el.appendChild(document.createTextNode("Page last updated on "))
  const time = document.createElement("time")
  time.dateTime = iso
  time.textContent = fmt
  el.appendChild(time)
}

function renderCharacterPage(){
    const urlName = getCharacterFromURL()
    if (urlName) {
        // URL should be source of truth going forward
        localStorage.removeItem("selectedCookie")
    }
    const name = urlName || localStorage.getItem("selectedCookie")
    if(!name) return

    _ensureSkillStatusCursorTip()

    const img = document.getElementById("char-image")
    img.src = getPageImagePath(name)
    img.decoding = "async"
    if ("fetchPriority" in img) img.fetchPriority = "high"

    const data = window.CRK_DATA
    const gameId = getSelectedGameId()
    const game = data?.games?.find(g => g.id === gameId) || data?.games?.[0] || null

    let charData = null
    if (game?.characters) {
        charData = game.characters.find(c => c.name === name)
    }

    document.title = charData?.displayName ?? name

    const slug = name.toLowerCase()
    const skillImageName = charData?.name || name
    const descData = window.CRK_DESCRIPTIONS || {}
    const cnDescData = window.CRK_CN_DESCRIPTIONS || {}

    const descriptionText = descData.description?.[slug] || "No description available."

    const displayName = charData?.displayName ?? name
    const normalizedRarity = normalizeRarity(charData?.rarity || "")
    const isAncientOrAwakenedAncient = normalizedRarity === "Ancient"
    const isAwakenedVariant = /^awakened_/i.test(slug)
    const isAncientA = charData?.rarity === "AncientA"
    const unawakenedSlug = slug ? slug.replace(/^awakened_/i, "") : ""
    const awakenedSlug = unawakenedSlug ? `awakened_${unawakenedSlug}` : ""
    const originalForm = (unawakenedSlug && game?.characters)
        ? (game.characters.find(c => String(c.name || "").toLowerCase() === unawakenedSlug.toLowerCase()) || null)
        : null
    const awakenedForm = (awakenedSlug && game?.characters)
        ? (game.characters.find(c => String(c.name || "").toLowerCase() === awakenedSlug.toLowerCase()) || null)
        : null

    const formSwitcherHtml = (() => {
        if (!isAncientOrAwakenedAncient) return ""
        if (!originalForm && !awakenedForm) return ""
        const isAwakenedPage = isAwakenedVariant || isAncientA
        return `<div class="char-form-switcher">
            ${originalForm ? `<button type="button" class="char-form-switch-btn ${!isAwakenedPage ? "active" : ""}" data-switch-char="${_esc(originalForm.name)}">Original</button>` : ""}
            ${awakenedForm ? `<button type="button" class="char-form-switch-btn ${isAwakenedPage ? "active" : ""}" data-switch-char="${_esc(awakenedForm.name)}">Awakened</button>` : ""}
        </div>`
    })()
    const desc = document.getElementById("char-description")
    desc.innerHTML = `
        <div class="char-desc-stars">★★★</div>
        <h2 class="char-title">${displayName}</h2>
        ${formSwitcherHtml}
        <div class="char-desc-divider"></div>
        <div class="char-description-text">${descriptionText}</div>
    `

    // Form switcher (Original / Awakened)
    desc.querySelectorAll("[data-switch-char]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-switch-char")
            if (!target) return
            const url = new URL(window.location.href)
            url.searchParams.set("char", target)
            window.location.href = url.toString()
        })
    })

    const infoBox = document.getElementById("char-info-box")
    if(charData && infoBox) {
        const rawRarity = charData.rarity || ""
        const rarityIcon = rarityIconBasename(rawRarity)
        const rarityLabel = rawRarity || rarityIcon
        const type = charData.type || ""
        const position = charData.position || ""
        const elements = Array.isArray(charData.element) ? charData.element : (charData.element ? [charData.element] : [])
        const pic = getGamePictureRoot()

        const rarityIconPath = rarityIcon ? `${pic}/icons/${_urlFile(`${rarityIcon}.png`)}` : ""
        const rarityIconErr = rarityIconOnErrorHandler(rawRarity, pic)
        const typeRow = type ? `<div class="char-stat-pill"><img src="${pic}/icons/${_urlFile(`${type}.png`)}" alt="" onerror="${_imgErrHide}"><span>${type}</span></div>` : ""
        const posRow = position ? `<div class="char-stat-pill"><img src="${pic}/icons/${_urlFile(`${position}.png`)}" alt="" onerror="${_imgErrHide}"><span>${position}</span></div>` : ""
        const elemRow = elements.length ? `<div class="char-stat-pill"><span>Element</span>${elements.map(e => `<img src="${pic}/icons/${_urlFile(`${e}.png`)}" alt="${e}" title="${e}" onerror="${_imgErrHide}">`).join("")}</div>` : ""
        infoBox.innerHTML = `
            ${rarityIcon ? `<img class="char-rarity-icon" src="${rarityIconPath}" alt="${_esc(rarityLabel)}" title="${_esc(rarityLabel)}" onerror="${rarityIconErr}">` : ""}
            <div class="char-stats-row">
                ${typeRow}
                ${posRow}
            </div>
            ${elemRow ? `<div class="char-elements-row">${elemRow}</div>` : ""}
        `
    }

    renderResonantToppingsSection(charData, name)

    const skillSection = document.getElementById("char-skill-section")
    if (!skillSection) {
        renderCharPageUpdatedLine(charData)
        return
    }
    let useBaseLevelNormal = true
    let useBaseLevelCj = true
    let showEnchants = false
    let showAscension = false
    let showGameplayNotesNormal = false
    let showGameplayNotesCj = false

    function renderSkillSectionContent() {
        const pic = getGamePictureRoot()
        const CJ_RARITIES = _CJ_RARITIES
        const normalizedRarity = normalizeRarity(charData?.rarity || "")
        const isCJ = normalizedRarity && CJ_RARITIES.includes(normalizedRarity)
        const hasCJ = !!charData?.cjSkill
        const hasMC = charShowsMcSkill(charData)
        const isAncientA = charData?.rarity === "AncientA"
        const hasMcCj = (isCJ && hasCJ) || hasMC
        const skillCtx = typeof getActiveNormalSkillContext === "function"
            ? getActiveNormalSkillContext(charData, descData, cnDescData, slug)
            : { useCn: false, skillAttr: charData?.skillAttr, skillDescData: descData, slug }
        const activeSkillAttr = skillCtx.skillAttr
        const activeSkillDescData = skillCtx.skillDescData || descData
        const activeSlug = skillCtx.slug || slug
        const cnSkillDisclaimer = skillCtx.useCn
            ? `<div class="char-skill-cj-disclaimer-wrap"><div class="char-skill-cj-disclaimer">Showing CN Kingdom skill details.</div></div>`
            : ""

        function skillBox(name, cooldown, initialCd, desc, iconPath, hasData, skillDetails, skillAttrData, lidx, detailsKey, middleContent) {
            const showBase = (lidx != null ? lidx : 0) === 0
            const descText = renderInlineTaggedText(desc || "No description available.", skillAttrData)
            let detailsHtml = ""
            if (skillDetails && detailsKey) {
                const baseHtml = renderSkillTaggedText(skillDetails, skillAttrData, 0)
                const maxHtml = renderSkillTaggedText(skillDetails, skillAttrData, 1)
                const swapClass = showBase ? "level-base" : "level-max"
                detailsHtml = `<div class="char-skill-details-swap ${swapClass}" data-level-swap="${detailsKey}"><div class="char-skill-details" data-level="base">${baseHtml}</div><div class="char-skill-details" data-level="max">${maxHtml}</div></div>`
            }
            const src = hasData ? iconPath : `${pic}/skills/unknown.png`
            const icd = (cooldown != null && initialCd != null) ? Math.round(cooldown * 0.3 * initialCd) : null
            const cdPills = cooldown != null
                ? `<span class="char-skill-cd-pills">
                    <span class="char-skill-cd-pill" data-status-tip="Base CD"><img src="${pic}/icons/clock.png" alt="" class="char-skill-clock" onerror="${_imgErrHide}">${cooldown} sec</span>
                    ${icd ? `<span class="char-skill-cd-pill char-skill-icd-pill" data-status-tip="Initial CD"><img src="${pic}/icons/clock.png" alt="" class="char-skill-clock char-skill-clock-muted" onerror="${_imgErrHide}">${icd} sec</span>` : ""}
                   </span>`
                : ""
            const middle = middleContent || ""
            return `
                <div class="char-skill-box">
                    <div class="char-skill-header">
                        <img class="char-skill-icon" src="${src}" alt="" onerror="${_imgErrSkillIconAttr()}">
                        <div class="char-skill-name-wrap">
                            ${cdPills}
                            <span class="char-skill-name">${name || "Skill"}</span>
                        </div>
                    </div>
                    <div class="char-skill-description">${descText}</div>
                    ${middle}
                    ${detailsHtml}
                </div>
            `
        }

        function skillBar(skillKey, useBase, notes, ascension, barEnchantsText, hasEnchants, hasAscension, hasGameplayNotes, useLevel1And30) {
            const showNotes = skillKey === "normal" ? showGameplayNotesNormal : showGameplayNotesCj
            const levelLabel = useLevel1And30 ? (useBase ? "Level 30 ►" : "◄ Level 1") : (useBase ? "Max Level ►" : "◄ Base Level")
            const levelBtn = `<button type="button" class="char-skill-bar-btn char-skill-level-btn" data-skill="${skillKey}" data-level-style="${useLevel1And30 ? "1-30" : "base-max"}">${levelLabel}</button>`
            const enchantsBtn = hasEnchants ? `<button type="button" class="char-skill-bar-btn char-skill-enchants-btn" data-skill="${skillKey}">${showEnchants ? "Hide Enchants" : "Show Enchants"}</button>` : ""
            const ascensionBtn = hasAscension ? `<button type="button" class="char-skill-bar-btn char-skill-ascension-btn" data-skill="${skillKey}">${showAscension ? "Hide Ascension" : "Show Ascension"}</button>` : ""
            const gameplayNotesBtn = hasGameplayNotes ? `<button type="button" class="char-skill-bar-btn char-skill-gameplay-notes-btn" data-skill="${skillKey}">${showNotes ? "Hide Gameplay Notes" : "Show Gameplay Notes"}</button>` : ""
            const buttons = [gameplayNotesBtn, enchantsBtn, ascensionBtn, levelBtn].filter(Boolean).join("")
            const notesHtml = notes ? `<div class="char-skill-bar-note"><strong>Notes:</strong> ${notes}</div>` : ""
            const ascensionHtml = ascension ? `<div class="char-skill-bar-item"><strong>Ascension:</strong> ${ascension}</div>` : ""
            const barEnchantsHtml = barEnchantsText ? `<div class="char-skill-bar-item"><strong>Enchants:</strong> ${barEnchantsText}</div>` : ""
            const extras = [notesHtml, ascensionHtml, barEnchantsHtml].filter(Boolean).join("")
            return `<div class="char-skill-bar">${extras ? `<div class="char-skill-bar-extras">${extras}</div>` : ""}<div class="char-skill-bar-buttons">${buttons}</div></div>`
        }

        const rallyData = skillCtx.useCn
            ? (cnDescData.rally_effects?.[slug] ?? descData.rally_effects?.[slug])
            : descData.rally_effects?.[slug]
        const useInlineRally = !!charData?.rallyEffect
        let rallyHtml = ""
        if (rallyData) {
            const rallySkillAttr = charData.cjSkillAttr ?? charData.skillAttr
            const useBase = hasMcCj ? useBaseLevelCj : useBaseLevelNormal
            const rallySwapClass = useBase ? "level-base" : "level-max"

            if (!useInlineRally) {
                const rallyBase = renderSkillTaggedText(rallyData, rallySkillAttr, 0)
                const rallyMax = renderSkillTaggedText(rallyData, rallySkillAttr, 1)
                const rallyBlurb = (isCJ && hasCJ)
                    ? `<p class="char-rally-blurb">Select ${charData?.displayName ?? "this Cookie"} equipped with the Crystal Jam as leader to activate it.</p>`
                    : `<p class="char-rally-blurb">Select this Cookie as Leader to activate the following effect:</p>`
                rallyHtml = `<div class="char-skill-bubble char-rally-bubble"><div class="char-rally-top-bar"><h4 class="char-rally-header">Rally Effect</h4></div><div class="char-skill-content">${rallyBlurb}<div class="char-rally-details-box"><div class="char-skill-details-swap ${rallySwapClass}" data-level-swap="rally"><div class="char-skill-details" data-level="base">${rallyBase}</div><div class="char-skill-details" data-level="max">${rallyMax}</div></div></div></div></div>`
            }
        }
        const hasNormalRally = rallyData && !hasMcCj
        const normalSkillDetailsRaw = activeSkillDescData.skill_details?.[activeSlug]
        const normalBox = skillBox(
            charData?.skill || "Skill",
            charData?.cd ?? null,
            charData?.initialCd ?? null,
            descData.skill_description?.[slug],
            `${pic}/skills/${_urlFile(`${skillImageName}_skill.png`)}`,
            true,
            hasNormalRally ? null : normalSkillDetailsRaw,
            activeSkillAttr,
            useBaseLevelNormal ? 0 : 1,
            "normal",
            null
        )
        let normalSkillDetailsHtml = ""
        if (hasNormalRally && (normalSkillDetailsRaw || useInlineRally)) {
            const mergedDetails = (detailsText) => {
                const baseText = detailsText || ""
                if (useInlineRally && rallyData) {
                    const r = String(rallyData).trim()
                    if (r.length < 16) return baseText
                    if (baseText.includes(r)) return baseText
                    // Wiki often repeats rally in skill_details with different status{…} ids than rally_effects.
                    const normRally = (s) => String(s)
                        .replace(/status\{[^}]*\}/g, "status{}")
                        .replace(/<br\s*\/?>/gi, " ")
                        .replace(/\s+/g, " ")
                        .trim()
                    const br = normRally(r)
                    if (br.length >= 12 && normRally(baseText).includes(br)) return baseText
                    return `${baseText}${rallyData}`
                }
                return baseText
            }
            const base = renderSkillTaggedText(mergedDetails(normalSkillDetailsRaw), activeSkillAttr, 0)
            const max = renderSkillTaggedText(mergedDetails(normalSkillDetailsRaw), activeSkillAttr, 1)
            const swapClass = useBaseLevelNormal ? "level-base" : "level-max"
            normalSkillDetailsHtml = `<div class="char-skill-details-swap ${swapClass}" data-level-swap="normal" style="margin-top:16px"><div class="char-skill-details" data-level="base">${base}</div><div class="char-skill-details" data-level="max">${max}</div></div>`
        }
        // Enchants apply to Magic Candy / Crystal Jam only — same key shape as wiki import ({slug}_10 / _20 / _30).
        const normalEnchantsRaw = !hasMcCj ? buildEnchantsHtml(descData.enchants, activeSkillAttr, slug) : ""
        const normalEnchantsHtml = wrapEnchantsToggleable(normalEnchantsRaw, "normal", showEnchants)
        const normalGameplayNotesRaw = buildGameplayNotesHtml(activeSkillDescData.skill_notes, activeSkillAttr, activeSlug)
        const normalGameplayNotesHtml = wrapGameplayNotesBubble(normalGameplayNotesRaw, "normal", showGameplayNotesNormal)
        const normalBar = skillBar("normal", useBaseLevelNormal, null, null, null, !!normalEnchantsRaw, false, !!normalGameplayNotesRaw, false)
        let mcCjBox = ""
        let mcCjBar = ""
        let cjSkillDetailsHtml = ""
        let cjEnchantsHtml = ""
        let cjAscensionHtml = ""
        let gameplayNotesHtml = ""
        if (isCJ && hasCJ) {
            const cjSkillDetails = descData.skill_details?.[`${slug}_cj`]
            cjSkillDetailsHtml = cjSkillDetails
                ? (() => {
                    const base = renderSkillTaggedText(cjSkillDetails, charData?.cjSkillAttr ?? charData?.skillAttr, 0)
                    const max = renderSkillTaggedText(cjSkillDetails, charData?.cjSkillAttr ?? charData?.skillAttr, 1)
                    const swapClass = useBaseLevelCj ? "level-base" : "level-max"
                    return `<div class="char-skill-details-swap ${swapClass}" data-level-swap="cj" style="margin-top:16px"><div class="char-skill-details" data-level="base">${base}</div><div class="char-skill-details" data-level="max">${max}</div></div>`
                })()
                : ""
            const cjEnchantsSource = descData.cj_enchants && Object.keys(descData.cj_enchants).length ? descData.cj_enchants : descData.enchants
            const cjEnchantsRaw = buildEnchantsHtml(cjEnchantsSource, charData?.cjSkillAttr ?? charData?.skillAttr, slug)
            cjEnchantsHtml = wrapEnchantsToggleable(cjEnchantsRaw, "cj", showEnchants)
            const cjAscensionSource = descData.cj_ascension && Object.keys(descData.cj_ascension).length ? descData.cj_ascension : descData.ascension_effects
            const cjAscensionRaw = buildAscensionHtml(cjAscensionSource, charData?.cjSkillAttr ?? charData?.skillAttr, slug)
            cjAscensionHtml = wrapAscensionToggleable(cjAscensionRaw, "cj", showAscension)
            mcCjBox = skillBox(
                charData.cjSkill,
                charData.cjCd ?? charData.cd ?? null,
                charData.initialCjCd ?? charData.initialCd ?? null,
                descData.skill_description?.[`${slug}_cj`],
                `${pic}/skills/${_urlFile(`${skillImageName}_cj_skill.png`)}`,
                true,
                null,
                null,
                null,
                null
            )
            const cjGameplayNotesRaw = buildGameplayNotesHtml(descData.skill_notes, charData?.cjSkillAttr ?? charData?.skillAttr, `${slug}_cj`)
            gameplayNotesHtml = wrapGameplayNotesBubble(cjGameplayNotesRaw, "cj", showGameplayNotesCj)
            mcCjBar = skillBar(
                "cj",
                useBaseLevelCj,
                null,
                descData.skill_ascension?.[`${slug}_cj`],
                descData.skill_enchants?.[`${slug}_cj`],
                !!cjEnchantsRaw,
                !!cjAscensionRaw,
                !!cjGameplayNotesRaw,
                true
            )
        } else if (hasMC) {
            mcCjBox = skillBox(
                charData.mcSkill,
                charData.mcCd ?? charData.cd ?? null,
                charData.initialMcCd ?? charData.initialCd ?? null,
                descData.skill_description?.[`${slug}_mc`],
                `${pic}/skills/${_urlFile(`${skillImageName}_mc_skill.png`)}`,
                true,
                descData.skill_details?.[`${slug}_mc`],
                charData?.skillAttrMc ?? charData?.skillAttr,
                useBaseLevelCj ? 0 : 1,
                "mc"
            )
            const mcEnchantsSource = descData.cj_enchants && Object.keys(descData.cj_enchants).length ? descData.cj_enchants : descData.enchants
            const cjEnchantsRaw = buildEnchantsHtml(mcEnchantsSource, charData?.skillAttrMc ?? charData?.skillAttr, slug)
            cjEnchantsHtml = wrapEnchantsToggleable(cjEnchantsRaw, "mc", showEnchants)
            const mcAscensionSource = descData.cj_ascension && Object.keys(descData.cj_ascension).length ? descData.cj_ascension : descData.ascension_effects
            const cjAscensionRaw = buildAscensionHtml(mcAscensionSource, charData?.skillAttrMc ?? charData?.skillAttr, slug)
            cjAscensionHtml = wrapAscensionToggleable(cjAscensionRaw, "mc", showAscension)
            const mcGameplayNotesRaw = buildGameplayNotesHtml(descData.skill_notes, charData?.skillAttrMc ?? charData?.skillAttr, `${slug}_mc`)
            gameplayNotesHtml = wrapGameplayNotesBubble(mcGameplayNotesRaw, "mc", showGameplayNotesCj)
            mcCjBar = skillBar(
                "mc",
                useBaseLevelCj,
                null,
                descData.skill_ascension?.[`${slug}_mc`],
                descData.skill_enchants?.[`${slug}_mc`],
                !!cjEnchantsRaw,
                !!cjAscensionRaw,
                !!mcGameplayNotesRaw,
                true
            )
        }

        const unawakenedSkillName = (() => {
            if (!isAncientA || !slug) return ""
            const unawakenedSlug = slug.replace(/^awakened_/i, "")
            const unawakened = game?.characters?.find(c => String(c.name || "").toLowerCase() === unawakenedSlug.toLowerCase())
            return unawakened?.skill || ""
        })()
        const unawakenedSlugForIcon = isAncientA ? slug.replace(/^awakened_/i, "") : ""
        const normalDisclaimer = isAncientA
            ? `<div class="char-skill-cj-disclaimer-wrap"><div class="char-skill-cj-disclaimer">Replaces ${unawakenedSlugForIcon ? tagParser(`skill{${unawakenedSlugForIcon}}`) : ""}${unawakenedSkillName || "normal skill"}; however, level-ups are shared between the two skills.</div></div>`
            : ""
        const normalBubble = `${cnSkillDisclaimer}${normalDisclaimer}<div class="char-skill-bubble"><div class="char-skill-content">${normalBox}${!hasMcCj ? rallyHtml : ""}${normalSkillDetailsHtml}${normalEnchantsHtml}</div>${normalBar}</div>${normalGameplayNotesHtml || ""}`
        const cjDisclaimer = (isCJ && hasCJ && charData?.cjReplace)
            ? `<div class="char-skill-cj-disclaimer-wrap"><div class="char-skill-cj-disclaimer">Replaces the base skill; level-ups are not applied to the Crystal Jam skill.</div></div>`
            : ""
        const mcCjLabel = isCJ && hasCJ ? "Crystal Jam Skill" : hasMC ? "Magic Candy Skill" : ""
        const cjBubble = hasMcCj ? `<div class="char-skill-mccj-wrap"><h4 class="char-skill-mccj-header">${mcCjLabel}</h4>${cjDisclaimer}<div class="char-skill-bubble"><div class="char-skill-content">${mcCjBox}${rallyHtml}${isCJ && hasCJ ? cjSkillDetailsHtml : ""}${cjEnchantsHtml}${cjAscensionHtml}</div>${mcCjBar}</div>${gameplayNotesHtml || ""}</div>` : ""
        skillSection.innerHTML = `<div class="char-skill-section-header"><h3 class="char-section-title">Skill</h3><div class="char-section-divider"></div></div><div class="char-skill-wrapper">${normalBubble}${cjBubble}</div>`

        function updateLevelContent() {
            const rallyIsBase = hasMcCj ? useBaseLevelCj : useBaseLevelNormal
            skillSection.querySelectorAll("[data-level-swap]").forEach((wrap) => {
                const key = wrap.dataset.levelSwap
                const isBase = key === "normal" ? useBaseLevelNormal : key === "rally" ? rallyIsBase : useBaseLevelCj
                wrap.classList.toggle("level-base", isBase)
                wrap.classList.toggle("level-max", !isBase)
            })
            skillSection.querySelectorAll(".char-skill-level-btn").forEach((btn) => {
                const key = btn.dataset.skill
                const isBase = key === "normal" ? useBaseLevelNormal : useBaseLevelCj
                const use1And30 = btn.dataset.levelStyle === "1-30"
                btn.textContent = use1And30 ? (isBase ? "Level 30 ►" : "◄ Level 1") : (isBase ? "Max Level ►" : "◄ Base Level")
            })
            skillSection.querySelectorAll(".char-skill-enchants-wrap").forEach((wrap) => {
                wrap.classList.toggle("char-skill-enchants-hidden", !showEnchants)
            })
            skillSection.querySelectorAll(".char-skill-enchants-btn").forEach((btn) => {
                btn.textContent = showEnchants ? "Hide Enchants" : "Show Enchants"
            })
            skillSection.querySelectorAll(".char-skill-ascension-btn").forEach((btn) => {
                btn.textContent = showAscension ? "Hide Ascension" : "Show Ascension"
            })
            skillSection.querySelectorAll(".char-skill-ascension-wrap").forEach((wrap) => {
                wrap.classList.toggle("char-skill-ascension-hidden", !showAscension)
            })
            skillSection.querySelectorAll(".char-gameplay-notes-wrap").forEach((wrap) => {
                const key = wrap.dataset.gameplayNotesFor
                const visible = key === "normal" ? showGameplayNotesNormal : showGameplayNotesCj
                wrap.classList.toggle("char-gameplay-notes-hidden", !visible)
            })
            skillSection.querySelectorAll(".char-skill-gameplay-notes-btn").forEach((btn) => {
                const key = btn.dataset.skill
                const visible = key === "normal" ? showGameplayNotesNormal : showGameplayNotesCj
                btn.textContent = visible ? "Hide Gameplay Notes" : "Show Gameplay Notes"
            })
        }

        skillSection.querySelectorAll(".char-skill-bar-buttons button").forEach((btn) => {
            btn.addEventListener("click", () => {
                if (btn.classList.contains("char-skill-enchants-btn")) {
                    showEnchants = !showEnchants
                    updateLevelContent()
                    return
                }
                if (btn.classList.contains("char-skill-ascension-btn")) {
                    showAscension = !showAscension
                    updateLevelContent()
                    return
                }
                if (btn.classList.contains("char-skill-gameplay-notes-btn")) {
                    const key = btn.dataset.skill
                    if (key === "normal") showGameplayNotesNormal = !showGameplayNotesNormal
                    else showGameplayNotesCj = !showGameplayNotesCj
                    updateLevelContent()
                    return
                }
                const key = btn.dataset.skill
                if (key === "normal") useBaseLevelNormal = !useBaseLevelNormal
                else useBaseLevelCj = !useBaseLevelCj
                updateLevelContent()
            })
        })
    }

    renderSkillSectionContent()
    window.addEventListener("crkSettingsChanged", () => {
      renderSkillSectionContent()
      renderMcCjReviewSection(charData)
    })
    renderCharPageUpdatedLine(charData)

    function renderBuildSection() {
        const buildSection = document.getElementById("Builds")
        if (!buildSection) return
        const sets = charData?.sets
        const builds = charData?.builds && typeof charData.builds === "object" ? charData.builds : {}
        const toppingSetsList = Array.isArray(sets?.toppings) ? sets.toppings : []
        const beascuitSetsList = Array.isArray(sets?.beascuit) ? sets.beascuit : []
        const hasToppingSetsData = toppingSetsList.length > 0
        const hasBeascuitSetsData = beascuitSetsList.length > 0
        if (!hasToppingSetsData && !hasBeascuitSetsData) {
            buildSection.innerHTML = ""
            buildSection.style.display = "none"
            return
        }
        const { active: activeBuildIds, archived: archivedBuildIds } = partitionBuildIdsByActive(builds)
        const generalNotes = builds.notes
        const buildNotesRaw = charData?.buildNotes
        const generalNotesList = Array.isArray(generalNotes) ? generalNotes : (generalNotes ? [generalNotes] : [])
        const buildNotesList = Array.isArray(buildNotesRaw) ? buildNotesRaw : (buildNotesRaw ? [buildNotesRaw] : [])

        function renderBuildCardHtml(id, build) {
            if (!build || typeof build !== "object") return null
            const name = build.name || `Build ${id}`
            const rank = build.rank || ""
            const toppingsIndex = build.toppings
            if (toppingsIndex == null || !Number.isInteger(toppingsIndex) || toppingsIndex < 1) return null
            const topSet = toppingSetsList[toppingsIndex - 1]
            if (!topSet) return null
            const biscuitIndex = build.beascuit
            const biscuitSet = biscuitIndex != null && Number.isInteger(biscuitIndex) && biscuitIndex >= 1 ? beascuitSetsList[biscuitIndex - 1] : null
            const { starHtml: toppingsHtml } = buildToppingsSetBlockHtml(topSet, {
                lazyImages: true,
                substats: build.substats,
                bonusEffect: build.bonusEffect,
            })
            const toppingsDetailsHtml = buildToppingsDetailsHtml({
                substats: build.substats,
                bonusEffect: build.bonusEffect,
            })
            const { beascuitNameHtml, beascuitRowHtml } = buildBeascuitSetBlockHtml(biscuitSet, charData, { lazyImages: true })
            const useOwn = !!build.useOwn
            const cardNotes = build.notes || []
            const buildStats = build.stats || []
            const statsItems = buildStats.length
                ? buildStats.map(s => `<div class="char-build-stat"><span class="char-build-stat-name">${s.name}:</span> <span class="char-build-stat-value">${s.value}</span></div>`).join("")
                : ""
            const statsHtml = statsItems ? `<div class="char-build-stats-header-bar"><h4 class="char-build-stats-title">Stat Requirements</h4></div><div style="padding: 10px 20px;">${statsItems}</div>` : ""
            const notesItems = [...(useOwn ? [] : generalNotesList), ...cardNotes]
                .map(n => `<div class="char-build-note">${renderInlineTaggedText(n, charData?.skillAttr)}</div>`).join("")
            const notesHtml = notesItems ? `<div class="char-build-notes-header-bar"><h4 class="char-build-notes-title">Build Notes</h4></div><div style="padding: 10px 20px;">${notesItems}</div>` : ""
            const rankTitle = rank === "best" ? "Best" : rank === "recommended" ? "Recommended" : ""
            const rankIcon = rank === "best" || rank === "recommended"
                ? `<span class="char-build-rank-icon-wrap" data-tooltip="${_esc(rankTitle)}"><div class="char-build-rank-icon char-build-rank-${rank}"></div></span>`
                : ""
            return `<div class="char-build-card" data-build-id="${id}">
                <div class="char-build-name-bar"><span class="char-build-name-text">${name}</span>${rankIcon}</div>
                <div class="char-build-content">
                    <div class="char-build-toppings-col">
                        <div class="char-build-section-title">Toppings</div>
                        <div class="char-build-toppings-main">
                            ${toppingsHtml}
                            ${toppingsDetailsHtml}
                        </div>
                    </div>
                    <div class="char-build-beascuit-col">
                        <div class="char-build-section-title">Beascuit</div>
                        <div class="char-build-beascuit-main">
                            ${beascuitNameHtml || ""}
                            ${beascuitRowHtml || ""}
                        </div>
                    </div>
                </div>
                ${statsHtml ? `<div class="char-build-stats">${statsHtml}</div>` : ""}
                ${notesHtml ? `<div class="char-build-notes">${notesHtml}</div>` : ""}
            </div>`
        }

        function renderBuildCardsForIds(ids) {
            let html = ""
            let count = 0
            for (const id of ids) {
                const card = renderBuildCardHtml(id, builds[id])
                if (!card) continue
                html += card
                count += 1
            }
            return { html, count }
        }

        const activeBuildCards = renderBuildCardsForIds(activeBuildIds)
        const archivedBuildCards = renderBuildCardsForIds(archivedBuildIds)
        const buildCardCount = activeBuildCards.count + archivedBuildCards.count
        const hasValidBuilds = buildCardCount > 0

        const buildsCatalogHtml = [
            buildCatalogGroupHtml("Active", activeBuildCards.html, { cardCount: activeBuildCards.count }),
            buildCatalogGroupHtml("Archived", archivedBuildCards.html, { cardCount: archivedBuildCards.count, kind: "archived" }),
        ].filter(Boolean).join("")

        function renderToppingSetCardHtml(setIndex) {
            const topSet = toppingSetsList[setIndex - 1]
            if (!topSet) return ""
            const { starHtml } = buildToppingsSetBlockHtml(topSet, { lazyImages: true, showTart: false })
            const toppingsDetailsHtml = buildToppingsDetailsHtml({ showTart: false })
            return `<div class="char-build-card char-set-card">
                <div class="char-build-name-bar"><span class="char-build-name-text">Topping set ${setIndex}</span></div>
                <div class="char-build-content char-build-content-set-single">
                    <div class="char-build-toppings-col">
                        <div class="char-build-section-title">Toppings</div>
                        <div class="char-build-toppings-main">
                            ${starHtml}
                            ${toppingsDetailsHtml}
                        </div>
                    </div>
                </div>
            </div>`
        }

        function renderBeascuitSetCardHtml(setIndex) {
            const biscuitSet = beascuitSetsList[setIndex - 1]
            if (!biscuitSet) return ""
            const { beascuitNameHtml, beascuitRowHtml } = buildBeascuitSetBlockHtml(biscuitSet, charData, { lazyImages: true })
            return `<div class="char-build-card char-set-card">
                <div class="char-build-name-bar"><span class="char-build-name-text">Beascuit ${setIndex}</span></div>
                <div class="char-build-content char-build-content-set-single">
                    <div class="char-build-beascuit-col">
                        <div class="char-build-section-title">Beascuit</div>
                        <div class="char-build-beascuit-main">
                            ${beascuitNameHtml || ""}
                            ${beascuitRowHtml || ""}
                        </div>
                    </div>
                </div>
            </div>`
        }

        function renderSetCardsForIndices(indices, renderCard) {
            let html = ""
            for (const idx of indices) {
                html += renderCard(idx)
            }
            return html
        }

        const activeSetRefs = getSetIndicesReferencedByBuildIds(builds, activeBuildIds)
        const toppingSetParts = partitionSetIndicesByActive(toppingSetsList.length, activeSetRefs.toppings)
        const beascuitSetParts = partitionSetIndicesByActive(beascuitSetsList.length, activeSetRefs.beascuit)

        function renderSetsCatalogGroup(title, toppingIndices, beascuitIndices, kind) {
            const toppingHtml = renderSetCardsForIndices(toppingIndices, renderToppingSetCardHtml)
            const beascuitHtml = renderSetCardsForIndices(beascuitIndices, renderBeascuitSetCardHtml)
            if (!toppingHtml && !beascuitHtml) return ""
            let inner = ""
            if (toppingHtml) inner += buildSetsGridHtml("Topping sets", toppingHtml, toppingIndices.length)
            if (beascuitHtml) inner += buildSetsGridHtml("Beascuits", beascuitHtml, beascuitIndices.length)
            return `<div class="char-build-catalog-group${kind === "archived" ? " char-build-catalog-group--archived" : ""}">
                <h4 class="char-build-catalog-title">${title}</h4>
                ${inner}
            </div>`
        }

        const setsCatalogHtml = [
            renderSetsCatalogGroup("Active", toppingSetParts.active, beascuitSetParts.active),
            renderSetsCatalogGroup("Archived", toppingSetParts.archived, beascuitSetParts.archived, "archived"),
        ].filter(Boolean).join("")

        const setsPanelHtml = setsCatalogHtml
            ? `<div class="char-build-sets-panel">${setsCatalogHtml}</div>`
            : ""

        const viewMode = hasValidBuilds ? "builds" : "sets"

        const buildsPanelDisplay = viewMode === "builds" && hasValidBuilds ? "block" : "none"
        const setsPanelDisplay = viewMode === "sets" ? "block" : "none"
        const toggleButtons = `${hasValidBuilds ? `<button type="button" class="char-build-view-btn${viewMode === "builds" ? " active" : ""}" data-view="builds" aria-pressed="${viewMode === "builds"}">Builds</button>` : ""}<button type="button" class="char-build-view-btn${viewMode === "sets" ? " active" : ""}" data-view="sets" aria-pressed="${viewMode === "sets"}">Sets</button>`

        let sectionNotesHtml = ""
        if (buildNotesList.length > 0) {
            const sectionNotesItems = buildNotesList
                .map(n => `<div class="char-build-note">${renderInlineTaggedText(n, charData?.skillAttr)}</div>`).join("")
            sectionNotesHtml = `<div class="char-build-section-notes"><div class="char-build-section-notes-header-bar"><h4 class="char-build-section-notes-title">Build Notes</h4></div><div style="padding: 10px 20px;">${sectionNotesItems}</div></div>`
        }

        let html = `<div class="char-build-section-header char-build-section-header-with-toggle">
            <div class="char-build-section-heading-row">
                <h3 class="char-section-title">Builds</h3>
                <div class="char-build-view-toggle" role="tablist" aria-label="Builds or topping and beascuit sets">${toggleButtons}</div>
            </div>
            <div class="char-section-divider"></div>
        </div>
        ${sectionNotesHtml}
        <div class="char-build-panel" data-panel="builds" style="display:${buildsPanelDisplay}"><div class="char-build-catalog">${buildsCatalogHtml}</div></div>
        <div class="char-build-panel" data-panel="sets" style="display:${setsPanelDisplay}">${setsPanelHtml}</div>`
        buildSection.innerHTML = html
        buildSection.style.display = "block"
        if (typeof initToppingGraphics === "function") initToppingGraphics(buildSection)
        if (!buildSection.dataset.toppingFitBound) {
            buildSection.dataset.toppingFitBound = "1"
            buildSection.addEventListener("topping-graphic-fit", () => scheduleCharacterBuildsMasonrySync())
        }

        if (hasValidBuilds && buildsPanelDisplay === "block") {
            scheduleCharacterBuildsMasonryAfterImages(buildSection)
            syncCharacterBuildsMasonryLayout()
        }

        buildSection.querySelectorAll(".char-build-view-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const v = btn.dataset.view
                if (v === "builds" && !hasValidBuilds) return
                buildSection.querySelectorAll(".char-build-view-btn").forEach((b) => {
                    const active = b.dataset.view === v
                    b.classList.toggle("active", active)
                    b.setAttribute("aria-pressed", String(active))
                })
                buildSection.querySelectorAll(".char-build-panel").forEach((p) => {
                    p.style.display = p.dataset.panel === v ? "block" : "none"
                })
                if (typeof initToppingGraphics === "function") initToppingGraphics(buildSection)
                scheduleCharacterBuildsMasonrySync()
            })
        })

        if (/^#Builds$/i.test(location.hash || "")) {
            const buildBtn = buildSection.querySelector('.char-build-view-btn[data-view="builds"]')
            const activeBtn = buildSection.querySelector(".char-build-view-btn.active")
            if (buildBtn && activeBtn && activeBtn.dataset.view === "sets" && hasValidBuilds) {
                buildBtn.click()
            }
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (buildSection.style.display !== "none") {
                        buildSection.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                })
            })
        }
    }
    _runWhenIdle(() => renderBuildSection())

    const reviewSection = document.getElementById("char-review-section")
    if (reviewSection && (charData?.review || charData?.rating)) {
        reviewSection.innerHTML = buildCharReviewBlockHtml("Review", charData.review, charData.rating, charData?.skillAttr)
        reviewSection.style.display = "block"
    }

    renderMcCjReviewSection(charData)

    if (!characterBuildMasonryResizeBound) {
        characterBuildMasonryResizeBound = true
        window.addEventListener("resize", scheduleCharacterBuildsMasonrySync, { passive: true })
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", scheduleCharacterBuildsMasonrySync, { passive: true })
        }
        const buildsRoot = document.getElementById("Builds")
        if (buildsRoot && typeof ResizeObserver !== "undefined") {
            new ResizeObserver(() => scheduleCharacterBuildsMasonrySync()).observe(buildsRoot)
        }
    }

}

if (typeof window !== "undefined") {
  window.ensureSkillStatusCursorTip = _ensureSkillStatusCursorTip
}

if (document.getElementById("char-skill-section")) {
  if (document.getElementById("char-resonant-toppings")) {
    void loadResonantToppingsMap()
  }
  void renderCharacterPage()
}