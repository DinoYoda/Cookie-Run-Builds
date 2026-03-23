let allChars = []
let activeFilters = {}
let searchText = ""
let sortMode = "rarity"
let sortReverse = false
let sortByMcCj = false

const RARITY_ORDER = ["Witch","AncientA","Beast","Ancient", "Legendary","Dragon","Super Epic","Epic","Special","Rare","Common"]

const d = window.CRK_DATA || {}
const game = d.games && d.games.find(g => g.id === "crk")
if (game) {
  allChars = game.characters || []
  const filters = game.tierlists?.find(t => t.filters && Object.keys(t.filters).length)?.filters || {}
  buildFilters(filters)
  render()
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
      btn.innerHTML = `<img src="pictures/icons/${v}.png" alt="${v}">`
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
  document.getElementById("charlistSort").value = "rarity"
  document.getElementById("charlistSortDir").textContent = "↓"
  const cb = document.getElementById("charlistMcCj")
  if (cb) cb.checked = false
  document.querySelectorAll("#charlistFilters .filter-icon-btn").forEach(b => b.classList.remove("active"))
  render()
})
document.getElementById("charlistSort").addEventListener("change", e => {
  sortMode = e.target.value
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

function hasMcCj(c) {
  return !!(c?.cjSkill || c?.mcSkill)
}

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
  if (counter) counter.textContent = `${chars.length} cookie${chars.length === 1 ? "" : "s"}`
  grid.innerHTML = chars.map(cardHtml).join("")
  grid.querySelectorAll(".charlist-card").forEach(el => {
    el.addEventListener("click", () => {
      window.location.href = `character.html?char=${encodeURIComponent(el.dataset.name)}`
    })
  })
}

function cardHtml(c) {
  const n = c.name, dn = c.displayName || n
  const cardCandidates = [
    `pictures/cards/cookie_${n}_card.png`,
    `pictures/cards/Cookie_${n}_card.png`,
    `pictures/cards/cookie_${String(n).toLowerCase()}_card.png`,
    `pictures/cards/Cookie_${String(n).toLowerCase()}_card.png`
  ]
  return `<div class="charlist-card" data-name="${n}">
    <div class="charlist-card-img-wrap">
      <img class="charlist-card-img" src="${cardCandidates[0]}" data-fallback-1="${cardCandidates[1]}" data-fallback-2="${cardCandidates[2]}" data-fallback-3="${cardCandidates[3]}" alt="${dn}" onerror="const step=Number(this.dataset.fallbackStep||'0'); const next=[this.dataset.fallback1,this.dataset.fallback2,this.dataset.fallback3,'pictures/icons/null.png'][step]; if(next){this.dataset.fallbackStep=String(step+1); this.src=next;} else {this.onerror=null;}">
      <div class="charlist-card-icons">
        <img src="pictures/candy/${n}_mc_lv3.png" alt="candy" onerror="this.style.display='none'">
        <img src="pictures/icons/${c.type}.png" alt="${c.type}" title="${c.type}" onerror="this.style.display='none'">
      </div>
    </div>
    <div class="charlist-card-info">
      <div class="charlist-card-name">${dn}</div>
    </div>
  </div>`
}
