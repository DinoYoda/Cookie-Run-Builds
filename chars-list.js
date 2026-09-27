let allChars = []
let activeFilters = {}
let searchText = ""
let cookieSearchAliasMap = {}
let sortMode = "rarity"
let sortReverse = false
let sortByMcCj = false
let currentGameId = "crk"
let currentListGame = null

function listPictureRoot() {
  if (!currentListGame) return "crk/pictures"
  const folder = currentListGame.assetsBase != null ? currentListGame.assetsBase : currentListGame.id
  return `${folder}/pictures`
}

function cardImageFilename(gameId, name, game) {
  const n = name || ""
  if (typeof game?.cardImageFilename === "function") {
    return game.cardImageFilename(n)
  }
  if (gameId === "toa") {
    return `${n}_Cookie_Profile_Icon.png`
  }
  if (gameId === "crc") {
    return `${n}_card.png`
  }
  return `Cookie_${String(n).toLowerCase()}_card.png`
}

function characterPageHref(name) {
  const page = currentListGame?.characterPage ?? (currentListGame?.id === "crk" ? "crk/character.html" : null)
  if (!page || !name) return null
  return `${page}?char=${encodeURIComponent(name)}`
}

function readUIState() {
  try {
    return JSON.parse(localStorage.getItem("tierlistUIState") || "{}")
  } catch {
    return {}
  }
}

function writeUIState(partial) {
  localStorage.setItem("tierlistUIState", JSON.stringify({ ...readUIState(), ...partial }))
}

function getSelectedGameId() {
  const s = readUIState()
  if (s.game && typeof s.game === "string") return s.game
  return "crk"
}

function sortInGameOrder() {
  return typeof getSortInGameOrder === "function" && getSortInGameOrder()
}

function activeRarityOrder() {
  const useGameOrder = sortInGameOrder()
  if (typeof rarityOrderForGame === "function") {
    return rarityOrderForGame(currentListGame, useGameOrder)
  }
  return useGameOrder ? gameRarityOrder : siteRarityOrder
}

const SORT_OPTIONS = [
  { value: "rarity", label: "Rarity" },
  { value: "release", label: "Release" },
  { value: "alpha", label: "A–Z" }
]

function restoreCharlistSortFromStorage() {
  const s = readUIState()
  if (s.charlistSortMode && SORT_OPTIONS.some(o => o.value === s.charlistSortMode)) {
    sortMode = s.charlistSortMode
  }
  sortReverse = s.charlistSortReverse === true
  const dirBtn = document.getElementById("charlistSortDir")
  if (dirBtn) dirBtn.textContent = sortReverse ? "↑" : "↓"
}

restoreCharlistSortFromStorage()

/**
 * Floating cursor tooltip (same element + styling as skill status icons in crk/char-ui.js).
 */
function initCharlistCursorTips() {
  if (typeof document === "undefined") return
  if (!document.querySelector(".charlist-mccj-label[data-tooltip]")) return
  let tipEl = document.getElementById("skill-status-cursor-tip")
  if (!tipEl) {
    tipEl = document.createElement("div")
    tipEl.id = "skill-status-cursor-tip"
    tipEl.className = "skill-status-cursor-tip"
    tipEl.setAttribute("aria-hidden", "true")
    document.body.appendChild(tipEl)
  }
  let active = false
  const hide = () => {
    active = false
    tipEl.classList.remove("is-visible", "skill-status-cursor-tip--wrap")
    tipEl.textContent = ""
  }
  const offsetX = 14
  const offsetY = 18
  const positionTip = (clientX, clientY) => {
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
  document.addEventListener(
    "mousemove",
    (e) => {
      const el = e.target && e.target.closest && e.target.closest(".charlist-mccj-label[data-tooltip]")
      const text = el && el.getAttribute("data-tooltip")
      if (!text) {
        if (active) hide()
        return
      }
      active = true
      tipEl.textContent = text
      tipEl.classList.add("is-visible", "skill-status-cursor-tip--wrap")
      positionTip(e.clientX, e.clientY)
    },
    true
  )
  document.addEventListener("scroll", () => { if (active) hide() }, true)
}

function syncCharlistSortUI() {
  const opt = SORT_OPTIONS.find(o => o.value === sortMode)
  const lbl = document.getElementById("charlistSortLabel")
  const panel = document.getElementById("charlistSortPanel")
  if (lbl) lbl.textContent = opt ? opt.label : sortMode
  if (panel) {
    panel.querySelectorAll(".select-expand-option").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.value === sortMode)
    })
  }
}

