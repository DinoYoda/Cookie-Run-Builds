/**
 * Cookie Run: Crumble card frame helpers (wiki game-cc rarity backgrounds).
 */
;(function () {
  const RARITY_SLUG = {
    C: "c",
    U: "u",
    R: "r",
    SR: "sr",
    SSR: "ssr",
    TSSR: "tssr",
  }

  function crcCardBgClasses(rarity) {
    const slug = RARITY_SLUG[String(rarity || "").trim()]
    return slug ? `crc-card-bg game-cc rarity-${slug}` : "crc-card-bg game-cc"
  }

  /** Shell + bg layer + optional corner icons (behind portrait) + portrait img. */
  function crcCardPortraitWrap(portraitHtml, rarity, iconsHtml) {
    const icons = iconsHtml || ""
    return `<div class="crc-card-shell"><div class="${crcCardBgClasses(rarity)}" aria-hidden="true"></div>${icons}${portraitHtml}</div>`
  }

  window.crcCardBgClasses = crcCardBgClasses
  window.crcCardPortraitWrap = crcCardPortraitWrap
})()
