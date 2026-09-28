;(function () {
  const UI_STATE_KEY = "tierlistUIState"
  const TEAMS_PAGE_STATE_KEY = "teamsPageViewState"

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
  const sectionGroupEl = document.getElementById("teamsSectionGroup")
  const sectionLabelEl = document.getElementById("teamsSectionLabel")
  const versionTabsEl = document.getElementById("teamsVersionTabs")
  const versionGroupEl = document.getElementById("teamsVersionGroup")
  const contentEl = document.getElementById("teamsContent")
  if (!categoryTabsEl || !sectionTabsEl || !contentEl) return

  if (typeof window.ensureSkillStatusCursorTip === "function") {
    window.ensureSkillStatusCursorTip()
  }

  function setSectionSubtabsVisible(show) {
    sectionTabsEl.hidden = !show
    if (sectionGroupEl) sectionGroupEl.hidden = !show
  }

  function setVersionTabsVisible(show) {
    if (versionTabsEl) versionTabsEl.hidden = !show
    if (versionGroupEl) versionGroupEl.hidden = !show
  }

  const game = (window.CRK_DATA?.games || []).find(g => g.id === getSelectedGameId())
  const categories = Array.isArray(game?.teams?.categories) ? game.teams.categories : []
  const events = Array.isArray(game?.teams?.events) ? game.teams.events : []
  const characters = Array.isArray(game?.characters) ? game.characters : []
  const charMap = {}
  characters.forEach(c => {
    if (!c) return
    charMap[String(c.name || "").toLowerCase()] = c
    charMap[String(c.displayName || "").toLowerCase()] = c
  })

  /** Set in renderTeams from ctx.gameVersion; default = current meta (all features). */
  let currentRenderFeatures = { beascuits: true, resonantToppings: true, tarts: true, legendaryTarts: true }
  let currentGameVersion = null
  let currentResonanceUpdateMap = null

  function resolveRenderFeatures(gameVersion) {
    if (typeof getTeamRenderFeatures === "function") {
      return getTeamRenderFeatures(gameVersion)
    }
    return { beascuits: true, resonantToppings: true, tarts: true, legendaryTarts: true }
  }

  function buildToppingRenderOptions(topSet) {
    const opts = {
      showTart: currentRenderFeatures.tarts,
      showLegendaryTart: currentRenderFeatures.legendaryTarts,
    }
    if (currentGameVersion != null && typeof resolveResonanceForGameVersion === "function") {
      opts.resonance = resolveResonanceForGameVersion(
        topSet?.resonance,
        currentGameVersion,
        currentResonanceUpdateMap,
      )
    }
    return opts
  }

  function getChar(ref) {
    if (!ref) return null
    const key = String(ref.char || ref.name || "").toLowerCase()
    return charMap[key] || null
  }

  /**
   * cookies[] entries are either a member object or [alt, alt, …] (replacement options for one slot).
   */
  function normalizeCookieSlots(rawCookies) {
    const list = Array.isArray(rawCookies) ? rawCookies.slice(0, 7) : []
    const slots = []
    for (const item of list) {
      if (Array.isArray(item)) {
        const alts = item.filter(x => x && typeof x === "object" && !Array.isArray(x))
        if (alts.length) slots.push({ alternatives: alts })
        continue
      }
      if (item && typeof item === "object") {
        slots.push({ alternatives: [item] })
      }
    }
    return slots
  }

  /** Front → Middle → Back by first alternative in each slot. */
  function sortTeamSlots(slots) {
    if (typeof getCookieBattleOrderRank !== "function") return slots
    return slots.slice().sort((a, b) => {
      const ma = a?.alternatives?.[0]
      const mb = b?.alternatives?.[0]
      const ra = getCookieBattleOrderRank(getChar(ma), ma)
      const rb = getCookieBattleOrderRank(getChar(mb), mb)
      if (ra.row !== rb.row) return ra.row - rb.row
      if (ra.idx !== rb.idx) return ra.idx - rb.idx
      return 0
    })
  }

  /** Epic → Special → Rare → Common, then release order within tier. */
  function sortTeamTreasures(treasures) {
    if (typeof getTreasureSortRank !== "function") return treasures
    return treasures
      .slice()
      .filter(t => String(t || "").trim())
      .sort((a, b) => {
        const ra = getTreasureSortRank(a)
        const rb = getTreasureSortRank(b)
        if (ra.rarity !== rb.rarity) return ra.rarity - rb.rarity
        if (ra.idx !== rb.idx) return ra.idx - rb.idx
        return 0
      })
  }

  function getBuild(charData, buildRef) {
    if (!charData || buildRef == null || buildRef === "") return null
    const builds = charData.builds
    if (!builds || typeof builds !== "object") return null

    if (builds[buildRef] && typeof builds[buildRef] === "object" && builds[buildRef].name) {
      return builds[buildRef]
    }
    const numKey = typeof buildRef === "number" ? String(buildRef) : /^\d+$/.test(String(buildRef)) ? String(buildRef) : null
    if (numKey && builds[numKey] && typeof builds[numKey] === "object") {
      return builds[numKey]
    }

    const refLower = String(buildRef).trim().toLowerCase()
    if (!refLower) return null
    for (const build of Object.values(builds)) {
      if (build && typeof build === "object" && build.name) {
        if (String(build.name).trim().toLowerCase() === refLower) return build
      }
    }
    return null
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

  /** team.source — URL string or { url, label? } */
  function renderTeamSourceHtml(source) {
    if (source == null) return ""
    let url = ""
    let customLabel = ""
    if (typeof source === "object" && source !== null && source.url != null) {
      url = String(source.url).trim()
      customLabel = source.label != null ? String(source.label).trim() : ""
    } else {
      url = String(source).trim()
    }
    if (!url && !customLabel) return ""
    if (!url) {
      return `<p class="teams-source">Source: ${esc(customLabel)}</p>`
    }
    let href = url
    let linkLabel = customLabel
    try {
      const u = new URL(url, "https://example.invalid")
      if (u.protocol === "http:" || u.protocol === "https:") {
        href = u.href
        if (!linkLabel) {
          const host = u.hostname.replace(/^www\./i, "").toLowerCase()
          if (/^(youtube\.com|youtu\.be|m\.youtube\.com)$/.test(host) || host.endsWith(".youtube.com")) {
            linkLabel = "YouTube"
          } else if (host.includes("twitch.tv")) {
            linkLabel = "Twitch"
          } else {
            linkLabel = host
          }
        }
      } else if (!linkLabel) {
        linkLabel = url
      }
    } catch {
      if (!linkLabel) linkLabel = url
      return `<p class="teams-source">Source: ${esc(linkLabel)}</p>`
    }
    return `<p class="teams-source">Source: <a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(linkLabel)}</a></p>`
  }

  function treasureIdToLabel(id) {
    return String(id || "")
      .split("_")
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")
  }

  function treasurePngUrl(pic, slug) {
    const file = `Treasure_${slug}.png`
    return `${pic}/treasures/${encodeURIComponent(file)}`
  }

  function renderTreasure(srcId) {
    const pic = getGamePictureRoot()
    const raw = String(srcId || "").trim()
    if (!raw) return ""
    const parseFn = typeof parseTreasureBracketInner === "function" ? parseTreasureBracketInner : (s) => ({ main: String(s).trim(), iconOnly: false })
    const { main, iconOnly } = parseFn(raw)
    const tmap = typeof CRK_TREASURE_SLUG_MAP === "object" && CRK_TREASURE_SLUG_MAP ? CRK_TREASURE_SLUG_MAP : {}
    const kw = typeof CRK_TREASURE_KEYWORD_DISPLAY === "object" && CRK_TREASURE_KEYWORD_DISPLAY ? CRK_TREASURE_KEYWORD_DISPLAY : {}
    const resolved =
      typeof resolveTreasureWiki === "function"
        ? resolveTreasureWiki(main, tmap, kw)
        : { slug: main, display: treasureIdToLabel(main) }
    const slug = resolved.slug
    if (!slug) return ""
    const label = resolved.display || main || raw
    const idHtml = esc(label)
    const onErr =
      "this.onerror=null;this.style.display='none';var p=this.parentElement;var f=p&&p.querySelector('.teams-treasure-fallback');if(f)f.removeAttribute('hidden')"
    const caption =
      !iconOnly && label
        ? `<span class="teams-treasure-caption teams-treasure-caption--static-only">${idHtml}</span>`
        : ""
    const cursorTipAttr =
      !iconOnly && label ? ` data-cursor-tip="${esc(label)}"` : ""
    const a11y = esc(label)
    const titleOnlyIcon = iconOnly && label ? ` title="${a11y}"` : ""
    return `<span class="teams-treasure-item" tabindex="0" aria-label="${a11y}"${cursorTipAttr}${titleOnlyIcon}>` +
      `<img src="${treasurePngUrl(pic, slug)}" alt="" class="teams-treasure-icon" onerror="${onErr}">` +
      `${caption}` +
      `<span class="teams-treasure-fallback" hidden>${esc(raw)}</span></span>`
  }

  function renderNotesLines(lines) {
    const renderLine = (text) => {
      if (text == null || String(text).trim() === "") return ""
      const inner =
        typeof renderInlineTaggedText === "function"
          ? renderInlineTaggedText(String(text))
          : esc(String(text))
      return `<div class="char-build-note teams-team-note-line">${inner}</div>`
    }
    const arr = Array.isArray(lines) ? lines : []
    return arr.map(renderLine).filter(Boolean).join("")
  }

  function renderNotesBlock(title, lines, extraClass) {
    const body = renderNotesLines(lines)
    if (!body) return ""
    const cls = extraClass ? ` ${extraClass}` : ""
    return `<div class="char-build-notes teams-team-notes${cls}">
    <div class="char-build-notes-header-bar"><h4 class="char-build-notes-title">${esc(title)}</h4></div>
    <div class="char-build-notes-body" style="padding: 10px 20px;">${body}</div>
  </div>`
  }

  /** Per-squad notes under each squad in a multi-squad comp. */
  function renderSquadNotes(squad) {
    return renderNotesBlock("Team Notes", squad?.notes)
  }

  /**
   * Section/version notes + comp-level notes on the team entry (not merged with squad notes).
   * Multi-squad comps use “General Notes” for team.notes so they aren’t confused with per-squad Team Notes.
   */
  function renderTeamEntryNotes(generalNotes, team, { multiSquad = false } = {}) {
    const g = Array.isArray(generalNotes) ? generalNotes : []
    const t = Array.isArray(team?.notes) ? team.notes : []
    const useOwn = !!team?.useOwn
    const parts = []
    if (!useOwn && g.length) {
      parts.push(renderNotesBlock("Section Notes", g, "teams-section-notes"))
    }
    if (t.length) {
      let title = "Team Notes"
      let extra = ""
      if (multiSquad && !useOwn) {
        title = "General Notes"
        extra = "teams-general-notes"
      }
      parts.push(renderNotesBlock(title, t, extra))
    }
    return parts.join("")
  }

  function buildMemberRenderContext(member) {
    const pic = getGamePictureRoot()
    const charData = getChar(member)
    if (!charData) {
      return { missing: true, gearKey: "" }
    }

    const build = getBuild(charData, member.build)
    const buildName = build?.name || null
    const rawT = member.toppings != null && member.toppings !== "" ? member.toppings : (build?.toppings != null && build.toppings !== "" ? build.toppings : null)
    const rawB = member.beascuit != null && member.beascuit !== "" ? member.beascuit : (build?.beascuit != null && build.beascuit !== "" ? build.beascuit : null)
    const toppingIdx = rawT == null ? null : Number(rawT)
    const beascuitIdx = rawB == null ? null : Number(rawB)
    const toppingIdxOk = toppingIdx != null && Number.isInteger(toppingIdx) && toppingIdx >= 1
    const beascuitIdxOk = beascuitIdx != null && Number.isInteger(beascuitIdx) && beascuitIdx >= 1
    const showBeascuit = currentRenderFeatures.beascuits

    const sets = charData.sets || {}
    const toppingSetsList = Array.isArray(sets.toppings) ? sets.toppings : []
    const beascuitSetsList = Array.isArray(sets.beascuit) ? sets.beascuit : []
    const topSet = toppingIdxOk ? (toppingSetsList[toppingIdx - 1] || null) : null
    const biscuitSet = showBeascuit && beascuitIdxOk ? (beascuitSetsList[beascuitIdx - 1] || null) : null

    const canBuildGear = typeof buildToppingsSetBlockHtml === "function" && typeof buildBeascuitSetBlockHtml === "function"
    let tBlock = { starHtml: "" }
    let toppingDetailsHtml = ""
    let bBlock = { beascuitRowHtml: "" }
    if (canBuildGear) {
      const toppingOpts = topSet ? buildToppingRenderOptions(topSet) : {}
      tBlock = topSet
        ? buildToppingsSetBlockHtml(topSet, { ...toppingOpts, bonusEffect: build?.bonusEffect })
        : tBlock
      if (topSet && typeof buildToppingsDetailsHtml === "function") {
        toppingDetailsHtml = buildToppingsDetailsHtml({
          showTart: toppingOpts.showTart,
          showLegendaryTart: toppingOpts.showLegendaryTart,
          substats: build?.substats,
          bonusEffect: build?.bonusEffect,
          teamsCompact: true,
        })
      }
      bBlock = biscuitSet ? buildBeascuitSetBlockHtml(biscuitSet, charData, { teamsImageOverlay: true }) : bBlock
    }
    const hasT = !!(canBuildGear && topSet && (tBlock.starHtml || toppingDetailsHtml))
    const hasB = !!(canBuildGear && biscuitSet && bBlock.beascuitRowHtml)

    const chips = []
    if (!canBuildGear) {
      if (getSetLabel("T", toppingIdxOk ? toppingIdx : null)) {
        chips.push(`<span class="teams-member-chip">${getSetLabel("T", toppingIdx)}</span>`)
      }
      if (showBeascuit && getSetLabel("B", beascuitIdxOk ? beascuitIdx : null)) {
        chips.push(`<span class="teams-member-chip">${getSetLabel("B", beascuitIdx)}</span>`)
      }
    } else {
      if (toppingIdxOk && !topSet) chips.push(`<span class="teams-member-chip">T ${toppingIdx}</span>`)
      if (showBeascuit && beascuitIdxOk && !biscuitSet) chips.push(`<span class="teams-member-chip">B ${beascuitIdx}</span>`)
    }
    const metaHtml = chips.length ? `<div class="teams-build-row-meta">${chips.join("")}</div>` : ""

    const nameParam = encodeURIComponent(charData.name || charData.displayName || "")
    const path = `character.html?char=${nameParam}#Builds`
    let href = path
    try {
      href = new URL(path, location.href).href
    } catch (e) { /* same-document relative fallback */ }
    const imgName = charData.name || ""
    const displayN = charData.displayName || charData.name || ""

    let gearHtml = ""
    if (hasT) {
      gearHtml += `<div class="teams-build-toppings-group">
        <div class="teams-build-row-star">${tBlock.starHtml}</div>
        ${toppingDetailsHtml}
      </div>`
    }
    if (hasB) {
      gearHtml += `<div class="teams-build-row-beascuit">${bBlock.beascuitRowHtml || ""}</div>`
    }

    const hasGear = hasT || hasB || !!metaHtml
    const gearKey = [
      buildName || "",
      toppingIdxOk ? String(toppingIdx) : "",
      beascuitIdxOk ? String(beascuitIdx) : "",
      topSet?.name || topSet?.id || "",
      biscuitSet?.name || biscuitSet?.id || "",
      build?.bonusEffect || "",
    ].join("|")

    return {
      missing: false,
      pic,
      href,
      imgName,
      displayN,
      buildName,
      gearHtml,
      metaHtml,
      hasGear,
      gearKey,
    }
  }

  function renderMemberIdentityHtml(ctx) {
    return `<div class="teams-build-row-cookie">
      <img src="${ctx.pic}/icons/cookie/${ctx.imgName}_head.png" alt="${esc(ctx.displayN)}" class="teams-member-icon" onerror="this.onerror=null;this.src='${ctx.pic}/icons/null.png'">
      <div class="teams-build-row-cookie-text">
        <div class="teams-member-name" title="${esc(ctx.displayN)}">${ctx.displayN}</div>
        ${ctx.buildName ? `<div class="teams-member-build" title="${esc(ctx.buildName)}">${ctx.buildName}</div>` : ""}
      </div>
    </div>`
  }

  function renderTeamMemberFromContext(ctx) {
    if (ctx.missing) {
      return `<div class="teams-build-row teams-build-row--missing" role="row">
        <div class="teams-build-row-cookie"><span class="teams-member-name">Unknown Cookie</span></div>
      </div>`
    }
    const identityBlock = renderMemberIdentityHtml(ctx)
    const rightBlock = ctx.hasGear
      ? `<div class="teams-build-row-gear">${ctx.gearHtml}${ctx.metaHtml}</div>`
      : ""
    return `<a class="teams-build-row${ctx.hasGear ? " teams-build-row--has-gear" : ""}" href="${ctx.href}">${identityBlock}${rightBlock}</a>`
  }

  function renderTeamMember(member) {
    return renderTeamMemberFromContext(buildMemberRenderContext(member))
  }

  function cookiePickerLabel(displayN) {
    const s = String(displayN || "").trim()
    if (!s) return "Cookie"
    const short = s.replace(/\s+Cookie(\s|$).*/i, "").trim()
    return short || s
  }

  function renderTeamMemberSlot(slot) {
    const alts = Array.isArray(slot?.alternatives) ? slot.alternatives : []
    if (!alts.length) {
      return `<div class="teams-build-row teams-build-row--missing" role="row">
        <div class="teams-build-row-cookie"><span class="teams-member-name">Empty slot</span></div>
      </div>`
    }
    if (alts.length === 1) return renderTeamMember(alts[0])

    const ctxs = alts.map(buildMemberRenderContext)
    const pairs = ctxs.map((c, i) => ({ c, i })).filter(p => !p.c.missing)
    if (!pairs.length) {
      return `<div class="teams-build-row teams-build-row--missing" role="row">
        <div class="teams-build-row-cookie"><span class="teams-member-name">Unknown Cookie</span></div>
      </div>`
    }
    if (pairs.length === 1) return renderTeamMember(alts[pairs[0].i])

    const views = pairs.map(({ c }, viewIdx) => {
      const isActive = viewIdx === 0
      const identity = renderMemberIdentityHtml(c)
      const gear = c.hasGear ? `<div class="teams-build-row-gear">${c.gearHtml}${c.metaHtml}</div>` : ""
      return `<a class="teams-build-row teams-alt-slot-view${isActive ? " teams-alt-slot-view--active" : ""}${c.hasGear ? " teams-build-row--has-gear" : ""}" href="${c.href}" data-alt-index="${viewIdx}"${isActive ? "" : " hidden"}>${identity}${gear}</a>`
    }).join("")

    const buttons = pairs.map(({ c }, viewIdx) => {
      const isActive = viewIdx === 0
      const label = cookiePickerLabel(c.displayN)
      const mainCls = viewIdx === 0 ? " teams-alt-picker-btn--main" : ""
      return `<button type="button" class="teams-alt-picker-btn${mainCls}${isActive ? " active" : ""}" role="tab" data-alt-index="${viewIdx}" aria-pressed="${isActive}" aria-selected="${isActive}" title="${esc(c.displayN)}">
        <img src="${c.pic}/icons/cookie/${c.imgName}_head.png" alt="" class="teams-alt-picker-icon" onerror="this.onerror=null;this.src='${c.pic}/icons/null.png'">
        <span class="teams-alt-picker-label">${esc(label)}</span>
      </button>`
    }).join("")

    const anyGear = pairs.some(p => p.c.hasGear)
    return `<div class="teams-alt-slot${anyGear ? " teams-alt-slot--has-gear" : ""}" role="row">
      <div class="teams-alt-slot-body">${views}</div>
      <div class="teams-alt-picker" role="tablist" aria-label="Cookie options">${buttons}</div>
    </div>`
  }

  function initTeamAltPickers(root) {
    if (!root) return
    root.querySelectorAll(".teams-alt-slot").forEach(slotEl => {
      if (slotEl.dataset.altPickerBound === "1") return
      slotEl.dataset.altPickerBound = "1"
      const views = Array.from(slotEl.querySelectorAll(".teams-alt-slot-view"))
      const btns = Array.from(slotEl.querySelectorAll(".teams-alt-picker-btn"))
      function showAltView(idx) {
        let activeView = null
        views.forEach(v => {
          const on = v.dataset.altIndex === idx
          v.hidden = !on
          v.classList.toggle("teams-alt-slot-view--active", on)
          if (on) activeView = v
        })
        if (activeView && typeof initToppingGraphics === "function") {
          initToppingGraphics(activeView)
        }
      }

      btns.forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = btn.dataset.altIndex
          if (idx == null) return
          btns.forEach(b => {
            const on = b.dataset.altIndex === idx
            b.classList.toggle("active", on)
            b.setAttribute("aria-pressed", String(on))
            b.setAttribute("aria-selected", String(on))
          })
          showAltView(idx)
        })
      })
    })
  }

  /** Event categories filter `teams.events` by `active`; others use `sections`. */
  function isEventCategory(cat) {
    return cat?.eventFilter === "active" || cat?.eventFilter === "inactive"
  }

  function getCategorySections(cat) {
    if (isEventCategory(cat)) {
      const wantActive = cat.eventFilter === "active"
      return events.filter(ev => !!ev?.active === wantActive)
    }
    const s = cat?.sections
    return Array.isArray(s) ? s : []
  }

  function categoryHasSectionTabs(cat) {
    return getCategorySections(cat).length > 0
  }

  function getSectionVersions(section) {
    return Array.isArray(section?.versions) ? section.versions : []
  }

  function sectionUsesVersions(section) {
    return getSectionVersions(section).length > 0
  }

  function getDefaultVersionIdx(section) {
    const versions = getSectionVersions(section)
    return versions.length ? versions.length - 1 : 0
  }

  function getVersionLabel(version) {
    const ver = version?.gameVersion != null && String(version.gameVersion).trim()
      ? String(version.gameVersion).trim()
      : ""
    const name = version?.displayName != null && String(version.displayName).trim()
      ? String(version.displayName).trim()
      : ""
    if (ver && name) return `${ver} — ${name}`
    return name || ver || "Version"
  }

  function resolveSectionContent(section, versionIdx) {
    if (sectionUsesVersions(section)) {
      const versions = getSectionVersions(section)
      const idx = Number.isInteger(versionIdx) && versionIdx >= 0 && versionIdx < versions.length
        ? versionIdx
        : getDefaultVersionIdx(section)
      const v = versions[idx] || {}
      return {
        teams: Array.isArray(v.teams) ? v.teams : [],
        notes: Array.isArray(v.notes) ? v.notes : [],
        gameVersion: v.gameVersion != null ? String(v.gameVersion).trim() : null,
        eventHeading: {
          displayName: v.displayName || section?.name || "",
          gameVersion: v.gameVersion || null
        }
      }
    }
    return {
      teams: Array.isArray(section?.teams) ? section.teams : [],
      notes: Array.isArray(section?.notes) ? section.notes : [],
      gameVersion: section?.gameVersion != null ? String(section.gameVersion).trim() : null,
      eventHeading: null
    }
  }

  function renderEventHeading(heading) {
    if (!heading || !heading.displayName) return ""
    const title = esc(heading.displayName)
    const ver = heading.gameVersion != null && String(heading.gameVersion).trim()
      ? `<p class="teams-event-version-meta">Game version ${esc(String(heading.gameVersion).trim())}</p>`
      : ""
    return `<div class="teams-event-heading"><h2 class="teams-event-title">${title}</h2>${ver}</div>`
  }

  /**
   * One comp entry may be a single team (cookies on the object) or several squads (raids).
   * squads: [{ name?, cookies, treasures?, notes?, rally?, useOwn? }, …]
   * rally: data.js cookie name for rally effect leader (head icon under “Leader”).
   * Legacy: team1, team2, … on the entry (still supported).
   */
  function squadHasCookieSlots(sq) {
    if (!sq || typeof sq !== "object" || !Array.isArray(sq.cookies) || !sq.cookies.length) return false
    return sq.cookies.some((item) => {
      if (Array.isArray(item)) return item.some((m) => m && typeof m === "object")
      return item && typeof item === "object"
    })
  }

  /** Keep squads with cookies, or named placeholders still being filled in. */
  function squadShouldRender(sq) {
    if (!sq || typeof sq !== "object") return false
    if (squadHasCookieSlots(sq)) return true
    return !!(sq.name != null && String(sq.name).trim())
  }

  function squadLabelFromEntry(entry, fallbackLabel) {
    const raw = entry?.name
    if (raw != null && String(raw).trim()) {
      return { label: String(raw).trim(), labelIsCustom: true }
    }
    return { label: fallbackLabel, labelIsCustom: false }
  }

  function normalizeTeamSquads(team) {
    if (!team || typeof team !== "object") return []
    if (Array.isArray(team.squads) && team.squads.length) {
      const usable = team.squads.filter(squadShouldRender)
      return usable.map((sq, i) => {
        const { label, labelIsCustom } = squadLabelFromEntry(sq, `Team ${i + 1}`)
        return {
          label,
          labelIsCustom,
          cookies: sq.cookies,
          treasures: sq.treasures,
          notes: sq.notes,
          useOwn: sq.useOwn,
          rally: sq.rally != null && sq.rally !== "" ? sq.rally : team.rally,
        }
      })
    }
    const fromKeys = []
    for (let n = 1; n <= 7; n++) {
      const chunk = team[`team${n}`]
      if (!chunk || typeof chunk !== "object" || !squadShouldRender(chunk)) continue
      const { label, labelIsCustom } = squadLabelFromEntry(chunk, `Team ${n}`)
      fromKeys.push({
        label,
        labelIsCustom,
        cookies: chunk.cookies,
        treasures: chunk.treasures,
        notes: chunk.notes,
        useOwn: chunk.useOwn,
        rally: chunk.rally != null && chunk.rally !== "" ? chunk.rally : team.rally,
      })
    }
    if (fromKeys.length) return fromKeys
    if (Array.isArray(team.cookies)) {
      return [{
        label: null,
        cookies: team.cookies,
        treasures: team.treasures,
        notes: team.notes,
        useOwn: team.useOwn,
        rally: team.rally,
      }]
    }
    return []
  }

  function renderTeamLeader(rallyRef) {
    const raw = rallyRef != null ? String(rallyRef).trim() : ""
    if (!raw) return ""
    const charData = getChar({ name: raw })
    if (!charData) return ""
    const pic = getGamePictureRoot()
    const imgName = charData.name || ""
    const displayN = charData.displayName || charData.name || ""
    const rallyTipHtml =
      typeof window.buildRallyEffectTooltipHtml === "function"
        ? window.buildRallyEffectTooltipHtml(charData, { levelIndex: 1 })
        : ""
    const titleAttr = rallyTipHtml ? "" : ` title="${esc(displayN)}"`
    const wrapAttrs = rallyTipHtml ? ' data-has-rally-tip="1"' : ""
    const rallySource = rallyTipHtml
      ? `<div class="teams-rally-tip-source" hidden>${rallyTipHtml}</div>`
      : ""
    return `<div class="teams-leader">
      <div class="teams-subtitle">Leader</div>
      <div class="teams-leader-link-wrap"${wrapAttrs}>
        <span class="teams-leader-icon-wrap"${titleAttr} aria-label="${esc(displayN)}" role="img">
          <img src="${pic}/icons/cookie/${imgName}_head.png" alt="" class="teams-leader-icon" onerror="this.onerror=null;this.src='${pic}/icons/null.png'">
        </span>
        ${rallySource}
      </div>
    </div>`
  }

  function renderSquadLoadoutFooter(squad) {
    const leaderHtml = renderTeamLeader(squad?.rally)
    const treasures = sortTeamTreasures(Array.isArray(squad?.treasures) ? squad.treasures : [])
    const treasuresHtml = treasures.length
      ? `<div class="teams-treasures"><div class="teams-subtitle">Treasures</div><div class="teams-treasure-row">${treasures.map(renderTreasure).join("")}</div></div>`
      : ""
    if (!leaderHtml && !treasuresHtml) return ""
    return `<div class="teams-loadout-footer">${leaderHtml}${treasuresHtml}</div>`
  }

  function renderSquadBlock(squad, { showHeading, wrap, includeNotes = true }) {
    const heading = showHeading && squad.label
      ? `<h4 class="teams-squad-title">${esc(squad.label)}</h4>`
      : ""
    const slots = sortTeamSlots(normalizeCookieSlots(Array.isArray(squad.cookies) ? squad.cookies : []))
    const loadoutHtml = renderSquadLoadoutFooter(squad)
    const rowsHtml = slots.length
      ? slots.map(renderTeamMemberSlot).join("")
      : `<div class="teams-empty teams-empty--inline">No cookies listed yet.</div>`
    const mainHtml = `<div class="teams-build-rows">${rowsHtml}</div>${loadoutHtml}`
    const notesHtml = includeNotes ? renderSquadNotes(squad) : ""
    let bodyHtml = mainHtml
    if (notesHtml) {
      bodyHtml = `<div class="teams-squad-content">${mainHtml}</div>${notesHtml}`
    }
    if (!wrap) return bodyHtml
    const noteCls = notesHtml ? " teams-squad--with-notes" : ""
    return `<div class="teams-squad${noteCls}">${heading}${bodyHtml}</div>`
  }

  function renderTeams(ctx) {
    currentGameVersion = ctx?.gameVersion ?? null
    currentRenderFeatures = resolveRenderFeatures(currentGameVersion)
    const teams = Array.isArray(ctx?.teams) ? ctx.teams : []
    const headingHtml = renderEventHeading(ctx?.eventHeading)
    if (!teams.length) {
      contentEl.innerHTML = `${headingHtml}<div class="teams-empty">No teams added here yet.</div>`
      return
    }

    const generalNotes = Array.isArray(ctx?.notes) ? ctx.notes : []

    contentEl.innerHTML = headingHtml + teams.map(team => {
      const squads = normalizeTeamSquads(team)
      const usesSquadsArray = Array.isArray(team.squads) && team.squads.length > 0
      const multi = squads.length > 1
      let bodyHtml = `<div class="teams-empty teams-empty--inline">No cookies listed.</div>`
      if (squads.length === 1) {
        bodyHtml = renderSquadBlock(squads[0], {
          showHeading: !!squads[0].labelIsCustom,
          wrap: !!squads[0].labelIsCustom,
          includeNotes: usesSquadsArray,
        })
      } else if (squads.length > 1) {
        bodyHtml = squads.map(sq => renderSquadBlock(sq, { showHeading: true, wrap: true, includeNotes: true })).join("")
      }
      const teamNotesBlock = renderTeamEntryNotes(generalNotes, team, { multiSquad: multi })
      const sourceHtml = renderTeamSourceHtml(team.source)
      const multiClass = multi ? " teams-card--multi-squad" : ""
      return `<div class="teams-entry${teamNotesBlock ? " teams-entry--with-notes" : ""}">
        <article class="teams-card${multiClass}">
          <div class="teams-card-header">
            <h3 class="teams-card-title">${esc(team.name || "Unnamed Team")}</h3>
            ${sourceHtml}
          </div>
          ${multi ? `<div class="teams-card-body">${bodyHtml}</div>` : bodyHtml}
        </article>
        ${teamNotesBlock}
      </div>`
    }).join("")
    if (typeof initToppingGraphics === "function") initToppingGraphics(contentEl)
    if (typeof initTreasureGraphics === "function") initTreasureGraphics(contentEl)
    initTeamAltPickers(contentEl)
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

  function setActiveVersionButtons(activeIdx) {
    if (!versionTabsEl) return
    Array.from(versionTabsEl.querySelectorAll("button")).forEach(btn => {
      const on = Number(btn.dataset.verIdx) === activeIdx
      btn.classList.toggle("active", on)
      btn.setAttribute("aria-pressed", String(on))
    })
  }

  /** Array indices only — categories/sections use `name` in data, no `id` required. */
  let activeCategoryIdx = 0
  let activeSectionIdx = 0
  let activeVersionIdx = -1
  let teamsRestoring = false
  let saveScrollRaf = null

  const gameIdForTeams = getSelectedGameId()

  /* Sidebar “Teams” links use ?menu so each visit from the menu starts fresh (category/section/scroll). */
  try {
    const u = new URL(window.location.href)
    if (u.searchParams.has("menu")) {
      sessionStorage.removeItem(TEAMS_PAGE_STATE_KEY)
      u.searchParams.delete("menu")
      const qs = u.searchParams.toString()
      const next = u.pathname + (qs ? `?${qs}` : "") + u.hash
      history.replaceState({}, "", next)
    }
  } catch (_) { /* ignore */ }

  let savedScrollY = null
  try {
    const raw = sessionStorage.getItem(TEAMS_PAGE_STATE_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if (s && s.game === gameIdForTeams && Array.isArray(categories) && categories.length) {
        const c = Number(s.cat)
        if (Number.isInteger(c) && c >= 0 && c < categories.length) activeCategoryIdx = c
        const sec = Number(s.sec)
        if (Number.isInteger(sec) && sec >= 0) activeSectionIdx = sec
        const ver = Number(s.ver)
        if (Number.isInteger(ver) && ver >= 0) activeVersionIdx = ver
        const y = Number(s.y)
        if (Number.isFinite(y) && y >= 0) savedScrollY = y
      }
    }
  } catch (e) { /* ignore */ }

  function saveTeamsState(force) {
    if (teamsRestoring && !force) return
    try {
      const payload = {
        game: gameIdForTeams,
        cat: activeCategoryIdx,
        sec: activeSectionIdx,
        ver: activeVersionIdx,
        y: window.scrollY || 0
      }
      sessionStorage.setItem(TEAMS_PAGE_STATE_KEY, JSON.stringify(payload))
    } catch (e) { /* quota / private mode */ }
  }

  function onTeamsScroll() {
    if (saveScrollRaf) return
    saveScrollRaf = requestAnimationFrame(() => {
      saveScrollRaf = null
      saveTeamsState()
    })
  }
  window.addEventListener("scroll", onTeamsScroll, { passive: true })
  window.addEventListener("pagehide", () => saveTeamsState(true))
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveTeamsState(true)
  })

  function scheduleRestoreScroll(y) {
    if (y == null || !Number.isFinite(y) || y < 0) return
    teamsRestoring = true
    const go = () => {
      try {
        window.scrollTo(0, y)
      } catch (e) { /* ignore */ }
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        go()
        setTimeout(go, 50)
        setTimeout(go, 200)
        setTimeout(() => {
          teamsRestoring = false
          /* Persist scroll after layout so the next reload does not read y:0 from a pre-restore save. */
          saveTeamsState(true)
        }, 400)
      })
    })
  }

  function renderVersionTabs(section) {
    if (!versionTabsEl) return
    const versions = getSectionVersions(section)
    if (versions.length <= 1) {
      versionTabsEl.innerHTML = ""
      setVersionTabsVisible(false)
      return
    }

    setVersionTabsVisible(true)
    if (activeVersionIdx >= versions.length) activeVersionIdx = getDefaultVersionIdx(section)
    if (activeVersionIdx < 0) activeVersionIdx = 0

    versionTabsEl.innerHTML = versions.map((version, k) => {
      const label = getVersionLabel(version)
      return `<button type="button" class="teams-version-tab${k === activeVersionIdx ? " active" : ""}" data-ver-idx="${k}" aria-pressed="${k === activeVersionIdx}">${esc(label)}</button>`
    }).join("")

    versionTabsEl.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        activeVersionIdx = Number(btn.dataset.verIdx) || 0
        setActiveVersionButtons(activeVersionIdx)
        const cur = categories[activeCategoryIdx]
        const subs = getCategorySections(cur)
        const sec = subs[activeSectionIdx] || {}
        const content = resolveSectionContent(sec, activeVersionIdx)
        renderTeams(content)
        saveTeamsState(true)
      })
    })
    setActiveVersionButtons(activeVersionIdx)
  }

  /** Version tabs + teams for any node that uses `versions: [...]` (event, section, or top-level mode). */
  function renderVersionedTeamsContent(node) {
    if (!sectionUsesVersions(node)) return false
    const versions = getSectionVersions(node)
    if (!Number.isInteger(activeVersionIdx) || activeVersionIdx < 0 || activeVersionIdx >= versions.length) {
      activeVersionIdx = getDefaultVersionIdx(node)
    }
    renderVersionTabs(node)
    renderTeams(resolveSectionContent(node, activeVersionIdx))
    return true
  }

  function renderCurrentSectionContent(cat, section) {
    if (renderVersionedTeamsContent(section)) return
    setVersionTabsVisible(false)
    if (versionTabsEl) versionTabsEl.innerHTML = ""
    renderTeams(resolveSectionContent(section, 0))
  }

  function getCategoryEmptyMessage(cat) {
    if (cat?.eventFilter === "active") return "No active events right now."
    if (cat?.eventFilter === "inactive") return "No archived events yet."
    return "No teams added here yet."
  }

  function renderSections() {
    const cat = categories[activeCategoryIdx]
    if (!cat) {
      sectionTabsEl.innerHTML = ""
      setSectionSubtabsVisible(false)
      setVersionTabsVisible(false)
      contentEl.innerHTML = `<div class="teams-empty">No data.</div>`
      return
    }

    const sections = getCategorySections(cat)

    if (!categoryHasSectionTabs(cat)) {
      sectionTabsEl.innerHTML = ""
      setSectionSubtabsVisible(false)
      if (isEventCategory(cat)) {
        setVersionTabsVisible(false)
        contentEl.innerHTML = `<div class="teams-empty">${esc(getCategoryEmptyMessage(cat))}</div>`
        return
      }
      if (renderVersionedTeamsContent(cat)) return
      setVersionTabsVisible(false)
      if (versionTabsEl) versionTabsEl.innerHTML = ""
      const flat = Array.isArray(cat.teams) ? cat.teams : []
      const parentNotes = Array.isArray(cat.notes) ? cat.notes : []
      renderTeams({ teams: flat, notes: parentNotes })
      return
    }

    setSectionSubtabsVisible(true)
    if (sectionLabelEl) {
      sectionLabelEl.textContent = isEventCategory(cat) ? "Events" : "Section"
    }
    if (activeSectionIdx >= sections.length) activeSectionIdx = 0
    if (activeSectionIdx < 0) activeSectionIdx = 0

    sectionTabsEl.innerHTML = sections.map((section, j) => {
      const label = section.name && String(section.name).trim() ? section.name : `Section ${j + 1}`
      return `<button type="button" class="teams-subtab${j === activeSectionIdx ? " active" : ""}" data-sec-idx="${j}" aria-pressed="${j === activeSectionIdx}">${esc(label)}</button>`
    }).join("")

    sectionTabsEl.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        activeSectionIdx = Number(btn.dataset.secIdx) || 0
        activeVersionIdx = getDefaultVersionIdx(sections[activeSectionIdx] || {})
        setActiveSectionButtons(activeSectionIdx)
        renderCurrentSectionContent(cat, sections[activeSectionIdx] || {})
        saveTeamsState(true)
      })
    })
    setActiveSectionButtons(activeSectionIdx)
    renderCurrentSectionContent(cat, sections[activeSectionIdx] || {})
  }

  function renderCategories() {
    if (!categories.length) {
      categoryTabsEl.innerHTML = ""
      sectionTabsEl.innerHTML = ""
      setSectionSubtabsVisible(false)
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
        activeVersionIdx = -1
        setActiveCategoryButtons(activeCategoryIdx)
        renderSections()
        saveTeamsState(true)
      })
    })
    setActiveCategoryButtons(activeCategoryIdx)
    renderSections()
  }

  function bootTeamsPage() {
    renderCategories()
    if (savedScrollY != null && Number.isFinite(savedScrollY) && savedScrollY >= 0) {
      scheduleRestoreScroll(savedScrollY)
    } else {
      saveTeamsState(true)
    }
  }

  currentResonanceUpdateMap = {}
  if (typeof loadResonanceUpdateMap === "function") {
    void loadResonanceUpdateMap().then((map) => {
      currentResonanceUpdateMap = map || {}
      renderSections()
    })
  }
  bootTeamsPage()
})()
