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
    tipEl.classList.remove("is-visible")
    tipEl.textContent = ""
  }
  const offsetX = 14
  const offsetY = 18
  document.addEventListener(
    "mousemove",
    (e) => {
      const wrap = e.target && e.target.closest ? e.target.closest(".skill-status-hover-wrap") : null
      const label = wrap && wrap.dataset && wrap.dataset.statusTip ? wrap.dataset.statusTip : ""
      if (!label) {
        if (activeWrap) hide()
        return
      }
      activeWrap = wrap
      tipEl.textContent = label
      tipEl.classList.add("is-visible")
      tipEl.style.left = `${e.clientX + offsetX}px`
      tipEl.style.top = `${e.clientY + offsetY}px`
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
const _TAG_RE = /(ice|fire|status|light|dark|color|steel|darkness|poison|water|wind|grass|electricity|chaos|earth|rally|header|cookie|treasure|skill|type|position|hover)(-header)?\{([^}]*)\}/g
const _EL_ICONS = { ice: "Ice", fire: "Fire", light: "Light", dark: "Darkness", steel: "Steel", poison: "Poison", water: "Water", wind: "Wind", grass: "Grass", electricity: "Electricity", chaos: "Chaos", earth: "Earth", darkness: "Darkness" }
const _COLOR_HEADER_PREFIX = "color-header{"

/** Remaining text: standard tag{…} tokens only (no color-header — use balanced expand first). */
function _replaceStandardTags(text, pic) {
  if (!text || typeof text !== "string") return ""
  return text.replace(_TAG_RE, (_, tag, noIcon, content) => {
    if (tag === "header") return `<span class="text-tag text-bold">${_esc(content)}</span>`
    if (tag === "cookie") {
      const cookieName = content.trim()
      const href = `character.html?char=${encodeURIComponent(cookieName)}`
      return `<a class="skill-cookie-link" href="${href}"><img src="${pic}/icons/cookie/${_urlFile(`${cookieName}_head.png`)}" alt="${_esc(cookieName)}" class="skill-status-icon" onerror="${_imgErrHide}"></a>`
    }
    if (tag === "treasure") {
      const t = content.trim()
      /* Icon only in prose (teams page uses its own markup + text fallback when the asset is missing). */
      return `<img src="${pic}/treasures/${_urlFile(`Treasure_${t}.png`)}" alt="${_esc(t)}" class="skill-status-icon" onerror="${_imgErrHide}">`
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
      const mainIconName = mainId.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("_")
      let html = `<img src="${pic}/icons/status/${_urlFile(`status_${mainIconName}.png`)}" alt="${_esc(mainId)}" class="skill-status-icon" onerror="${_imgErrHide}">`
      if (overlay === "und_debuff" || overlay === "und_buff") {
        const ovName = overlay === "und_debuff" ? "Undispellable_Debuff" : "Undispellable_Buff"
        html = `<span class="skill-status-icon-wrap"><img src="${pic}/icons/status/${_urlFile(`status_${ovName}.png`)}" alt="${_esc(overlay)}" class="skill-status-icon skill-status-icon-overlay" onerror="${_imgErrHide}">${html}</span>`
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
      return `<span class="char-inline-hover" data-hover="${_esc(hoverText || visibleText)}">${_esc(visibleText)}</span>`
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
  })
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
    const isRallyHeader = /rally-header\{/.test(line)
    const isHeader = /header\{/.test(line) || forceHeaderNext
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

function getToppingImagePath(type, resonance, isTart) {
  const pic = getGamePictureRoot()
  if (isTart) return `${pic}/toppings/tart/${_urlFile(`Topping_tart_${type}_3.png`)}`
  if (resonance) {
    return `${pic}/toppings/${type}/${_urlFile(`Topping_${type}_${resonance.toLowerCase()}.png`)}`
  }
  return `${pic}/toppings/${type}/${_urlFile(`Topping_${type}_3.png`)}`
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

/** Star + substats HTML for one entry in sets.toppings */
function buildToppingsSetBlockHtml(topSet) {
  if (!topSet || typeof topSet !== "object") return { starHtml: "", substatsHtml: "" }
  const resonance = topSet.resonance
  const substats = topSet.substats || []
  const toppingSlots = []
  for (let s = 1; s <= 6; s++) {
    const type = topSet[s]
    if (!type) continue
    const isTart = s === 6
    const src = getToppingImagePath(type, isTart ? null : resonance, isTart)
    const fallbackSrc = getToppingImagePath(type, null, isTart)
    toppingSlots.push({ src, fallbackSrc, type, isTart, slot: s })
  }
  const regularToppings = toppingSlots.filter(t => !t.isTart)
  const tart = toppingSlots.find(t => t.isTart)
  let starHtml = `<div class="char-toppings-star">`
  if (tart) {
    starHtml += `<img src="${tart.src}" data-fallback-src="${tart.fallbackSrc || ""}" alt="${tart.type}" class="char-topping-tart-base" onerror="${_imgErrToppingAttr()}">`
  }
  regularToppings.forEach((t, i) => {
    starHtml += `<div class="char-topping-star-slot char-topping-pos-${i + 1}"><img src="${t.src}" data-fallback-src="${t.fallbackSrc || ""}" alt="${t.type}" class="char-topping-slot" onerror="${_imgErrToppingAttr()}"></div>`
  })
  starHtml += `</div>`
  const substatsHtml = substats.map(s => `<div class="char-build-substat">- ${s}</div>`).join("")
  return { starHtml, substatsHtml }
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
  const baseNumber = getBeascuitBaseNumber(el)
  const baseOverlay = el
    ? `<img src="${pic}/beascuit/Beascuit_base_${cookieType}_${baseNumber}.png" alt="${el} base" class="char-beascuit-base-overlay" onerror="${_imgErrHide}">`
    : ""
  const imgAlt = _esc(beascuitName || "Beascuit")
  let statsBeside = ""
  let statsOnImage = ""
  if (statsLines.length > 0) {
    if (teamsImageOverlay) {
      statsOnImage = `<div class="char-build-beascuit-stats teams-beascuit-stats-on-image" aria-label="Beascuit stats"><div class="char-build-beascuit-stats-title">Stats</div>${statsLines.map(s => `<div class="char-build-beascuit-stat">- ${s}</div>`).join("")}</div>`
    } else {
      statsBeside = `<div class="char-build-beascuit-stats"><div class="char-build-beascuit-stats-title">Stats</div>${statsLines.map(s => `<div class="char-build-beascuit-stat">- ${s}</div>`).join("")}</div>`
    }
  }
  const wrapExtraClass = teamsImageOverlay && statsOnImage ? " teams-beascuit-image-has-stats" : ""
  const beascuitImageHtml = `<div class="char-beascuit-image-wrapper${wrapExtraClass}">
    <img src="${pic}/beascuit/Beascuit_${cookieType}_legendary.png" alt="${imgAlt}" class="char-beascuit-icon" onerror="${_imgErrHide}">
    ${baseOverlay}
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

function normalizeRarity(rarity) {
  return rarity === "AncientA" ? "Ancient" : rarity
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
    if (img.complete) return
    img.addEventListener("load", scheduleCharacterBuildsMasonrySync, { once: true })
    img.addEventListener("error", scheduleCharacterBuildsMasonrySync, { once: true })
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

function syncCharacterBuildsMasonryLayout() {
  const buildSection = document.getElementById("Builds")
  if (!buildSection || isCharacterBuildSectionHidden(buildSection)) return

  const buildsPanel = buildSection.querySelector('.char-build-panel[data-panel="builds"]')
  const wrapper = buildsPanel && buildsPanel.querySelector(".char-build-section-wrapper")
  if (!wrapper || wrapper.classList.contains("char-build-section-wrapper-single")) return

  const cardCount = wrapper.querySelectorAll(".char-build-card[data-build-id]").length
  if (cardCount <= 1) return

  const wide = isBuildMasonryWideViewport()
  const buildsVisible = buildsPanel && buildsPanel.style.display !== "none"
  const hasMasonry = !!wrapper.querySelector(".char-build-masonry")

  if (!wide) {
    if (hasMasonry) flattenBuildMasonryWrapper(wrapper)
    return
  }

  if (!buildsVisible) return

  if (hasMasonry) flattenBuildMasonryWrapper(wrapper)
  applyBuildMasonryFromFlatWrapper(wrapper)
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

async function renderCharacterPage(){
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
        const rarity = normalizeRarity(rawRarity)
        const type = charData.type || ""
        const position = charData.position || ""
        const elements = Array.isArray(charData.element) ? charData.element : (charData.element ? [charData.element] : [])
        const pic = getGamePictureRoot()

        const rarityIconPath = rarity ? `${pic}/icons/${_urlFile(`${rarity}.png`)}` : ""
        const typeRow = type ? `<div class="char-stat-pill"><img src="${pic}/icons/${_urlFile(`${type}.png`)}" alt="" onerror="${_imgErrHide}"><span>${type}</span></div>` : ""
        const posRow = position ? `<div class="char-stat-pill"><img src="${pic}/icons/${_urlFile(`${position}.png`)}" alt="" onerror="${_imgErrHide}"><span>${position}</span></div>` : ""
        const elemRow = elements.length ? `<div class="char-stat-pill"><span>Element</span>${elements.map(e => `<img src="${pic}/icons/${_urlFile(`${e}.png`)}" alt="${e}" title="${e}" onerror="${_imgErrHide}">`).join("")}</div>` : ""
        infoBox.innerHTML = `
            ${rarity ? `<img class="char-rarity-icon" src="${rarityIconPath}" alt="${rarity}" title="${rarity}" onerror="${_imgErrHide}">` : ""}
            <div class="char-stats-row">
                ${typeRow}
                ${posRow}
            </div>
            ${elemRow ? `<div class="char-elements-row">${elemRow}</div>` : ""}
        `
    }

    const skillSection = document.getElementById("char-skill-section")
    if (!skillSection) return
    let useBaseLevelNormal = true
    let useBaseLevelCj = true
    let showEnchants = false
    let showAscension = false
    let showGameplayNotesNormal = false
    let showGameplayNotesCj = false

    function renderSkillSectionContent() {
        const pic = getGamePictureRoot()
        const CJ_RARITIES = ["Dragon", "Legendary", "Ancient", "Beast", "Witch"]
        const normalizedRarity = normalizeRarity(charData?.rarity || "")
        const isCJ = normalizedRarity && CJ_RARITIES.includes(normalizedRarity)
        const hasCJ = !!charData?.cjSkill
        const hasMC = !!charData?.mcSkill
        const isAncientA = charData?.rarity === "AncientA"
        const hasMcCj = (isCJ && hasCJ) || hasMC

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
                    <span class="char-skill-cd-pill" data-tooltip="Base CD"><img src="${pic}/icons/clock.png" alt="" class="char-skill-clock" onerror="${_imgErrHide}">${cooldown} sec</span>
                    ${icd ? `<span class="char-skill-cd-pill char-skill-icd-pill" data-tooltip="Initial CD"><img src="${pic}/icons/clock.png" alt="" class="char-skill-clock char-skill-clock-muted" onerror="${_imgErrHide}">${icd} sec</span>` : ""}
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

        const rallyData = descData.rally_effects?.[slug]
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
        const normalSkillDetailsRaw = descData.skill_details?.[slug]
        const normalBox = skillBox(
            charData?.skill || "Skill",
            charData?.cd ?? null,
            charData?.initialCd ?? null,
            descData.skill_description?.[slug],
            `${pic}/skills/${_urlFile(`${skillImageName}_skill.png`)}`,
            true,
            hasNormalRally ? null : normalSkillDetailsRaw,
            charData?.skillAttr,
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
            const base = renderSkillTaggedText(mergedDetails(normalSkillDetailsRaw), charData?.skillAttr, 0)
            const max = renderSkillTaggedText(mergedDetails(normalSkillDetailsRaw), charData?.skillAttr, 1)
            const swapClass = useBaseLevelNormal ? "level-base" : "level-max"
            normalSkillDetailsHtml = `<div class="char-skill-details-swap ${swapClass}" data-level-swap="normal" style="margin-top:16px"><div class="char-skill-details" data-level="base">${base}</div><div class="char-skill-details" data-level="max">${max}</div></div>`
        }
        // Enchants apply to Magic Candy / Crystal Jam only — same key shape as wiki import ({slug}_10 / _20 / _30).
        const normalEnchantsRaw = !hasMcCj ? buildEnchantsHtml(descData.enchants, charData?.skillAttr, slug) : ""
        const normalEnchantsHtml = wrapEnchantsToggleable(normalEnchantsRaw, "normal", showEnchants)
        const normalGameplayNotesRaw = buildGameplayNotesHtml(descData.skill_notes, charData?.skillAttr, slug)
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
        const normalBubble = `${normalDisclaimer}<div class="char-skill-bubble"><div class="char-skill-content">${normalBox}${!hasMcCj ? rallyHtml : ""}${normalSkillDetailsHtml}${normalEnchantsHtml}</div>${normalBar}</div>${normalGameplayNotesHtml || ""}`
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
        const buildIds = Object.keys(builds).filter(k => k !== "notes")
        const generalNotes = builds.notes
        const buildNotes = charData?.buildNotes || []
        let cardsHtml = ""
        let buildCardCount = 0
        let hasValidBuilds = false
        for (const id of buildIds) {
            const build = builds[id]
            if (!build || typeof build !== "object") continue
            const name = build.name || `Build ${id}`
            const rank = build.rank || ""
            const toppingsIndex = build.toppings
            if (toppingsIndex == null || !Number.isInteger(toppingsIndex) || toppingsIndex < 1) continue
            const topSet = toppingSetsList[toppingsIndex - 1]
            if (!topSet) continue
            const biscuitIndex = build.beascuit
            const biscuitSet = biscuitIndex != null && Number.isInteger(biscuitIndex) && biscuitIndex >= 1 ? beascuitSetsList[biscuitIndex - 1] : null
            const { starHtml: toppingsHtml, substatsHtml } = buildToppingsSetBlockHtml(topSet)
            const { beascuitNameHtml, beascuitRowHtml } = buildBeascuitSetBlockHtml(biscuitSet, charData)
            const buildNotes = build.notes || []
            const useOwn = !!build.useOwn
            const buildStats = build.stats || []
            const statsItems = buildStats.length
                ? buildStats.map(s => `<div class="char-build-stat"><span class="char-build-stat-name">${s.name}:</span> <span class="char-build-stat-value">${s.value}</span></div>`).join("")
                : ""
            const statsHtml = statsItems ? `<div class="char-build-stats-header-bar"><h4 class="char-build-stats-title">Stat Requirements</h4></div><div style="padding: 10px 20px;">${statsItems}</div>` : ""
            const notesItems = [...(useOwn ? [] : (generalNotes || [])), ...buildNotes]
                .map(n => `<div class="char-build-note">${renderInlineTaggedText(n, charData?.skillAttr)}</div>`).join("")
            const notesHtml = notesItems ? `<div class="char-build-notes-header-bar"><h4 class="char-build-notes-title">Build Notes</h4></div><div style="padding: 10px 20px;">${notesItems}</div>` : ""
            const rankTitle = rank === "best" ? "Best" : rank === "recommended" ? "Recommended" : ""
            const rankIcon = rank === "best" || rank === "recommended"
                ? `<span class="char-build-rank-icon-wrap" data-tooltip="${_esc(rankTitle)}"><div class="char-build-rank-icon char-build-rank-${rank}"></div></span>`
                : ""
            cardsHtml += `<div class="char-build-card" data-build-id="${id}">
                <div class="char-build-name-bar"><span class="char-build-name-text">${name}</span>${rankIcon}</div>
                <div class="char-build-content">
                    <div class="char-build-toppings-col">
                        <div class="char-build-section-title">Toppings</div>
                        <div class="char-build-toppings-main">
                            ${toppingsHtml}
                            ${substatsHtml ? `<div class="char-build-substats"><div class="char-build-substats-title">Substats</div>${substatsHtml}</div>` : ""}
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
            buildCardCount += 1
            hasValidBuilds = true
        }
        const wrapperSingleClass = buildCardCount === 1 ? " char-build-section-wrapper-single" : ""

        let toppingSetCardsHtml = ""
        toppingSetsList.forEach((topSet, i) => {
            const { starHtml, substatsHtml } = buildToppingsSetBlockHtml(topSet)
            toppingSetCardsHtml += `<div class="char-build-card char-set-card">
                <div class="char-build-name-bar"><span class="char-build-name-text">Topping set ${i + 1}</span></div>
                <div class="char-build-content char-build-content-set-single">
                    <div class="char-build-toppings-col">
                        <div class="char-build-section-title">Toppings</div>
                        <div class="char-build-toppings-main">
                            ${starHtml}
                            ${substatsHtml ? `<div class="char-build-substats"><div class="char-build-substats-title">Substats</div>${substatsHtml}</div>` : ""}
                        </div>
                    </div>
                </div>
            </div>`
        })

        let beascuitSetCardsHtml = ""
        beascuitSetsList.forEach((biscuitSet, i) => {
            const { beascuitNameHtml, beascuitRowHtml } = buildBeascuitSetBlockHtml(biscuitSet, charData)
            beascuitSetCardsHtml += `<div class="char-build-card char-set-card">
                <div class="char-build-name-bar"><span class="char-build-name-text">Beascuit ${i + 1}</span></div>
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
        })

        const toppingSetsWrapperClass = toppingSetsList.length === 1 ? " char-build-sets-wrapper-single" : ""
        const beascuitSetsWrapperClass = beascuitSetsList.length === 1 ? " char-build-sets-wrapper-single" : ""
        const setsPanelHtml = `<div class="char-build-sets-panel">${hasToppingSetsData ? `<h4 class="char-sets-subsection-title">Topping sets</h4><div class="char-build-sets-wrapper${toppingSetsWrapperClass}">${toppingSetCardsHtml}</div>` : ""}${hasBeascuitSetsData ? `<h4 class="char-sets-subsection-title">Beascuits</h4><div class="char-build-sets-wrapper${beascuitSetsWrapperClass}">${beascuitSetCardsHtml}</div>` : ""}</div>`

        const viewMode = hasValidBuilds ? "builds" : "sets"

        const buildsPanelDisplay = viewMode === "builds" && hasValidBuilds ? "block" : "none"
        const setsPanelDisplay = viewMode === "sets" ? "block" : "none"
        const toggleButtons = `${hasValidBuilds ? `<button type="button" class="char-build-view-btn${viewMode === "builds" ? " active" : ""}" data-view="builds" aria-pressed="${viewMode === "builds"}">Builds</button>` : ""}<button type="button" class="char-build-view-btn${viewMode === "sets" ? " active" : ""}" data-view="sets" aria-pressed="${viewMode === "sets"}">Sets</button>`

        let sectionNotesHtml = ""
        if (buildNotes.length > 0) {
            const sectionNotesItems = buildNotes.map(n => `<div class="char-build-note">${renderInlineTaggedText(n, charData?.skillAttr)}</div>`).join("")
            sectionNotesHtml = `<div class="char-build-section-notes"><div class="char-build-section-notes-header-bar"><h4 class="char-build-section-notes-title">Additional Notes</h4></div><div style="padding: 10px 20px;">${sectionNotesItems}</div></div>`
        }

        let html = `<div class="char-build-section-header char-build-section-header-with-toggle">
            <div class="char-build-section-heading-row">
                <h3 class="char-section-title">Builds</h3>
                <div class="char-build-view-toggle" role="tablist" aria-label="Builds or topping and beascuit sets">${toggleButtons}</div>
            </div>
            <div class="char-section-divider"></div>
        </div>
        <div class="char-build-panel" data-panel="builds" style="display:${buildsPanelDisplay}"><div class="char-build-section-wrapper${wrapperSingleClass}">${cardsHtml}</div>${sectionNotesHtml}</div>
        <div class="char-build-panel" data-panel="sets" style="display:${setsPanelDisplay}">${setsPanelHtml}</div>`
        buildSection.innerHTML = html
        buildSection.style.display = "block"

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
    renderBuildSection()

    const reviewSection = document.getElementById("char-review-section")
    if (reviewSection && (charData?.review || charData?.rating)) {
        const ratingHtml = charData.rating
            ? `<div class="char-review-rating" data-rating="${charData.rating}">
                   <span class="char-review-rating-label">Rating</span>
                   <span class="char-review-rating-letter">${charData.rating}</span>
               </div>`
            : ""
        const bodyHtml = charData.review
            ? `<div class="char-review-body">${renderInlineTaggedText(charData.review, charData?.skillAttr)}</div>`
            : ""
        reviewSection.innerHTML = `
            <div class="char-review-header-bar">
                <h3 class="char-section-title">Review</h3>
            </div>
            <div class="char-section-divider"></div>
            <div class="char-review-content">${bodyHtml}${ratingHtml}</div>
        `
        reviewSection.style.display = "block"
    }

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

if (document.getElementById("char-skill-section")) {
  void renderCharacterPage()
}