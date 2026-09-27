/**
 * Cookie Run: Crumble — skill section (icon, CD, description, per-level details).
 */
;(function () {
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

  function skillLevelCount(skillAttr) {
    let max = 1
    const attrs = skillAttr && typeof skillAttr === "object" ? skillAttr : {}
    for (const arr of Object.values(attrs)) {
      if (Array.isArray(arr) && arr.length > max) max = arr.length
    }
    return max
  }

  function isPercentAttrContext(block, matchIndex, matchLength) {
    const after = block.slice(matchIndex + matchLength)
    if (/^\s*%/.test(after)) return true
    if (/^\s*of (?:Caster )?ATK\b/i.test(after)) return true
    return false
  }

  function formatAttrValue(v, asPercent = false) {
    if (v == null || v === "") return ""
    if (typeof v === "number") {
      const s = String(v)
      if (asPercent || s.includes(".")) return `${s}%`
      return s
    }
    return String(v)
  }

  function attrValueAt(skillAttr, key, levelIdx, asPercent = false) {
    const attrs = skillAttr && typeof skillAttr === "object" ? skillAttr : {}
    const arr = attrs[key]
    if (!Array.isArray(arr) || !arr.length) return `%{${key}}`
    const i = Math.max(0, Math.min(levelIdx, arr.length - 1))
    return formatAttrValue(arr[i], asPercent)
  }

  function parseDetailBlocks(details) {
    return String(details || "")
      .split(/(?:<br\s*\/?>|\r?\n)/gi)
      .map((block) => block.trim())
      .filter(Boolean)
  }

  function renderDetailBlockHtml(block, skillAttr, levelIdx) {
    const lower = block.toLowerCase()
    if (lower === "<hr>" || lower === "<hr/>" || lower === "<hr />") {
      return '<hr class="char-skill-detail-hr">'
    }

    const attrValues = []
    const boldTexts = []
    let raw = block.replace(/%\{(attr\d+)\}/g, (full, key, offset) => {
      const idx = attrValues.length
      const asPercent = isPercentAttrContext(block, offset, full.length)
      attrValues.push(attrValueAt(skillAttr, key, levelIdx, asPercent))
      return `§A${idx}§`
    })
    raw = raw.replace(/'''([^']+)'''/g, (_, text) => {
      const idx = boldTexts.length
      boldTexts.push(text)
      return `§B${idx}§`
    })

    let body = _esc(raw)
      .replace(/&lt;hr&gt;/gi, '<hr class="char-skill-detail-hr">')

    attrValues.forEach((val, idx) => {
      body = body.replace(
        `§A${idx}§`,
        `<span class="crc-skill-attr-value">${_esc(String(val))}</span>`
      )
    })
    boldTexts.forEach((text, idx) => {
      body = body.replace(`§B${idx}§`, `<strong>${_esc(text)}</strong>`)
    })

    return `<div class="char-skill-details-line">${body}</div>`
  }

  function renderSkillDetailsHtml(details, skillAttr, levelIdx) {
    return parseDetailBlocks(details)
      .map((block) => renderDetailBlockHtml(block, skillAttr, levelIdx))
      .join("")
  }

  function renderSkillDescriptionHtml(desc) {
    const lines = parseDetailBlocks(desc)
    if (!lines.length) return ""
    return lines
      .map((line) => `<div class="char-skill-description-line">${_esc(line)}</div>`)
      .join("")
  }

  function renderCrcSkillSection(charData, name, picRoot = "pictures") {
    const section = document.getElementById("char-skill-section")
    if (!section) return

    if (!charData?.skill) {
      section.hidden = true
      section.innerHTML = ""
      return
    }

    section.hidden = false
    const skillName = charData.skill
    const cd = charData.cd
    const descData = window.CRC_DESCRIPTIONS || {}
    const skillDesc = String(descData.skill_description?.[name] || charData?.skillDesc || "").trim()
    const skillDetails = String(descData.skill_details?.[name] || charData?.skillDetails || "").trim()
    const skillAttr = charData.skillAttr || {}
    const iconSrc = `${picRoot}/skills/${_urlFile(`${name}_skill.png`)}`
    const hasDetails = !!skillDetails
    const levelCount = hasDetails ? skillLevelCount(skillAttr) : 0

    const cdHtml = cd != null
      ? `<span class="char-skill-cd-pills"><span class="char-skill-cd-pill">${cd} sec</span></span>`
      : ""

    const descHtml = skillDesc
      ? `<div class="char-skill-description">${renderSkillDescriptionHtml(skillDesc)}</div>`
      : ""

    const tabsHtml = hasDetails && levelCount > 1
      ? `<div class="crc-skill-level-tabs" role="tablist">${Array.from({ length: levelCount }, (_, i) =>
          `<button type="button" class="crc-skill-level-tab${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0 ? "true" : "false"}" data-level="${i}">${i + 1}</button>`
        ).join("")}</div>`
      : ""

    const detailsPane = hasDetails
      ? `<div class="char-skill-details crc-skill-details-pane" data-crc-details-pane role="tabpanel">${renderSkillDetailsHtml(skillDetails, skillAttr, 0)}</div>`
      : ""

    section.innerHTML = `
      <div class="char-skill-section-header">
        <h3 class="char-section-title">Skill</h3>
        <div class="char-section-divider"></div>
      </div>
      <div class="char-skill-wrapper">
        <div class="char-skill-bubble">
          <div class="char-skill-content">
            <div class="char-skill-box">
              <div class="char-skill-header">
                <img class="char-skill-icon" src="${iconSrc}" alt="" onerror="${_imgErrHide}">
                <div class="char-skill-name-wrap">
                  ${cdHtml}
                  <span class="char-skill-name">${_esc(skillName)}</span>
                </div>
              </div>
              ${descHtml}
              ${tabsHtml}
              ${detailsPane}
            </div>
          </div>
        </div>
      </div>`

    if (!hasDetails || levelCount <= 1) return

    const pane = section.querySelector("[data-crc-details-pane]")
    const tabs = section.querySelectorAll(".crc-skill-level-tab")
    let activeLevel = 0

    const syncLevel = () => {
      tabs.forEach((tab) => {
        const idx = Number(tab.dataset.level)
        const on = idx === activeLevel
        tab.classList.toggle("is-active", on)
        tab.setAttribute("aria-selected", on ? "true" : "false")
      })
      if (pane) {
        pane.innerHTML = renderSkillDetailsHtml(skillDetails, skillAttr, activeLevel)
      }
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activeLevel = Number(tab.dataset.level)
        if (Number.isNaN(activeLevel)) return
        syncLevel()
      })
    })
  }

  window.renderCrcSkillSection = renderCrcSkillSection
})()
