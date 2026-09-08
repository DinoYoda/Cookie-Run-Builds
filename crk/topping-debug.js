(function () {
  const TOPPING_TYPES = [
    "raspberry", "chocolate", "applejelly", "caramel", "kiwi",
    "candy", "walnut", "almond", "hazelnut", "peanut",
  ]

  const RESONANCE_SAMPLES = [
    "truth", "silent", "blooming", "passionate", "destructive",
    "crossed_fates", "smithy", "deceit", "dragonwind", "ancient_root",
  ]

  const REF_TYPE = "raspberry"

  const BUILD_SAMPLES = [
    {
      label: "Resonant Truth (APV-style)",
      set: {
        resonance: "Truth",
        1: "raspberry", 2: "raspberry", 3: "raspberry", 4: "raspberry", 5: "raspberry", 6: "raspberry",
      },
      substats: ["DMG Resist", "Cooldown", "ATK"],
    },
    {
      label: "Resonant Silent (Silent Salt-style)",
      set: {
        resonance: "Silent",
        1: "raspberry", 2: "raspberry", 3: "raspberry", 4: "raspberry", 5: "raspberry", 6: "raspberry",
      },
      substats: ["Cooldown", "DMG Resist", "ATK"],
    },
    {
      label: "Non-resonant mixed",
      set: {
        1: "almond", 2: "almond", 3: "almond", 4: "raspberry", 5: "raspberry", 6: "raspberry",
      },
      substats: ["Cooldown", "DMG Resist", "HP"],
    },
    {
      label: "Arena peanut (no resonance)",
      set: {
        1: "peanut", 2: "peanut", 3: "peanut", 4: "peanut", 5: "peanut", 6: "peanut",
      },
      substats: ["Cooldown", "DMG Resist", "HP"],
    },
    {
      label: "Legendary tart + bonus effect",
      set: {
        resonance: "Truth",
        1: "raspberry", 2: "raspberry", 3: "raspberry", 4: "raspberry", 5: "raspberry", 6: "raspberry",
      },
      substats: ["DMG Resist", "Cooldown", "ATK"],
      bonusEffect: "+12% ATK",
    },
  ]

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
  }

  function basePath(type, rarity) {
    const pic = getGamePictureRoot()
    return `${pic}/toppings/${type}/Topping_${type}_${rarity}.png`
  }

  function cellHtml(label, src, extraClass) {
    const cls = extraClass ? ` ${extraClass}` : ""
    return `<div class="topping-debug-cell">
      <div class="char-toppings-row char-toppings-row--no-tart topping-debug-sample-row">
        <div class="char-toppings-plate">
          <div class="char-toppings-items">
            <div class="char-topping-star-slot">
              <div class="char-topping-graphic">
                <img src="${esc(src)}" alt="${esc(label)}" class="char-topping-item topping-debug-img${cls}" loading="eager" decoding="async" onerror="${_imgErrToppingAttr()}">
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="topping-debug-meta">
        <div class="topping-debug-label">${esc(label)}</div>
        <div class="topping-debug-dims">…</div>
      </div>
    </div>`
  }

  function rowHtml(cells) {
    return `<div class="topping-debug-row">${cells.join("")}</div>`
  }

  function sectionHtml(title, bodyHtml, note) {
    return `<section class="topping-debug-section">
      <h2 class="topping-debug-section-title">${esc(title)}</h2>
      ${note ? `<p class="topping-debug-note">${esc(note)}</p>` : ""}
      ${bodyHtml}
    </section>`
  }

  const TEAMS_BUILD_SAMPLES = [
    {
      label: "Resonant Truth (teams markup)",
      set: {
        resonance: "Truth",
        1: "raspberry", 2: "raspberry", 3: "raspberry", 4: "raspberry", 5: "raspberry", 6: "raspberry",
      },
      substats: ["DMG Resist", "Cooldown", "ATK"],
    },
    {
      label: "Arena peanut (teams markup)",
      set: {
        1: "peanut", 2: "peanut", 3: "peanut", 4: "peanut", 5: "peanut", 6: "peanut",
      },
      substats: ["Cooldown", "DMG Resist", "HP"],
    },
    {
      label: "Legendary tart + bonus (teams markup)",
      set: {
        resonance: "Truth",
        1: "raspberry", 2: "raspberry", 3: "raspberry", 4: "raspberry", 5: "raspberry", 6: "raspberry",
      },
      substats: ["DMG Resist", "Cooldown", "ATK"],
      bonusEffect: "+12% ATK",
    },
  ]

  function buildToppingBlockOptions(sample) {
    return {
      substats: sample.substats,
      bonusEffect: sample.bonusEffect,
    }
  }

  function renderTeamsCardPreview(sample) {
    const { starHtml, substatsHtml, bonusEffectHtml } = buildToppingsSetBlockHtml(sample.set, buildToppingBlockOptions(sample))
    const subHtml = substatsHtml
      ? `<div class="teams-build-row-substats char-build-substats">${substatsHtml}</div>`
      : ""
    const bonusHtml = bonusEffectHtml || ""
    const detailsHtml = (subHtml || bonusHtml)
      ? `<div class="teams-build-toppings-details char-build-toppings-details">${subHtml}${bonusHtml}</div>`
      : ""
    return `<div class="teams-build-row topping-debug-teams-row" style="pointer-events:none">
      <div class="teams-build-row-cookie">
        <div class="teams-build-row-cookie-text">
          <div class="teams-member-name">${esc(sample.label)}</div>
          <div class="teams-member-build">Preview build</div>
        </div>
      </div>
      <div class="teams-build-row-gear">
        <div class="teams-build-toppings-group">
          <div class="teams-build-row-star">${starHtml}</div>
          ${detailsHtml}
        </div>
      </div>
    </div>`
  }

  function renderBuildSamples() {
    return sectionHtml(
      "Production build rows",
      BUILD_SAMPLES.map((sample) => {
        const { starHtml } = buildToppingsSetBlockHtml(sample.set, buildToppingBlockOptions(sample))
        return `<div class="topping-debug-build-block">
          <h3 class="topping-debug-subtitle">${esc(sample.label)}</h3>
          <div class="char-build-toppings-main topping-debug-build-main">${starHtml}</div>
        </div>`
      }).join(""),
      "Rendered via buildToppingsSetBlockHtml — character page markup.",
    )
  }

  function renderTeamsPreviews() {
    const cards = TEAMS_BUILD_SAMPLES.map((sample) =>
      `<div class="topping-debug-teams-block">${renderTeamsCardPreview(sample)}</div>`,
    ).join("")
    return sectionHtml(
      "Teams card preview",
      `<div class="teams-page topping-debug-teams-host">${cards}</div>`,
      "Same DOM/CSS as crk/teams.html. Topping width = plate size × 50÷180 (tart is the plate).",
    )
  }

  function renderBaseRarities() {
    const cells = ["1", "2", "3"].map((r) =>
      cellHtml(`${REF_TYPE} epic ${r}`, basePath(REF_TYPE, r)),
    )
    return sectionHtml("Base rarities", rowHtml(cells), `Reference type: ${REF_TYPE}.`)
  }

  function renderResonantVariants() {
    const cells = RESONANCE_SAMPLES.map((res) => {
      const src = getToppingImagePath(REF_TYPE, res, false, false)
      return cellHtml(`${REF_TYPE} / ${res}`, src)
    })
    return sectionHtml("Resonant variants (one type)", rowHtml(cells))
  }

  function renderAllTypesEpic() {
    const cells = TOPPING_TYPES.map((type) =>
      cellHtml(`${type} ×3`, basePath(type, "3")),
    )
    return sectionHtml("All topping types (epic)", `<div class="topping-debug-grid">${cells.join("")}</div>`)
  }

  function renderResonantMatrix() {
    const pick = ["truth", "silent", "blooming"]
    const types = ["raspberry", "peanut", "candy", "almond"]
    const rows = types.map((type) => {
      const cells = pick.map((res) => {
        const src = getToppingImagePath(type, res, false, false)
        return cellHtml(`${type} / ${res}`, src)
      })
      return rowHtml(cells)
    })
    return sectionHtml(
      "Resonance × type matrix",
      rows.join(""),
      "All toppings use a fixed silent-sized outline box (102×149). At a 180px tart, slot width is 50.",
    )
  }

  function renderTarts() {
    const pic = getGamePictureRoot()
    const cells = TOPPING_TYPES.slice(0, 4).flatMap((type) => [
      cellHtml(`${type} tart 3`, `${pic}/toppings/tart/Topping_tart_${type}_3.png`),
      cellHtml(`${type} tart 4`, `${pic}/toppings/tart/Topping_tart_${type}_4.png`),
    ])
    return sectionHtml(
      "Tart slot art",
      rowHtml(cells),
      "Full plate size on build rows uses --char-topping-plate-size; these cells show raw tart PNGs at display height for file comparison.",
    )
  }

  function renderSelectables() {
    const cells = RESONANCE_SAMPLES.slice(0, 8).map((res) => {
      const src = getResonantSelectableImagePath(res)
      return cellHtml(`selectable / ${res}`, src, "topping-debug-selectable")
    })
    return sectionHtml(
      "Selectable resonant icons",
      rowHtml(cells),
      "Separate asset path (character resonant list). Sized independently from build rows.",
    )
  }

  function reportDims(root) {
    root.querySelectorAll(".topping-debug-build-block").forEach((block) => {
      const imgs = block.querySelectorAll(".char-topping-item, .char-topping-tart-base")
      let dimsEl = block.querySelector(".topping-debug-build-dims")
      if (!dimsEl) {
        dimsEl = document.createElement("div")
        dimsEl.className = "topping-debug-dims topping-debug-build-dims"
        block.appendChild(dimsEl)
      }
      const lines = Array.from(imgs).map((img, i) => {
        const graphic = img.closest(".char-topping-graphic")
        const target = graphic || img
        const r = target.getBoundingClientRect()
        const file = img.naturalWidth && img.naturalHeight
          ? `${img.naturalWidth}×${img.naturalHeight}`
          : "?"
        const label = img.alt || `slot ${i + 1}`
        return `${label}: graphic ${r.width.toFixed(2)}×${r.height.toFixed(2)} (file ${file})`
      })
      dimsEl.textContent = lines.join(" · ")
    })

    root.querySelectorAll(".topping-debug-teams-block").forEach((block) => {
      const row = block.querySelector(".teams-build-row")
      const plate = block.querySelector(".char-toppings-plate")
      const imgs = block.querySelectorAll(".char-topping-item")
      let dimsEl = block.querySelector(".topping-debug-teams-dims")
      if (!dimsEl) {
        dimsEl = document.createElement("div")
        dimsEl.className = "topping-debug-dims topping-debug-teams-dims"
        block.appendChild(dimsEl)
      }
      const gear = row ? getComputedStyle(row).getPropertyValue("--teams-gear-size").trim() : "?"
      const plateR = plate ? plate.getBoundingClientRect() : null
      const lines = [`gear ${gear}${plateR ? ` · plate ${plateR.width.toFixed(1)}×${plateR.height.toFixed(1)}` : ""}`]
      imgs.forEach((img, i) => {
        const graphic = img.closest(".char-topping-graphic")
        const target = graphic || img
        const r = target.getBoundingClientRect()
        lines.push(`${img.alt || `slot ${i + 1}`}: ${r.width.toFixed(2)}×${r.height.toFixed(2)}`)
      })
      dimsEl.textContent = lines.join(" · ")
    })

    root.querySelectorAll(".topping-debug-cell .char-topping-item").forEach((img) => {
      const dimsEl = img.closest(".topping-debug-cell")?.querySelector(".topping-debug-dims")
      if (!dimsEl) return
      const graphic = img.closest(".char-topping-graphic")
      const target = graphic || img
      const r = target.getBoundingClientRect()
      const file = img.naturalWidth && img.naturalHeight
        ? `${img.naturalWidth}×${img.naturalHeight}`
        : "?"
      dimsEl.textContent = `file ${file} · graphic ${r.width.toFixed(2)}×${r.height.toFixed(2)}${img.dataset.graphicBounds ? ` (${img.dataset.graphicBounds})` : ""}`
    })
  }

  function bindDimReporting(root) {
    root.querySelectorAll("img").forEach((img) => {
      const run = () => reportDims(root)
      if (img.complete) run()
      else img.addEventListener("load", run)
    })
  }

  function bindWidthControl() {
    const slider = document.getElementById("toppingDebugWidth")
    const out = document.getElementById("toppingDebugWidthOut")
    if (!slider || !out) return

    const apply = () => {
      const w = parseFloat(slider.value)
      out.textContent = String(w)
      const root = document.getElementById("toppingDebugRoot")
      if (!root) return
      root.querySelectorAll(".char-toppings-row").forEach((row) => {
        if (row.closest(".topping-debug-teams-host")) return
        row.style.setProperty("--char-topping-graphic-w-at-ref", String(w))
      })
      root.querySelectorAll(".char-topping-item").forEach((img) => {
        delete img.dataset.graphicFit
        img.style.width = ""
        img.style.height = ""
        img.style.marginLeft = ""
        img.style.marginTop = ""
      })
      root.querySelectorAll(".char-topping-graphic").forEach((g) => {
        g.style.width = ""
        g.style.height = ""
      })
      if (typeof initToppingGraphics === "function") initToppingGraphics(root)
      reportDims(root)
    }

    slider.addEventListener("input", apply)
    apply()
  }

  function bindGearSizeControl() {
    const slider = document.getElementById("toppingDebugGearSize")
    const out = document.getElementById("toppingDebugGearSizeOut")
    if (!slider || !out) return

    const apply = () => {
      const sizePx = `${parseFloat(slider.value)}px`
      out.textContent = sizePx
      const root = document.getElementById("toppingDebugRoot")
      if (!root) return
      root.querySelectorAll(".topping-debug-teams-row").forEach((row) => {
        row.style.setProperty("--teams-gear-size", sizePx)
      })
      root.querySelectorAll(".topping-debug-teams-host .char-topping-item").forEach((img) => {
        delete img.dataset.graphicFit
      })
      if (typeof initToppingGraphics === "function") initToppingGraphics(root)
      reportDims(root)
    }

    slider.addEventListener("input", apply)
    apply()
  }

  function render() {
    const root = document.getElementById("toppingDebugRoot")
    if (!root) return

    root.innerHTML = [
      renderTeamsPreviews(),
      renderBuildSamples(),
      renderBaseRarities(),
      renderResonantVariants(),
      renderResonantMatrix(),
      renderAllTypesEpic(),
      renderTarts(),
      renderSelectables(),
    ].join("")

    if (typeof initToppingGraphics === "function") initToppingGraphics(root)
    bindDimReporting(root)
    bindWidthControl()
    bindGearSizeControl()
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render)
  } else {
    render()
  }
})()
