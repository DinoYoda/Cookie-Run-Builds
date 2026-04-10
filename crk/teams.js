;(function () {
  const UI_STATE_KEY = "tierlistUIState"

  function getSelectedGameId() {
    try {
      const s = JSON.parse(localStorage.getItem(UI_STATE_KEY) || "{}")
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
    return folder === "crk" ? "pictures" : `../${folder}/pictures`
  }

  const categoryTabsEl = document.getElementById("teamsCategoryTabs")
  const sectionTabsEl = document.getElementById("teamsSectionTabs")
  const contentEl = document.getElementById("teamsContent")
  if (!categoryTabsEl || !sectionTabsEl || !contentEl) return

  const game = (window.CRK_DATA?.games || []).find(g => g.id === getSelectedGameId())
  const categories = Array.isArray(game?.teams?.categories) ? game.teams.categories : []
  const characters = Array.isArray(game?.characters) ? game.characters : []
  const charMap = {}
  characters.forEach(c => {
    if (!c) return
    charMap[String(c.name || "").toLowerCase()] = c
    charMap[String(c.displayName || "").toLowerCase()] = c
  })

  function getChar(ref) {
    if (!ref) return null
    const key = String(ref.char || ref.name || "").toLowerCase()
    return charMap[key] || null
  }

  function getBuild(charData, buildIndex) {
    if (!charData || !buildIndex) return null
    return charData.builds?.[buildIndex] || null
  }

  function getSetLabel(kind, idx) {
    if (!idx || !Number.isInteger(idx) || idx < 1) return null
    return `${kind} ${idx}`
  }

  function renderTreasure(srcId) {
    const pic = getGamePictureRoot()
    const id = String(srcId || "").trim()
    if (!id) return ""
    return `<img src="${pic}/treasures/Treasure_${id}.png" alt="${id}" class="teams-treasure-icon" onerror="this.style.display='none'">`
  }

  function renderTeamMember(member) {
    const pic = getGamePictureRoot()
    const charData = getChar(member)
    if (!charData) {
      return `<div class="teams-member-card teams-member-card-missing"><div class="teams-member-name">Unknown Cookie</div></div>`
    }

    const build = getBuild(charData, member.build)
    const buildName = build?.name || null
    const toppingIdx = member.toppings || build?.toppings || null
    const beascuitIdx = member.beascuit || build?.beascuit || null
    const href = `character.html?char=${encodeURIComponent(charData.name || charData.displayName || "")}`
    const imgName = charData.name || ""

    return `<a class="teams-member-card" href="${href}">
      <img src="${pic}/icons/cookie/${imgName}_head.png" alt="${charData.displayName || charData.name}" class="teams-member-icon" onerror="this.onerror=null;this.src='${pic}/icons/null.png'">
      <div class="teams-member-name">${charData.displayName || charData.name}</div>
      ${buildName ? `<div class="teams-member-build">${buildName}</div>` : ""}
      <div class="teams-member-meta">
        ${getSetLabel("T", toppingIdx) ? `<span class="teams-member-chip">${getSetLabel("T", toppingIdx)}</span>` : ""}
        ${getSetLabel("B", beascuitIdx) ? `<span class="teams-member-chip">${getSetLabel("B", beascuitIdx)}</span>` : ""}
      </div>
    </a>`
  }

  function renderTeams(section) {
    const teams = Array.isArray(section?.teams) ? section.teams : []
    if (!teams.length) {
      contentEl.innerHTML = `<div class="teams-empty">No teams added here yet.</div>`
      return
    }

    contentEl.innerHTML = teams.map(team => {
      const members = Array.isArray(team.cookies) ? team.cookies.slice(0, 7) : []
      const treasures = Array.isArray(team.treasures) ? team.treasures : []
      const notes = Array.isArray(team.notes) ? team.notes : []
      return `<article class="teams-card">
        <div class="teams-card-header">
          <h3 class="teams-card-title">${team.name || "Unnamed Team"}</h3>
        </div>
        <div class="teams-members-grid teams-members-count-${Math.max(5, members.length)}">
          ${members.map(renderTeamMember).join("")}
        </div>
        ${treasures.length ? `<div class="teams-treasures"><div class="teams-subtitle">Treasures</div><div class="teams-treasure-row">${treasures.map(renderTreasure).join("")}</div></div>` : ""}
        ${notes.length ? `<div class="teams-notes"><div class="teams-subtitle">Notes</div>${notes.map(n => `<div class="teams-note">${n}</div>`).join("")}</div>` : ""}
      </article>`
    }).join("")
  }

  function setActiveButton(container, activeId) {
    Array.from(container.querySelectorAll("button")).forEach(btn => {
      btn.classList.toggle("active", btn.dataset.id === activeId)
      btn.setAttribute("aria-pressed", String(btn.dataset.id === activeId))
    })
  }

  let activeCategory = categories[0]?.id || null
  let activeSection = categories[0]?.sections?.[0]?.id || null

  function renderSections() {
    const cat = categories.find(c => c.id === activeCategory)
    const sections = Array.isArray(cat?.sections) ? cat.sections : []
    if (!sections.length) {
      sectionTabsEl.innerHTML = ""
      contentEl.innerHTML = `<div class="teams-empty">No subsections added here yet.</div>`
      return
    }
    if (!sections.some(s => s.id === activeSection)) activeSection = sections[0].id
    sectionTabsEl.innerHTML = sections.map(section =>
      `<button type="button" class="teams-subtab${section.id === activeSection ? " active" : ""}" data-id="${section.id}" aria-pressed="${section.id === activeSection}">${section.name || section.id}</button>`
    ).join("")
    sectionTabsEl.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        activeSection = btn.dataset.id
        setActiveButton(sectionTabsEl, activeSection)
        const nextSection = sections.find(s => s.id === activeSection)
        renderTeams(nextSection)
      })
    })
    renderTeams(sections.find(s => s.id === activeSection))
  }

  function renderCategories() {
    if (!categories.length) {
      categoryTabsEl.innerHTML = ""
      sectionTabsEl.innerHTML = ""
      contentEl.innerHTML = `<div class="teams-empty">No team categories added yet.</div>`
      return
    }
    categoryTabsEl.innerHTML = categories.map(cat =>
      `<button type="button" class="teams-tab${cat.id === activeCategory ? " active" : ""}" data-id="${cat.id}" aria-pressed="${cat.id === activeCategory}">${cat.name || cat.id}</button>`
    ).join("")
    categoryTabsEl.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.id
        const nextCat = categories.find(c => c.id === activeCategory)
        activeSection = nextCat?.sections?.[0]?.id || null
        setActiveButton(categoryTabsEl, activeCategory)
        renderSections()
      })
    })
    renderSections()
  }

  renderCategories()
})()
