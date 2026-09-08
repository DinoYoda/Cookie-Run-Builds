let allChars = []
let activeFilters = {}
let searchText = ""
let cookieSearchAliasMap = {}
let sortMode = "release"
let sortReverse = false
let sortByMcCj = false
let currentGameId = "crk"
let currentListGame = null

function listPictureRoot() {
  if (!currentListGame) return "crk/pictures"
  const folder = currentListGame.assetsBase != null ? currentListGame.assetsBase : currentListGame.id
  return `${folder}/pictures`
}

function cardImageFilename(gameId, name) {
  const n = name || ""
  if (gameId === "toa") {
    return `${n}_Cookie_Profile_Icon.png`
  }
  return `Cookie_${String(n).toLowerCase()}_card.png`
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
  return sortInGameOrder() ? gameRarityOrder : siteRarityOrder
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
  const mc = typeof shouldRenderMcSkill === "function" ? shouldRenderMcSkill(c) : !!c?.mcSkill
  return !!(c?.cjSkill || mc)
}

function charlistCardIconsHtml(c, pic) {
  const parts = []
  if (typeof shouldRenderMcSkill === "function" ? shouldRenderMcSkill(c) : c.mcSkill) {
    parts.push(
      `<img src="${pic}/candy/${c.name}_mc_lv3.png" alt="Magic Candy" title="Magic Candy" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display='none'">`
    )
  }
  if (c.cjSkill) {
    parts.push(
      `<img src="${pic}/jam/${c.name}_mc_lv3.png" alt="Crystal Jam" title="Crystal Jam" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display='none'">`
    )
  }
  if (c.type) {
    parts.push(
      `<img src="${pic}/icons/${c.type}.png" alt="${c.type}" title="${c.type}" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display='none'">`
    )
  }
  if (!parts.length) return ""
  return `<div class="charlist-card-icons">${parts.join("")}</div>`
}

/** Within the same rarity, CN-exclusive cookies sort after global-release cookies (unknown CN dates). */
function cnExSortRank(c) {
  return c && c.cnEx === true ? 1 : 0
}

function buildFilters(filters) {
  const wrap = document.getElementById("charlistFilters")
  Object.entries(filters).forEach(([cat, vals]) => {
    const g = document.createElement("div")
    g.className = "filter-group"
    vals.forEach(v => {
      if (v === undefined) return
      const displayValue = v == null ? "None" : v
      const iconValue = v == null ? "null" : v
      const btn = document.createElement("button")
      btn.className = "filter-icon-btn"
      btn.dataset.category = cat
      btn.dataset.value = iconValue
      btn.title = displayValue
      btn.innerHTML = `<img src="${listPictureRoot()}/icons/${iconValue}.png" alt="${displayValue}">`
      btn.onclick = () => {
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
    if (typeof characterPassesCnExFilter === "function" && !characterPassesCnExFilter(c)) return false
    if (typeof characterPassesBetaFilter === "function" && !characterPassesBetaFilter(c)) return false
    return true
  })
  const filters = game?.tierlists?.find(t => t.filters && Object.keys(t.filters).length)?.filters || {}
  buildFilters(filters)
  const titleEl = document.querySelector(".charlist-title")
  if (titleEl) {
    titleEl.textContent = game?.id === "crk" ? "Cookies" : "Characters"
  }
  const mccjLabel = document.querySelector(".charlist-mccj-label")
  const mccjCb = document.getElementById("charlistMcCj")
  if (mccjLabel && mccjCb) {
    const anyMcCj = allChars.some(hasMcCj)
    mccjLabel.style.display = anyMcCj ? "" : "none"
    if (!anyMcCj) {
      sortByMcCj = false
      mccjCb.checked = false
    } else {
      sortByMcCj = readUIState().charlistSortByMcCj === true
      mccjCb.checked = sortByMcCj
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
  sortMode = "release"
  sortReverse = false
  sortByMcCj = false
  writeUIState({ charlistSortByMcCj: false, charlistSortMode: "release", charlistSortReverse: false })
  document.getElementById("charlistSearch").value = ""
  const csr = document.getElementById("charlistSortExpand")
  const cst = document.getElementById("charlistSortTrigger")
  const csp = document.getElementById("charlistSortPanel")
  if (csr) csr.classList.remove("is-open")
  if (cst) cst.setAttribute("aria-expanded", "false")
  if (csp) csp.hidden = true
  syncCharlistSortUI()
  document.getElementById("charlistSortDir").textContent = "↓"
  const cb = document.getElementById("charlistMcCj")
  if (cb) cb.checked = false
  document.querySelectorAll("#charlistFilters .filter-icon-btn").forEach(b => b.classList.remove("active"))
  render()
})
document.getElementById("charlistMcCj").addEventListener("change", e => {
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
  const rel = c => { const i = cookieByDate.indexOf(c.displayName ?? c.name); return i < 0 ? 9999 : i }
  const chars = allChars.filter(applyFilters).sort((a, b) => {
    const useMcCj = sortMode === "rarity" && sortByMcCj
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
    const noun = currentGameId === "crk" ? "cookie" : "character"
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
    window.location.href = `crk/character.html?char=${encodeURIComponent(card.dataset.name)}`
  })
}

function cardHtml(c) {
  const n = c.name, dn = c.displayName || n
  const pic = listPictureRoot()
  const cardPath = `${pic}/cards/${cardImageFilename(currentListGame?.id, n)}`
  return `<div class="charlist-card" data-name="${n}">
    <div class="charlist-card-img-wrap">
      <img class="charlist-card-img" src="${cardPath}" alt="${dn}" loading="lazy" decoding="async" onerror="this.onerror=null;if(this.src.indexOf('null.png')===-1){this.src='${pic}/icons/null.png'}else{this.style.display='none'}">
      ${charlistCardIconsHtml(c, pic)}
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
loadCharListForCurrentGame()
window.addEventListener("crkSettingsChanged", () => loadCharListForCurrentGame())
