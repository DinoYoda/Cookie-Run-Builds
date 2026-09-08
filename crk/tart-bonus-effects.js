/**
 * Legendary tart bonus effects: short keys in data.js → full in-game label for display.
 */
;(function () {
  const TART_BONUS_EFFECT_LABELS = {
    Cookie: "Increased DMG to Cookies",
    Enemy: "Increased DMG to All Enemies",
    "CRIT DMG": "Increased CRIT DMG",
    "DMG Resist": "Increased DMG Resist",
    Shield: "HP Shield at Start of Battle",
    Healing: "Increased Healing Given & Received",
    Heal: "HP Recovery Every 7 Sec",
    Tiny: "DMG Resist +5% & Reduced Size",
    Big: "Max HP +5% & Increased Size",
    Fireworks: "Fireworks Every 10 Sec & Increased ATK",
    Team: "Increased Team DMG at Start of Battle (Non-Stackable)",
  }

  function getTartBonusEffectDisplayLabel(raw) {
    const key = String(raw ?? "").trim()
    if (!key) return ""
    if (Object.prototype.hasOwnProperty.call(TART_BONUS_EFFECT_LABELS, key)) {
      return TART_BONUS_EFFECT_LABELS[key]
    }
    return key
  }

  window.TART_BONUS_EFFECT_LABELS = TART_BONUS_EFFECT_LABELS
  window.getTartBonusEffectDisplayLabel = getTartBonusEffectDisplayLabel
})()