function initCharlistSortExpand() {
  const expand = document.getElementById("charlistSortExpand")
  const trigger = document.getElementById("charlistSortTrigger")
  const panel = document.getElementById("charlistSortPanel")
  if (!expand || !trigger || !panel) return

  SORT_OPTIONS.forEach(o => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "select-expand-option"
    btn.dataset.value = o.value
    btn.textContent = o.label
    btn.setAttribute("role", "option")
    btn.addEventListener("click", e => {
      e.stopPropagation()
      expand.classList.remove("is-open")
      panel.hidden = true
      trigger.setAttribute("aria-expanded", "false")
      sortMode = o.value
      writeUIState({ charlistSortMode: sortMode })
      syncCharlistSortUI()
      render()
    })
    panel.appendChild(btn)
  })

  trigger.addEventListener("click", e => {
    e.stopPropagation()
    const opening = !expand.classList.contains("is-open")
    document.querySelectorAll(".select-expand.is-open").forEach(root => {
      root.classList.remove("is-open")
      const t = root.querySelector(".select-expand-trigger")
      const p = root.querySelector(".select-expand-panel")
      if (t) t.setAttribute("aria-expanded", "false")
      if (p) p.hidden = true
    })
    if (opening) {
      expand.classList.add("is-open")
      panel.hidden = false
      trigger.setAttribute("aria-expanded", "true")
    }
  })

  syncCharlistSortUI()
}

function hasMcCj(c) {
  const mc = !!c?.mcSkill
  return !!(c?.cjSkill || mc)
}

function mcCjFirstActive() {
  return sortMode === "rarity" && (sortByMcCj || sortInGameOrder())
}

function syncCharlistMcCjCheckbox() {
  const mccjCb = document.getElementById("charlistMcCj")
  if (!mccjCb) return
  const forced = sortInGameOrder()
  if (forced) {
    sortByMcCj = true
    mccjCb.checked = true
    mccjCb.disabled = true
  } else {
    mccjCb.disabled = false
    sortByMcCj = readUIState().charlistSortByMcCj === true
    mccjCb.checked = sortByMcCj
  }
}

function charlistSynergyBadgesHtml(c, pic) {
  if (!synergyFilterActive()) return ""
  const selected = activeFilters.synergy || []
  const syn = Array.isArray(c.synergy) ? c.synergy : []
  const matching = syn.filter(s => selected.includes(s?.type))
  if (!matching.length) return ""
  const badge = typeof crcSynergyBadgeHtml === "function" ? crcSynergyBadgeHtml : null
  if (!badge) return ""
  const badges = matching.map(s =>
    badge(s.type, s.recipient ? "received" : "granted", pic)
  ).join("")
  return `<div class="charlist-card-synergy-badges">${badges}</div>`
}

function charlistCardIconsHtml(c, pic) {
  const parts = []
  if (c.mcSkill) {
    parts.push(
      `<img src="${pic}/candy/${c.name}_mc_lv3.png" alt="Magic Candy" title="Magic Candy" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display='none'">`
    )
  }
  if (c.cjSkill) {
    parts.push(
      `<img src="${pic}/jam/${c.name}_mc_lv3.png" alt="Crystal Jam" title="Crystal Jam" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display='none'">`
    )
  }
  const role = c.role || c.type
  const synergyBadges = charlistSynergyBadgesHtml(c, pic)
  if (role || synergyBadges) {
    const roleImg = role
      ? `<img src="${pic}/icons/${role}.png" alt="${role}" title="${role}" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display='none'">`
      : ""
    parts.push(
      synergyBadges
        ? `<div class="charlist-card-role-stack">${roleImg}${synergyBadges}</div>`
        : roleImg
    )
  }
  if (!parts.length) return ""
  return `<div class="charlist-card-icons">${parts.join("")}</div>`
}

/** Within the same rarity, CN-exclusive cookies sort after global-release cookies (unknown CN dates). */
function cnExSortRank(c) {
  return c && c.cnEx === true ? 1 : 0
}

function rarityFiltersAreSquare(game) {
  if (!game) return false
  if (game.rarityIconShape === "square") return true
  if (game.rarityIconShape === "wide") return false
  return game.id === "crc"
}

