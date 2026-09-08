/**
 * Shared sidebar settings (localStorage tierlistUIState), CN-exclusive cookie visibility,
 * and beta-tagged cookie visibility.
 * Gear button (bottom of sidebar) opens a panel similar to the game selector menu.
 */
;(function (global) {
  const UI_STATE_KEY = "tierlistUIState"

  const GEAR_SVG =
    '<svg class="sidebar-settings-gear-svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.51.51 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22l-1.92 3.32a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.05.63-.05.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>' +
    "</svg>"

  function readUIState() {
    try {
      return JSON.parse(localStorage.getItem(UI_STATE_KEY) || "{}")
    } catch {
      return {}
    }
  }

  function writeUIState(partial) {
    const s = Object.assign(readUIState(), partial)
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(s))
  }

  /** Opt-in: off until the user enables; `true`/`false` is stored in tierlistUIState. */
  function getShowCnExCookies() {
    return readUIState().showCnExCookies === true
  }

  /** Whole cookie is CN-exclusive (`cnEx: true`), not partial flags like `{ mcSkill: true }`. */
  function isCnExclusiveCookie(c) {
    return c?.cnEx === true
  }

  /** Magic Candy skill is CN-only for this cookie (`cnEx: { mcSkill: true }`). */
  function isCnExclusiveMcSkill(c) {
    const ex = c?.cnEx
    return !!(ex && typeof ex === "object" && ex.mcSkill)
  }

  function shouldRenderMcSkill(c) {
    if (!c?.mcSkill) return false
    if (isCnExclusiveMcSkill(c) && !getShowCnExCookies()) return false
    return true
  }

  /** When CN-exclusive cookies setting is on, use cnEx.skillAttr / CRK_CN_DESCRIPTIONS if present. */
  function shouldUseCnSkillVariant(charData, cnDescData, slug) {
    if (!getShowCnExCookies()) return false
    const cnAttr = charData?.cnEx?.skillAttr
    if (cnAttr && typeof cnAttr === "object" && Object.keys(cnAttr).length > 0) return true
    if (cnDescData?.skill_details?.[slug]) return true
    if (cnDescData?.skill_notes?.[slug]) return true
    if (cnDescData?.rally_effects?.[slug]) return true
    return false
  }

  function getActiveNormalSkillContext(charData, descData, cnDescData, slug) {
    const useCn = shouldUseCnSkillVariant(charData, cnDescData, slug)
    const skillDescData = useCn ? cnDescData : descData
    return {
      useCn,
      skillAttr: useCn ? (charData?.cnEx?.skillAttr ?? charData?.skillAttr) : charData?.skillAttr,
      skillDescData,
      slug,
    }
  }

  function characterPassesCnExFilter(c) {
    if (!c || !isCnExclusiveCookie(c)) return true
    return getShowCnExCookies()
  }

  /** Opt-in: off until the user enables; `true`/`false` is stored in tierlistUIState. */
  function getShowBetaCookies() {
    return readUIState().showBetaCookies === true
  }

  /** When on, New Legendary / New Dragon sort with Legendary / Dragon (in-game rarity bands). */
  function getSortInGameOrder() {
    return readUIState().sortInGameOrder === true
  }

  function characterPassesBetaFilter(c) {
    if (!c || !c.beta) return true
    return getShowBetaCookies()
  }

  global.getShowCnExCookies = getShowCnExCookies
  global.isCnExclusiveCookie = isCnExclusiveCookie
  global.isCnExclusiveMcSkill = isCnExclusiveMcSkill
  global.shouldRenderMcSkill = shouldRenderMcSkill
  global.shouldUseCnSkillVariant = shouldUseCnSkillVariant
  global.getActiveNormalSkillContext = getActiveNormalSkillContext
  global.characterPassesCnExFilter = characterPassesCnExFilter
  global.getShowBetaCookies = getShowBetaCookies
  global.characterPassesBetaFilter = characterPassesBetaFilter
  global.getSortInGameOrder = getSortInGameOrder

  function closePanel(gear, panel) {
    panel.classList.remove("open")
    gear.classList.remove("open")
    gear.setAttribute("aria-expanded", "false")
  }

  function injectSidebarSettings() {
    const sb = document.getElementById("sidebar")
    if (!sb || sb.dataset.crkSettingsInjected) return
    sb.dataset.crkSettingsInjected = "1"

    const spacer = document.createElement("div")
    spacer.className = "sidebar-flex-spacer"
    spacer.setAttribute("aria-hidden", "true")

    const dock = document.createElement("div")
    dock.className = "sidebar-settings-dock"
    // List: .sidebar-setting-item wraps each toggle. Inside: <label class="sidebar-setting-row"> with
    // .sidebar-setting-name + .sidebar-setting-switch. Optional <p class="sidebar-setting-blurb"> after the label.
    dock.innerHTML =
      '<button type="button" class="sidebar-settings-gear" id="sidebarSettingsGear" ' +
      'aria-expanded="false" aria-controls="sidebarSettingsPanel" aria-label="Open settings menu">' +
      GEAR_SVG +
      "</button>" +
      '<div class="sidebar-settings-panel" id="sidebarSettingsPanel" role="menu" aria-label="Settings">' +
      '<div class="sidebar-settings-panel-header">Settings</div>' +
      '<div class="sidebar-settings-panel-body">' +
      '<div class="sidebar-setting-item">' +
      '<label class="sidebar-setting-row">' +
      '<span class="sidebar-setting-name">CN-exclusive content</span>' +
      '<input type="checkbox" class="sidebar-setting-switch" id="crkShowCnExCookies" ' +
      'aria-label="Show CN-exclusive content">' +
      "</label>" +
      "</div>" +
      '<div class="sidebar-setting-item">' +
      '<label class="sidebar-setting-row">' +
      '<span class="sidebar-setting-name">Beta content</span>' +
      '<input type="checkbox" class="sidebar-setting-switch" id="crkShowBetaCookies" ' +
      'aria-label="Show beta content">' +
      "</label>" +
      "</div>" +
      '<div class="sidebar-setting-item">' +
      '<label class="sidebar-setting-row">' +
      '<span class="sidebar-setting-name">Sort in game order</span>' +
      '<input type="checkbox" class="sidebar-setting-switch" id="crkSortInGameOrder" ' +
      "</label>" +
      "</div>" +
      "</div>" +
      "</div>"

    sb.appendChild(spacer)
    sb.appendChild(dock)

    const gear = dock.querySelector("#sidebarSettingsGear")
    const panel = dock.querySelector("#sidebarSettingsPanel")
    const cb = dock.querySelector("#crkShowCnExCookies")
    const cbBeta = dock.querySelector("#crkShowBetaCookies")
    const cbGameOrder = dock.querySelector("#crkSortInGameOrder")

    cb.checked = getShowCnExCookies()
    cb.addEventListener("change", () => {
      writeUIState({ showCnExCookies: cb.checked })
      global.dispatchEvent(new CustomEvent("crkSettingsChanged"))
    })

    cbBeta.checked = getShowBetaCookies()
    cbBeta.addEventListener("change", () => {
      writeUIState({ showBetaCookies: cbBeta.checked })
      global.dispatchEvent(new CustomEvent("crkSettingsChanged"))
    })

    cbGameOrder.checked = getSortInGameOrder()
    cbGameOrder.addEventListener("change", () => {
      writeUIState({ sortInGameOrder: cbGameOrder.checked })
      global.dispatchEvent(new CustomEvent("crkSettingsChanged"))
    })

    gear.addEventListener("click", (e) => {
      e.stopPropagation()
      const opening = !panel.classList.contains("open")
      document.querySelectorAll(".sidebar-settings-panel.open").forEach((p) => {
        if (p !== panel) p.classList.remove("open")
      })
      document.querySelectorAll(".sidebar-settings-gear.open").forEach((g) => {
        if (g !== gear) g.classList.remove("open")
      })
      panel.classList.toggle("open", opening)
      gear.classList.toggle("open", opening)
      gear.setAttribute("aria-expanded", opening ? "true" : "false")
    })

    panel.addEventListener("click", (e) => e.stopPropagation())

    document.addEventListener("click", () => closePanel(gear, panel))
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !panel.classList.contains("open")) return
      closePanel(gear, panel)
    })
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectSidebarSettings)
  } else {
    injectSidebarSettings()
  }
})(typeof window !== "undefined" ? window : globalThis)
