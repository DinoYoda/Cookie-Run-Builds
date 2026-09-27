/**
 * Cookie Run: Crumble — synergy badge icons (wiki types → crumble-guide assets).
 */
;(function () {
  /** All synergy types used in crc/data.js (filter + badge order). */
  const SYNERGY_TYPES = [
    "Duration",
    "Range",
    "Volley",
    "Rapid fire",
    "Chain",
    "Projectile speed",
    "Pierce",
  ]

  /** Wiki / data.js synergy type → pictures/synergies/*.webp slug */
  const ICON_SLUG = {
    Duration: "duration",
    Range: "area-of-effect",
    Volley: "multishot",
    "Rapid fire": "multistrike",
    Chain: "chain",
    "Projectile speed": "projectile-speed",
    Pierce: "pierce",
  }

  function synergyIconSlug(type) {
    return ICON_SLUG[String(type || "").trim()] || null
  }

  /**
   * @param {string} type Synergy type from crc/data.js
   * @param {"granted"|"received"} direction
   * @param {string} [picRoot="pictures"]
   */
  function crcSynergyBadgeHtml(type, direction, picRoot = "pictures") {
    const label = String(type || "").trim()
    const slug = synergyIconSlug(label)
    const granted = direction === "granted"
    const mod = granted ? "granted" : "received"
    const dirLabel = granted ? "granted" : "received"
    const arrow = granted ? "send-arrow" : "receive-arrow"

    if (!slug) {
      return `<span class="char-synergy-fallback" title="${label}">${label}</span>`
    }

    return `<span class="synergy-badge synergy-badge--${mod}" role="img" aria-label="${dirLabel} ${label} synergy" title="${label}"><img class="synergy-badge__icon" src="${picRoot}/synergies/${slug}.webp" alt="" width="34" height="34" loading="lazy" decoding="async"><img class="synergy-badge__arrow" src="${picRoot}/synergy-badges/${arrow}.webp" alt="" width="14" height="14" loading="lazy" decoding="async"></span>`
  }

  /** 0 = grants selected type, 1 = receives only, 2 = no match */
  function crcSynergyGrantRank(cookie, selectedTypes) {
    const types = Array.isArray(selectedTypes) ? selectedTypes : []
    if (!types.length) return 2
    const syn = Array.isArray(cookie?.synergy) ? cookie.synergy : []
    const matching = syn.filter((s) => types.includes(s?.type))
    if (!matching.length) return 2
    return matching.some((s) => !s.recipient) ? 0 : 1
  }

  function crcCookieHasSynergyTypes(cookie, selectedTypes) {
    const types = Array.isArray(selectedTypes) ? selectedTypes : []
    if (!types.length) return true
    const syn = Array.isArray(cookie?.synergy) ? cookie.synergy : []
    return syn.some((s) => types.includes(s?.type))
  }

  window.CRC_SYNERGY_TYPES = SYNERGY_TYPES
  window.crcSynergyIconSlug = synergyIconSlug
  window.crcSynergyBadgeHtml = crcSynergyBadgeHtml
  window.crcSynergyGrantRank = crcSynergyGrantRank
  window.crcCookieHasSynergyTypes = crcCookieHasSynergyTypes
})()