function cardImageShapeIsThumbnail(game) {
  if (!game) return false
  return game.cardImageShape === "thumbnail" || game.id === "crc"
}

function filterGroupClass(cat) {
  if (cat === "rarity" && !rarityFiltersAreSquare(currentListGame)) {
    return "filter-group filter-group--rarity"
  }
  return "filter-group filter-group--square"
}

function synergyFilterActive() {
  return currentGameId === "crc" && Array.isArray(activeFilters.synergy) && activeFilters.synergy.length > 0
}

function toggleFilterValue(cat, v, btn) {
  if (!activeFilters[cat]) activeFilters[cat] = []
  const i = activeFilters[cat].indexOf(v)
  if (i > -1) {
    activeFilters[cat].splice(i, 1)
    btn.classList.remove("active")
    if (activeFilters[cat].length === 0) delete activeFilters[cat]
  } else {
    activeFilters[cat].push(v)
    btn.classList.add("active")
  }
  render()
}

function buildSynergyFilterGroup(wrap, vals) {
  const g = document.createElement("div")
  g.className = "filter-group filter-group--synergy"
  vals.forEach(v => {
    if (v === undefined) return
    const btn = document.createElement("button")
    btn.className = "filter-icon-btn"
    btn.dataset.category = "synergy"
    btn.dataset.value = v
    btn.title = v
    const slug = typeof crcSynergyIconSlug === "function" ? crcSynergyIconSlug(v) : null
    if (slug) {
      btn.innerHTML = `<img src="${listPictureRoot()}/synergies/${slug}.webp" alt="${v}">`
    } else {
      btn.textContent = v
    }
    btn.onclick = () => toggleFilterValue("synergy", v, btn)
    g.appendChild(btn)
  })
  wrap.appendChild(g)
}

function buildFilters(filters) {
  const wrap = document.getElementById("charlistFilters")
  Object.entries(filters).forEach(([cat, vals]) => {
    if (cat === "synergy") {
      buildSynergyFilterGroup(wrap, vals)
      return
    }
    const g = document.createElement("div")
    g.className = filterGroupClass(cat)
    vals.forEach(v => {
      if (v === undefined) return
      const displayValue = v == null ? "None" : v
      const iconValue = v == null ? "null" : v
      const btn = document.createElement("button")
      const squareRarity = cat === "rarity" && rarityFiltersAreSquare(currentListGame)
      btn.className = cat === "rarity" && !squareRarity ? "filter-icon-btn filter-rarity-btn" : "filter-icon-btn"
      btn.dataset.category = cat
      btn.dataset.value = iconValue
      btn.title = displayValue
      btn.innerHTML = `<img src="${listPictureRoot()}/icons/${iconValue}.png" alt="${displayValue}">`
      btn.onclick = () => toggleFilterValue(cat, v, btn)
      g.appendChild(btn)
    })
    wrap.appendChild(g)
  })
}

function loadCharListForCurrentGame() {
  const d = window.CRK_DATA || {}
  currentGameId = getSelectedGameId()
  restoreCharlistSortFromStorage()
  const game = d.games && d.games.find(g => g.id === currentGameId)
  currentListGame = game || null
  const wrap = document.getElementById("charlistFilters")
  if (wrap) wrap.innerHTML = ""
  activeFilters = {}
  const raw = game?.characters || []
  allChars = raw.filter(c => {
    if (!c || !c.name) return false
    if (c.chars === false) return false
    if (typeof characterPassesCnExFilter === "function" && !characterPassesCnExFilter(c)) return false
    if (typeof characterPassesBetaFilter === "function" && !characterPassesBetaFilter(c)) return false
    return true
  })
  const filters = game?.tierlists?.find(t => t.filters && Object.keys(t.filters).length)?.filters || {}
  buildFilters(filters)
  const titleEl = document.querySelector(".charlist-title")
  if (titleEl) {
    titleEl.textContent = game?.listLabel || (game?.id === "crk" ? "Cookies" : "Characters")
  }
  const mccjLabel = document.querySelector(".charlist-mccj-label")
  const mccjCb = document.getElementById("charlistMcCj")
  if (mccjLabel && mccjCb) {
    const anyMcCj = currentGameId === "crk" && allChars.some(hasMcCj)
    mccjLabel.style.display = anyMcCj ? "" : "none"
    if (!anyMcCj) {
      sortByMcCj = false
      mccjCb.checked = false
      mccjCb.disabled = false
    } else {
      syncCharlistMcCjCheckbox()
    }
  }
  syncCharlistSortUI()
  refreshCookieSearchAliases(() => render())
}

