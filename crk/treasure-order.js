/** Treasure display order: Epic → Special → Rare → Common; within each tier, release order (oldest → newest). */
window.treasureByRarity = {
    Epic: [
        "Sacred Pomegranate Branch",
        "Sugar Swan's Shining Feather",
        "Jelly Worm's Sticky Goo",
        "Bookseller's Monocle",
        "Seamstress's Pin Cushion",
        "Librarian's Enchanted Robes",
        "Old Pilgrim's Scroll",
        "Blind Healer's Staff",
        "Elder Pilgrim's Torch",
        "Durianeer's Squeaky Flamingo Tube",
        "Insignia of the Indomitable Knights",
        "Miraculous Natural Remedy",
        "Divine Honey Cream Crown",
        "The Order's Sacred Fork",
        "Hollyberrian Royal Necklace",
        "Dream Conductor's Whistle",
        "Sleepyhead's Jelly Watch",
        "Milk Tribe's Frozen Torch",
        "Vial of Raging Dunes",
        "Explorer's Monocle",
        "Grim-looking Electrifying Scythe",
        "Thunder God's Paper Charm",
        "Twinkling Starlight Crown",
        "Cape of the Vanquisher",
        "Great Sage's Gem",
        "Subtle Fragrant Remedy",
        "Mysterious Jewelry Box",
        "Mystical Silver Fork",
        "Cursed Catacombs Candle",
        "Unyielding Berry Necklace",
        "Crimson Magic Whistle",
        "Darkness Vessel",
        "TBD Ticking Jelly Watch",
    ],
    Special: [
        "Acorn Snowball With a Tiny Cookie",
        "Blossoming Acorn Bomb",
        "Ice-cold Energy Drink",
        "Festive Acorn Gift Box",
    ],
    Rare: [
        "Miraculous Ghost Ice Cream",
        "Bear Jelly's Lollipop",
        "Priestess Cookie's Paper Charm",
        "Grim-looking Scythe",
        "Pilgrim's Slingshot",
        "Echo of the Hurricane's Song",
        "Disciple's Magic Scroll",
    ],
    Common: [
        "Gatekeeper Ghost's Horn",
        "Cheesebird's Coin Purse",
        "Ginkgoblin's Trophy Safe",
        "Squishy Jelly Watch",
    ],
}

;(function () {
  const TIERS = ["Epic", "Special", "Rare", "Common"]
  const indexMap = new Map()

  function registerKey(key, rarity, idx) {
    const k = String(key || "").trim().toLowerCase()
    if (!k || indexMap.has(k)) return
    indexMap.set(k, { rarity, idx })
  }

  function registerLabel(label, rarity, idx) {
    registerKey(label, rarity, idx)
    registerKey(label.replace(/'/g, ""), rarity, idx)
    registerKey(label.replace(/'/g, "27"), rarity, idx)
    registerKey(label.replace(/\s+Cookie$/i, ""), rarity, idx)
  }

  for (let rarity = 0; rarity < TIERS.length; rarity++) {
    const list = window.treasureByRarity[TIERS[rarity]] || []
    list.forEach((name, idx) => registerLabel(name, rarity, idx))
  }

  function attachSlugKeys(slug, rarity, idx) {
    registerKey(slug, rarity, idx)
    registerKey(slug.replace(/-/g, "_"), rarity, idx)
  }

  const tmap = typeof CRK_TREASURE_SLUG_MAP === "object" && CRK_TREASURE_SLUG_MAP ? CRK_TREASURE_SLUG_MAP : {}
  const kw = typeof CRK_TREASURE_KEYWORD_DISPLAY === "object" && CRK_TREASURE_KEYWORD_DISPLAY ? CRK_TREASURE_KEYWORD_DISPLAY : {}
  for (const [key, slug] of Object.entries(tmap)) {
    if (!slug) continue
    const display = kw[key] || key
    const hit = indexMap.get(String(display).trim().toLowerCase())
    if (hit) attachSlugKeys(slug, hit.rarity, hit.idx)
  }

  function resolveTreasureRef(treasureId) {
    const raw = String(treasureId || "").trim()
    if (!raw) return { slug: "", display: "" }
    const tmap = typeof CRK_TREASURE_SLUG_MAP === "object" && CRK_TREASURE_SLUG_MAP ? CRK_TREASURE_SLUG_MAP : {}
    const kw = typeof CRK_TREASURE_KEYWORD_DISPLAY === "object" && CRK_TREASURE_KEYWORD_DISPLAY ? CRK_TREASURE_KEYWORD_DISPLAY : {}
    if (typeof resolveTreasureWiki === "function") {
      return resolveTreasureWiki(raw, tmap, kw)
    }
    return { slug: raw, display: raw }
  }

  function lookupRank(resolved) {
    const candidates = []
    if (resolved?.slug) {
      candidates.push(resolved.slug)
      candidates.push(resolved.slug.replace(/-/g, "_"))
    }
    if (resolved?.display) candidates.push(resolved.display)
    for (const c of candidates) {
      const hit = indexMap.get(String(c).trim().toLowerCase())
      if (hit) return hit
    }
    return { rarity: 999, idx: 999 }
  }

  window.getTreasureSortRank = function getTreasureSortRank(treasureId) {
    return lookupRank(resolveTreasureRef(treasureId))
  }
})()
