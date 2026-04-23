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

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function treasureIdToLabel(id) {
    return String(id || "")
      .split("_")
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")
  }

  function renderTreasure(srcId) {
    const pic = getGamePictureRoot()
    const id = String(srcId || "").trim()
    if (!id) return ""
    const label = treasureIdToLabel(id)
    return `<img src="${pic}/treasures/Treasure_${id}.png" alt="${esc(label)}" title="${esc(label)}" class="teams-treasure-icon" onerror="this.style.display='none'">`
  }

  /**
   * Same order as char builds: general notes first, then this team’s notes, unless `useOwn` (then only team).
   * Uses tagged text like character build notes.
   */
  function renderTeamNotesBlock(generalNotes, team) {
    const g = Array.isArray(generalNotes) ? generalNotes : []
    const t = Array.isArray(team?.notes) ? team.notes : []
    const useOwn = !!team?.useOwn
    const lines = useOwn ? t.slice() : g.concat(t)
    if (!lines.length) return ""
    const renderLine = (text) => {
      if (text == null || String(text).trim() === "") return ""
      const inner =
        typeof renderInlineTaggedText === "function"
          ? renderInlineTaggedText(String(text))
          : esc(String(text))
      return `<div class="char-build-note teams-team-note-line">${inner}</div>`
    }
    const body = lines.map(renderLine).filter(Boolean).join("")
    if (!body) return ""
    return `<div class="char-build-notes teams-team-notes">
    <div class="char-build-notes-header-bar"><h4 class="char-build-notes-title">Team Notes</h4></div>
    <div class="char-build-notes-body" style="padding: 10px 20px;">${body}</div>
  </div>`
  }

  function renderTeamMember(member) {
    const pic = getGamePictureRoot()
    const charData = getChar(member)
    if (!charData) {
      return `<div class="teams-build-row teams-build-row--missing" role="row">
        <div class="teams-build-row-cookie"><span class="teams-member-name">Unknown Cookie</span></div>
      </div>`
    }

    const build = getBuild(charData, member.build)
    const buildName = build?.name || null
    const rawT = member.toppings != null && member.toppings !== "" ? member.toppings : (build?.toppings != null && build.toppings !== "" ? build.toppings : null)
    const rawB = member.beascuit != null && member.beascuit !== "" ? member.beascuit : (build?.beascuit != null && build.beascuit !== "" ? build.beascuit : null)
    const toppingIdx = rawT == null ? null : Number(rawT)
    const beascuitIdx = rawB == null ? null : Number(rawB)
    const toppingIdxOk = toppingIdx != null && Number.isInteger(toppingIdx) && toppingIdx >= 1
    const beascuitIdxOk = beascuitIdx != null && Number.isInteger(beascuitIdx) && beascuitIdx >= 1

    const sets = charData.sets || {}
    const toppingSetsList = Array.isArray(sets.toppings) ? sets.toppings : []
    const beascuitSetsList = Array.isArray(sets.beascuit) ? sets.beascuit : []
    const topSet = toppingIdxOk ? (toppingSetsList[toppingIdx - 1] || null) : null
    const biscuitSet = beascuitIdxOk ? (beascuitSetsList[beascuitIdx - 1] || null) : null

    const canBuildGear = typeof buildToppingsSetBlockHtml === "function" && typeof buildBeascuitSetBlockHtml === "function"
    let tBlock = { starHtml: "", substatsHtml: "" }
    let bBlock = { beascuitRowHtml: "" }
    if (canBuildGear) {
      tBlock = topSet ? buildToppingsSetBlockHtml(topSet) : tBlock
      bBlock = biscuitSet ? buildBeascuitSetBlockHtml(biscuitSet, charData, { teamsImageOverlay: true }) : bBlock
    }
    const hasT = !!(canBuildGear && topSet && (tBlock.starHtml || tBlock.substatsHtml))
    const hasB = !!(canBuildGear && biscuitSet && bBlock.beascuitRowHtml)

    const chips = []
    if (!canBuildGear) {
      if (getSetLabel("T", toppingIdxOk ? toppingIdx : null)) {
        chips.push(`<span class="teams-member-chip">${getSetLabel("T", toppingIdx)}</span>`)
      }
      if (getSetLabel("B", beascuitIdxOk ? beascuitIdx : null)) {
        chips.push(`<span class="teams-member-chip">${getSetLabel("B", beascuitIdx)}</span>`)
      }
    } else {
      if (toppingIdxOk && !topSet) chips.push(`<span class="teams-member-chip">T ${toppingIdx}</span>`)
      if (beascuitIdxOk && !biscuitSet) chips.push(`<span class="teams-member-chip">B ${beascuitIdx}</span>`)
    }
    const metaHtml = chips.length ? `<div class="teams-build-row-meta">${chips.join("")}</div>` : ""

    const href = `character.html?char=${encodeURIComponent(charData.name || charData.displayName || "")}`
    const imgName = charData.name || ""

    const displayN = charData.displayName || charData.name || ""
    const identityBlock = `<div class="teams-build-row-cookie">
      <img src="${pic}/icons/cookie/${imgName}_head.png" alt="${displayN}" class="teams-member-icon" onerror="this.onerror=null;this.src='${pic}/icons/null.png'">
      <div class="teams-build-row-cookie-text">
        <div class="teams-member-name" title="${esc(displayN)}">${displayN}</div>
        ${buildName ? `<div class="teams-member-build" title="${esc(buildName)}">${buildName}</div>` : ""}
      </div>
    </div>`

    let gearHtml = ""
    if (hasT) {
      const subHtml = tBlock.substatsHtml
        ? `<div class="teams-build-row-substats char-build-substats">${tBlock.substatsHtml}</div>`
        : ""
      gearHtml += `<div class="teams-build-toppings-group">
        <div class="teams-build-row-star">${tBlock.starHtml}</div>
        ${subHtml}
      </div>`
    }
    if (hasB) {
      gearHtml += `<div class="teams-build-row-beascuit">${bBlock.beascuitRowHtml || ""}</div>`
    }

    const hasGear = hasT || hasB
    const rightBlock = (hasGear || metaHtml) ? `<div class="teams-build-row-gear">${gearHtml}${metaHtml}</div>` : ""
    return `<a class="teams-build-row${hasGear ? " teams-build-row--has-gear" : ""}" href="${href}">${identityBlock}${rightBlock}</a>`
  }

  /** Non-empty `sections` → subsection tabs; otherwise use `category.teams` only. */
  function getCategorySections(cat) {
    const s = cat?.sections
    return Array.isArray(s) ? s : []
  }

  function categoryHasSectionTabs(cat) {
    return getCategorySections(cat).length > 0
  }

  function renderTeams(ctx) {
    const teams = Array.isArray(ctx?.teams) ? ctx.teams : []
    if (!teams.length) {
      contentEl.innerHTML = `<div class="teams-empty">No teams added here yet.</div>`
      return
    }

    const generalNotes = Array.isArray(ctx?.notes) ? ctx.notes : []

    contentEl.innerHTML = teams.map(team => {
      const members = Array.isArray(team.cookies) ? team.cookies.slice(0, 7) : []
      const treasures = Array.isArray(team.treasures) ? team.treasures : []
      const teamNotesBlock = renderTeamNotesBlock(generalNotes, team)
      return `<div class="teams-entry${teamNotesBlock ? " teams-entry--with-notes" : ""}">
        <article class="teams-card">
          <div class="teams-card-header">
            <h3 class="teams-card-title">${esc(team.name || "Unnamed Team")}</h3>
          </div>
          <div class="teams-build-rows">
            ${members.map(renderTeamMember).join("")}
          </div>
          ${treasures.length ? `<div class="teams-treasures"><div class="teams-subtitle">Treasures</div><div class="teams-treasure-row">${treasures.map(renderTreasure).join("")}</div></div>` : ""}
        </article>
        ${teamNotesBlock}
      </div>`
    }).join("")
  }

  function setActiveCategoryButtons(activeIdx) {
    Array.from(categoryTabsEl.querySelectorAll("button")).forEach(btn => {
      const on = Number(btn.dataset.catIdx) === activeIdx
      btn.classList.toggle("active", on)
      btn.setAttribute("aria-pressed", String(on))
    })
  }

  function setActiveSectionButtons(activeIdx) {
    Array.from(sectionTabsEl.querySelectorAll("button")).forEach(btn => {
      const on = Number(btn.dataset.secIdx) === activeIdx
      btn.classList.toggle("active", on)
      btn.setAttribute("aria-pressed", String(on))
    })
  }

  /** Array indices only — categories/sections use `name` in data, no `id` required. */
  let activeCategoryIdx = 0
  let activeSectionIdx = 0

  function renderSections() {
    const cat = categories[activeCategoryIdx]
    if (!cat) {
      sectionTabsEl.innerHTML = ""
      sectionTabsEl.hidden = true
      contentEl.innerHTML = `<div class="teams-empty">No data.</div>`
      return
    }

    const sections = getCategorySections(cat)

    if (!categoryHasSectionTabs(cat)) {
      sectionTabsEl.innerHTML = ""
      sectionTabsEl.hidden = true
      const flat = Array.isArray(cat.teams) ? cat.teams : []
      const parentNotes = Array.isArray(cat.notes) ? cat.notes : []
      renderTeams({ teams: flat, notes: parentNotes })
      return
    }

    sectionTabsEl.hidden = false
    if (activeSectionIdx >= sections.length) activeSectionIdx = 0
    if (activeSectionIdx < 0) activeSectionIdx = 0

    sectionTabsEl.innerHTML = sections.map((section, j) => {
      const label = section.name && String(section.name).trim() ? section.name : `Section ${j + 1}`
      return `<button type="button" class="teams-subtab${j === activeSectionIdx ? " active" : ""}" data-sec-idx="${j}" aria-pressed="${j === activeSectionIdx}">${esc(label)}</button>`
    }).join("")

    sectionTabsEl.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        activeSectionIdx = Number(btn.dataset.secIdx) || 0
        setActiveSectionButtons(activeSectionIdx)
        const cur = categories[activeCategoryIdx]
        const subs = getCategorySections(cur)
        const sec = subs[activeSectionIdx] || { teams: [] }
        const secNotes = Array.isArray(sec.notes) ? sec.notes : []
        renderTeams({ teams: Array.isArray(sec.teams) ? sec.teams : [], notes: secNotes })
      })
    })
    setActiveSectionButtons(activeSectionIdx)
    {
      const sec = sections[activeSectionIdx] || { teams: [] }
      const secNotes = Array.isArray(sec.notes) ? sec.notes : []
      renderTeams({ teams: Array.isArray(sec.teams) ? sec.teams : [], notes: secNotes })
    }
  }

  function renderCategories() {
    if (!categories.length) {
      categoryTabsEl.innerHTML = ""
      sectionTabsEl.innerHTML = ""
      contentEl.innerHTML = `<div class="teams-empty">No team categories added yet.</div>`
      return
    }
    if (activeCategoryIdx >= categories.length) activeCategoryIdx = 0
    if (activeCategoryIdx < 0) activeCategoryIdx = 0

    categoryTabsEl.innerHTML = categories.map((cat, i) => {
      const label = cat.name && String(cat.name).trim() ? cat.name : `Category ${i + 1}`
      return `<button type="button" class="teams-tab${i === activeCategoryIdx ? " active" : ""}" data-cat-idx="${i}" aria-pressed="${i === activeCategoryIdx}">${esc(label)}</button>`
    }).join("")

    categoryTabsEl.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        activeCategoryIdx = Number(btn.dataset.catIdx) || 0
        activeSectionIdx = 0
        setActiveCategoryButtons(activeCategoryIdx)
        renderSections()
      })
    })
    setActiveCategoryButtons(activeCategoryIdx)
    renderSections()
  }

  renderCategories()
})()