function refreshCookieSearchAliases(onReady) {
  const CSA = typeof CookieSearchAliases !== "undefined" ? CookieSearchAliases : null
  if (!CSA) {
    cookieSearchAliasMap = {}
    if (onReady) onReady()
    return
  }
  cookieSearchAliasMap = CSA.buildAliasMap(allChars)
  CSA.loadStoredCookieAliases(CSA.siteRelativePath("tools")).then((stored) => {
    cookieSearchAliasMap = CSA.buildAliasMap(allChars, stored)
    if (onReady) onReady()
  })
}

function applyFilters(c) {
  if (searchText) {
    const CSA = typeof CookieSearchAliases !== "undefined" ? CookieSearchAliases : null
    if (CSA) {
      if (!CSA.cookieMatchesSearch(c, searchText, cookieSearchAliasMap)) return false
    } else {
      const s = ((c.displayName || c.name) + " " + c.name).toLowerCase()
      if (!s.includes(searchText)) return false
    }
  }
  for (const [cat, vals] of Object.entries(activeFilters)) {
    if (cat === "synergy") {
      if (typeof crcCookieHasSynergyTypes === "function") {
        if (!crcCookieHasSynergyTypes(c, vals)) return false
      } else {
        const syn = Array.isArray(c.synergy) ? c.synergy : []
        if (!syn.some(s => vals.includes(s.type))) return false
      }
      continue
    }
    const cv = c[cat]
    if (Array.isArray(cv)) {
      if (!cv.some(v => vals.includes(v))) return false
    } else {
      let passes = vals.includes(cv)
      if (cat === "rarity" && !passes && vals.includes("Ancient") && cv === "AncientA") passes = true
      if (cat === "rarity" && !passes && vals.includes("Legendary") && cv === "New Legendary") passes = true
      if (cat === "rarity" && !passes && vals.includes("Dragon") && cv === "New Dragon") passes = true
      if (cat === "rarity" && !passes && vals.includes("Special") && cv === "Zhencang") passes = true
      if (!passes) return false
    }
  }
  return true
}

document.getElementById("charlistSearch").addEventListener("input", e => {
  searchText = e.target.value.toLowerCase()
  render()
})
document.getElementById("charlistReset").addEventListener("click", () => {
  activeFilters = {}
  searchText = ""
  sortMode = "rarity"
  sortReverse = false
  sortByMcCj = false
  writeUIState({ charlistSortByMcCj: false, charlistSortMode: "rarity", charlistSortReverse: false })
  document.getElementById("charlistSearch").value = ""
  const csr = document.getElementById("charlistSortExpand")
  const cst = document.getElementById("charlistSortTrigger")
  const csp = document.getElementById("charlistSortPanel")
  if (csr) csr.classList.remove("is-open")
  if (cst) cst.setAttribute("aria-expanded", "false")
  if (csp) csp.hidden = true
  syncCharlistSortUI()
  document.getElementById("charlistSortDir").textContent = "↓"
  syncCharlistMcCjCheckbox()
  document.querySelectorAll("#charlistFilters .filter-icon-btn").forEach(b => b.classList.remove("active"))
  render()
})
document.getElementById("charlistMcCj").addEventListener("change", e => {
  if (sortInGameOrder()) {
    e.target.checked = true
    return
  }
  sortByMcCj = e.target.checked
  writeUIState({ charlistSortByMcCj: sortByMcCj })
  render()
})
const dirBtn = document.getElementById("charlistSortDir")
if (dirBtn) {
  dirBtn.addEventListener("click", () => {
    sortReverse = !sortReverse
    dirBtn.textContent = sortReverse ? "↑" : "↓"
    writeUIState({ charlistSortReverse: sortReverse })
    render()
  })
}

