/**
 * Cookie Run: Crumble — character page UI.
 */
;(function () {
  const UI_STATE_KEY = "tierlistUIState"
  const GAME_ID = "crc"
  const _imgErrHide = "this.style.display='none'"

  function _esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function _urlFile(name) {
    return encodeURIComponent(name).replace(/%2F/gi, "/")
  }

  function getCharacterFromURL() {
    return new URLSearchParams(window.location.search).get("char")
  }

  function ensureCrcGameSelected() {
    try {
      const s = JSON.parse(localStorage.getItem(UI_STATE_KEY) || "{}")
      if (s.game !== GAME_ID) {
        localStorage.setItem(UI_STATE_KEY, JSON.stringify({ ...s, game: GAME_ID }))
      }
    } catch {}
  }

  function getGamePictureRoot() {
    return "pictures"
  }

  function getPageImagePath(name) {
    return `${getGamePictureRoot()}/chars/${_urlFile(`${name}_illustration.png`)}`
  }

  function formatReleaseDateDisplay(raw) {
    const s = String(raw || "").trim()
    if (!s) return ""
    const paren = s.indexOf("(")
    if (paren > 0) return s.slice(0, paren).trim()
    return s
  }

  function formatReleaseRelativeAgo(raw) {
    const display = formatReleaseDateDisplay(raw)
    if (!display) return ""
    const start = new Date(display)
    if (Number.isNaN(start.getTime())) return ""
    const now = new Date()
    if (start > now) return ""

    let years = now.getFullYear() - start.getFullYear()
    let months = now.getMonth() - start.getMonth()
    let days = now.getDate() - start.getDate()
    if (days < 0) {
      months -= 1
      days += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
    }
    if (months < 0) {
      years -= 1
      months += 12
    }

    const parts = []
    if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`)
    if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`)
    if (days > 0 || parts.length === 0) parts.push(`${days} day${days === 1 ? "" : "s"}`)
    return `${parts.join(", ")} ago`
  }

  function renderDescriptionSection(charData, name) {
    const el = document.getElementById("char-description")
    if (!el) return

    const displayName = charData?.displayName ?? name
    const descData = window.CRC_DESCRIPTIONS || {}
    const description = String(descData.description?.[name] || charData?.description || "").trim()
    const descriptionBody = description
      ? _esc(description).replace(/&lt;br\s*\/?&gt;/gi, "<br>")
      : ""
    const descriptionHtml = descriptionBody
      ? `<div class="char-desc-divider"></div><div class="char-description-text">${descriptionBody}</div>`
      : ""

    el.innerHTML = `
      <h2 class="char-title">${_esc(displayName)}</h2>
      ${descriptionHtml}
    `
  }

  function renderInfoBox(charData) {
    const infoBox = document.getElementById("char-info-box")
    if (!infoBox || !charData) {
      if (infoBox) infoBox.innerHTML = ""
      return
    }

    const pic = getGamePictureRoot()
    const rarity = charData.rarity || ""
    const role = charData.role || ""
    const element = charData.element || ""
    const elements = Array.isArray(element) ? element : (element ? [element] : [])

    const rarityIconPath = rarity ? `${pic}/icons/${_urlFile(`${rarity}.png`)}` : ""
    const roleRow = role
      ? `<div class="char-stat-pill"><img src="${pic}/icons/${_urlFile(`${role}.png`)}" alt="" onerror="${_imgErrHide}"><span>${_esc(role)}</span></div>`
      : ""
    const elemRows = elements.map((e) =>
      `<div class="char-stat-pill"><img src="${pic}/icons/${_urlFile(`${e}.png`)}" alt="" onerror="${_imgErrHide}"><span>${_esc(e)}</span></div>`
    ).join("")

    infoBox.innerHTML = `
      ${rarity ? `<img class="char-rarity-icon char-rarity-icon--square" src="${rarityIconPath}" alt="${_esc(rarity)}" title="${_esc(rarity)}" onerror="${_imgErrHide}">` : ""}
      <div class="char-stats-row">
        ${roleRow}
        ${elemRows}
      </div>
    `
  }

  function synergyTypesHtml(types, direction) {
    if (!types.length) {
      return `<div class="char-synergy-none">None</div>`
    }
    const pic = getGamePictureRoot()
    const badge = typeof crcSynergyBadgeHtml === "function" ? crcSynergyBadgeHtml : null
    return `<div class="char-synergy-badges">${types.map((type) =>
      badge ? badge(type, direction, pic) : `<span class="char-synergy-fallback">${_esc(type)}</span>`
    ).join("")}</div>`
  }

  function splitSynergies(charData) {
    const synergies = Array.isArray(charData?.synergy) ? charData.synergy : []
    const granted = []
    const received = []
    for (const s of synergies) {
      const type = String(s?.type || "").trim()
      if (!type) continue
      if (s.recipient) received.push(type)
      else granted.push(type)
    }
    return { granted, received }
  }

  function renderSynergySection(charData) {
    const el = document.getElementById("char-synergy-info")
    if (!el) return

    const { granted, received } = splitSynergies(charData)

    el.innerHTML = `<div class="char-synergy-inner">
      <h3 class="char-synergy-heading">Synergy</h3>
      <div class="char-synergy-subsection">
        <h4 class="char-synergy-subheading">Granted</h4>
        ${synergyTypesHtml(granted, "granted")}
      </div>
      <div class="char-synergy-subsection">
        <h4 class="char-synergy-subheading">Received</h4>
        ${synergyTypesHtml(received, "received")}
      </div>
    </div>`
  }

  function renderReleaseInfoSection(charData, name) {
    const el = document.getElementById("char-release-info")
    if (!el || !charData) return

    const dateDisplay = formatReleaseDateDisplay(charData.releaseDate)
    if (!dateDisplay) {
      el.hidden = true
      el.innerHTML = ""
      return
    }

    const ago = formatReleaseRelativeAgo(charData.releaseDate)
    let line = _esc(dateDisplay)
    if (ago) line += ` <span class="char-release-ago">(${_esc(ago)})</span>`

    el.hidden = false
    el.innerHTML = `<div class="char-release-inner">
      <h3 class="char-release-heading">Release Date</h3>
      <div class="char-release-line">${line}</div>
    </div>`
  }

  function renderCharacterPage() {
    ensureCrcGameSelected()

    const name = getCharacterFromURL()
    if (!name) return

    const game = (window.CRK_DATA?.games || []).find(g => g && g.id === GAME_ID)
    const charData = game?.characters?.find(c => c.name === name) || null

    document.title = charData?.displayName ?? name

    const img = document.getElementById("char-image")
    if (img) {
      img.src = getPageImagePath(name)
      img.alt = charData?.displayName ?? name
      img.decoding = "async"
      if ("fetchPriority" in img) img.fetchPriority = "high"
      img.onerror = function () {
        this.onerror = null
        this.style.display = "none"
      }
    }

    renderDescriptionSection(charData, name)
    renderInfoBox(charData)
    renderSynergySection(charData)
    renderReleaseInfoSection(charData, name)
    if (typeof renderCrcSkillSection === "function") {
      renderCrcSkillSection(charData, name, getGamePictureRoot())
    }

    window.dispatchEvent(new Event("crkSettingsChanged"))
  }

  if (typeof whenGamesReady === "function") {
    whenGamesReady(renderCharacterPage)
  } else {
    renderCharacterPage()
  }
})()
