let allChars = []
let activeFilters = {}
let searchText = ""
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

function cardImageFilename(gameId, name) {
  const n = name || ""
  if (gameId === "toa") {
    return `${n}_Cookie_Profile_Icon.png`
  }
  return `Cookie_${String(n).toLowerCase()}_card.png`
}

function getSelectedGameId() {
  try {
    const s = JSON.parse(localStorage.getItem("tierlistUIState") || "{}")
    if (s.game && typeof s.game === "string") return s.game
  } catch {}
  return "crk"
}

const RARITY_ORDER = ["Witch","AncientA","Beast","Ancient", "Legendary","Dragon","Super Epic","Epic","Special","Rare","Common"]

const SORT_OPTIONS = [
  { value: "rarity", label: "Rarity" },
  { value: "release", label: "Release" },
  { value: "alpha", label: "A–Z" }
]

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
  return !!(c?.cjSkill || c?.mcSkill)
}

function buildFilters(filters) {
  const wrap = document.getElementById("charlistFilters")
  Object.entries(filters).forEach(([cat, vals]) => {
    const g = document.createElement("div")
    g.className = "filter-group"
    vals.forEach(v => {
      if (!v) return
      const btn = document.createElement("button")
      btn.className = "filter-icon-btn"
      btn.dataset.category = cat
      btn.dataset.value = v
      btn.title = v
      btn.innerHTML = `<img src="${listPictureRoot()}/icons/${v}.png" alt="${v}">`
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
  const game = d.games && d.games.find(g => g.id === currentGameId)
  currentListGame = game || null
  const wrap = document.getElementById("charlistFilters")
  if (wrap) wrap.innerHTML = ""
  activeFilters = {}
  const raw = game?.characters || []
  allChars = raw.filter(c => c && c.name)
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
    }
  }
  render()
}

function applyFilters(c) {
  if (searchText) {
    const s = ((c.displayName || c.name) + " " + c.name).toLowerCase()
    if (!s.includes(searchText)) return false
  }
  for (const [cat, vals] of Object.entries(activeFilters)) {
    const cv = c[cat]
    if (Array.isArray(cv)) {
      if (!cv.some(v => vals.includes(v))) return false
    } else {
      let passes = vals.includes(cv)
      if (cat === "rarity" && !passes && vals.includes("Ancient") && cv === "AncientA") passes = true
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
  render()
})
const dirBtn = document.getElementById("charlistSortDir")
dirBtn.addEventListener("click", () => {
  sortReverse = !sortReverse
  dirBtn.textContent = sortReverse ? "↑" : "↓"
  render()
})

function render() {
  const grid = document.getElementById("charlistGrid")
  const ri = r => { const i = RARITY_ORDER.indexOf(r); return i < 0 ? 999 : i }
  const rel = c => { const i = cookieByDate.indexOf(c.displayName ?? c.name); return i < 0 ? 9999 : i }
  const chars = allChars.filter(applyFilters).sort((a, b) => {
    const useMcCj = sortMode === "rarity" && sortByMcCj
    const cjFirst = (x, y) => (hasMcCj(x) ? 0 : 1) - (hasMcCj(y) ? 0 : 1)
    let v
    if (sortMode === "alpha") v = (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name)
    else if (sortMode === "release") v = rel(b) - rel(a)
    else {
      const rd = ri(a.rarity) - ri(b.rarity)
      v = rd !== 0 ? rd : useMcCj && cjFirst(a, b) !== 0 ? cjFirst(a, b) : rel(b) - rel(a)
    }
    return sortReverse ? -v : v
  })
  const counter = document.getElementById("charlistCounter")
  if (counter) {
    const noun = currentGameId === "crk" ? "cookie" : "character"
    counter.textContent = `Showing ${chars.length} ${noun}${chars.length === 1 ? "" : "s"}`
  }
  grid.innerHTML = chars.map(cardHtml).join("")
  grid.querySelectorAll(".charlist-card").forEach(el => {
    el.addEventListener("click", () => {
      window.location.href = `crk/character.html?char=${encodeURIComponent(el.dataset.name)}`
    })
  })
}

function cardHtml(c) {
  const n = c.name, dn = c.displayName || n
  const pic = listPictureRoot()
  const cardPath = `${pic}/cards/${cardImageFilename(currentListGame?.id, n)}`
  return `<div class="charlist-card" data-name="${n}">
    <div class="charlist-card-img-wrap">
      <img class="charlist-card-img" src="${cardPath}" alt="${dn}" onerror="this.onerror=null;if(this.src.indexOf('null.png')===-1){this.src='${pic}/icons/null.png'}else{this.style.display='none'}">
      <div class="charlist-card-icons">
        <img src="${pic}/candy/${n}_mc_lv3.png" alt="candy" onerror="this.onerror=null;this.style.display='none'">
        ${c.type ? `<img src="${pic}/icons/${c.type}.png" alt="${c.type}" title="${c.type}" onerror="this.onerror=null;this.style.display='none'">` : ""}
      </div>
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

initCharlistSortExpand()
loadCharListForCurrentGame()