function render() {
  const grid = document.getElementById("charlistGrid")
  const ri = r => {
    const band = raritySortBand(r, sortInGameOrder())
    const i = activeRarityOrder().indexOf(band)
    return i < 0 ? 999 : i
  }
  const releaseOrder = typeof cookieReleaseOrderForGame === "function"
    ? cookieReleaseOrderForGame(currentGameId)
    : cookieReleaseOrder
  const rel = c => {
    const i = releaseOrder.indexOf(c.displayName ?? c.name)
    return i < 0 ? 9999 : i
  }
  const chars = allChars.filter(applyFilters).sort((a, b) => {
    if (synergyFilterActive() && typeof crcSynergyGrantRank === "function") {
      const synTypes = activeFilters.synergy
      const grantCmp = crcSynergyGrantRank(a, synTypes) - crcSynergyGrantRank(b, synTypes)
      if (grantCmp !== 0) return sortReverse ? -grantCmp : grantCmp
    }
    const useMcCj = mcCjFirstActive()
    const cjFirst = (x, y) => (hasMcCj(x) ? 0 : 1) - (hasMcCj(y) ? 0 : 1)
    let v
    if (sortMode === "alpha") v = (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name)
    else if (sortMode === "release") {
      v = rel(b) - rel(a)
      if (v === 0) v = cnExSortRank(a) - cnExSortRank(b)
    }
    else {
      const rd = ri(a.rarity) - ri(b.rarity)
      if (rd !== 0) v = rd
      else {
        const xd = cnExSortRank(a) - cnExSortRank(b)
        v = xd !== 0 ? xd : useMcCj && cjFirst(a, b) !== 0 ? cjFirst(a, b) : rel(b) - rel(a)
      }
    }
    return sortReverse ? -v : v
  })
  const counter = document.getElementById("charlistCounter")
  if (counter) {
    const noun = currentListGame?.listLabel
      ? currentListGame.listLabel.toLowerCase().replace(/s$/, "")
      : (currentGameId === "crk" ? "cookie" : "character")
    counter.textContent = `Showing ${chars.length} ${noun}${chars.length === 1 ? "" : "s"}`
  }
  grid.innerHTML = chars.map(cardHtml).join("")
}

function initCharlistGridNavigation() {
  const grid = document.getElementById("charlistGrid")
  if (!grid || grid.dataset.navBound === "1") return
  grid.dataset.navBound = "1"
  grid.addEventListener("click", e => {
    const card = e.target.closest(".charlist-card")
    if (!card?.dataset.name) return
    const href = characterPageHref(card.dataset.name)
    if (href) window.location.href = href
  })
}

function cardHtml(c) {
  const n = c.name, dn = c.displayName || n
  const pic = listPictureRoot()
  const cardPath = `${pic}/cards/${cardImageFilename(currentListGame?.id, n, currentListGame)}`
  const useThumbnail = cardImageShapeIsThumbnail(currentListGame)
  const cardClass = useThumbnail ? " charlist-card--thumbnail" : ""
  const imgHtml = `<img class="charlist-card-img" src="${cardPath}" alt="${dn}" loading="lazy" decoding="async" onerror="this.onerror=null;if(this.src.indexOf('null.png')===-1){this.src='${pic}/icons/null.png'}else{this.style.display='none'}">`
  const iconsHtml = charlistCardIconsHtml(c, pic)
  const portraitHtml = useThumbnail && typeof crcCardPortraitWrap === "function"
    ? crcCardPortraitWrap(imgHtml, c.rarity, iconsHtml)
    : imgHtml
  return `<div class="charlist-card${cardClass}" data-name="${n}">
    <div class="charlist-card-img-wrap">
      ${portraitHtml}
      ${useThumbnail ? "" : iconsHtml}
    </div>
    <div class="charlist-card-info">
      <div class="charlist-card-name">${dn}</div>
    </div>
  </div>`
}

document.addEventListener("click", () => {
  document.querySelectorAll(".select-expand.is-open").forEach(root => {
    root.classList.remove("is-open")
    const trig = root.querySelector(".select-expand-trigger")
    const pan = root.querySelector(".select-expand-panel")
    if (trig) trig.setAttribute("aria-expanded", "false")
    if (pan) pan.hidden = true
  })
})
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return
  document.querySelectorAll(".select-expand.is-open").forEach(root => {
    root.classList.remove("is-open")
    const trig = root.querySelector(".select-expand-trigger")
    const pan = root.querySelector(".select-expand-panel")
    if (trig) trig.setAttribute("aria-expanded", "false")
    if (pan) pan.hidden = true
  })
})

initCharlistCursorTips()
initCharlistSortExpand()
initCharlistGridNavigation()

function startCharListApp() {
  loadCharListForCurrentGame()
}

if (typeof whenGamesReady === "function") whenGamesReady(startCharListApp)
else startCharListApp()

window.addEventListener("crkSettingsChanged", () => loadCharListForCurrentGame())
