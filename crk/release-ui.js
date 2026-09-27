const gameRarityOrder = [
    "Witch", "AncientA", "Beast", "New Legendary", "New Dragon",
    "Ancient", "Legendary", "Dragon",
    "Super Epic", "Epic", "Special", "Zhencang", "Rare", "Common",
]
const siteRarityOrder = [
    "Witch", "AncientA", "Beast", "Ancient", "Legendary", "Dragon",
    "Super Epic", "Epic", "Special", "Zhencang", "Rare", "Common",
]

function raritySortBand(rarity, useGameOrder) {
    if (useGameOrder) return rarity
    if (rarity === "New Legendary") return "Legendary"
    if (rarity === "New Dragon") return "Dragon"
    return rarity
}

/** Rarity sort order for a game: CRK uses release maps; others use data.js filters (high → low). */
function rarityOrderForGame(game, useGameOrder) {
    if (!game || game.id === "crk") {
        return useGameOrder ? gameRarityOrder : siteRarityOrder
    }
    if (Array.isArray(game.rarityOrder) && game.rarityOrder.length) {
        return game.rarityOrder
    }
    const fromFilters = (game.tierlists || []).find(t => t.filters?.rarity?.length)?.filters.rarity
    if (fromFilters?.length) return [...fromFilters]
    return useGameOrder ? gameRarityOrder : siteRarityOrder
}

function compareReleaseVersions(a, b) {
    const pa = String(a).split(".")
    const pb = String(b).split(".")
    const n = Math.max(pa.length, pb.length)
    for (let i = 0; i < n; i++) {
        const da = parseInt(pa[i] ?? "0", 10)
        const db = parseInt(pb[i] ?? "0", 10)
        if (da !== db) return da - db
    }
    return 0
}

function flattenReleaseByVersion(byVersion) {
    const keys = Object.keys(byVersion || {}).sort(compareReleaseVersions)
    const out = []
    for (const k of keys) {
        for (const name of byVersion[k]) out.push(name)
    }
    return out
}

const cookieReleaseOrder = flattenReleaseByVersion(typeof cookieByDate !== "undefined" ? cookieByDate : {})
const crcCookieReleaseOrder = flattenReleaseByVersion(typeof crcCookieByDate !== "undefined" ? crcCookieByDate : {})
const candyReleaseOrder = flattenReleaseByVersion(typeof candyByDate !== "undefined" ? candyByDate : {})

const cookieReleaseVersionMap = Object.create(null)
function registerCookieReleaseName(name, version) {
    const n = String(name || "").trim()
    if (!n) return
    cookieReleaseVersionMap[n] = version
    if (!/\bCookie$/i.test(n)) cookieReleaseVersionMap[`${n} Cookie`] = version
}
if (typeof cookieByDate !== "undefined") {
    for (const [version, names] of Object.entries(cookieByDate)) {
        const v = String(version)
        for (const raw of names) registerCookieReleaseName(raw, v)
    }
}

function getCookieReleaseVersion(displayName, charName) {
    const candidates = []
    const add = (s) => {
        const t = String(s || "").trim()
        if (t && !candidates.includes(t)) candidates.push(t)
    }
    add(displayName)
    add(charName)
    if (charName) add(`${charName} Cookie`)
    const dn = String(displayName || "").trim()
    if (dn) {
        const m = dn.match(/^(.+?\s+Cookie)(?:\s+of\s+.+)?$/i)
        if (m) add(m[1].trim())
    }
    for (const c of candidates) {
        const hit = cookieReleaseVersionMap[c]
        if (hit) return hit
    }
    if (dn) {
        for (const [key, ver] of Object.entries(cookieReleaseVersionMap)) {
            if (dn === key || dn.startsWith(`${key} `)) return ver
        }
    }
    const label = displayName || charName || "(unknown)"
    throw new Error(`No release update mapped for cookie: ${label}`)
}

const releaseOrderMap = {}
cookieReleaseOrder.forEach((name, index) => {
    releaseOrderMap[name] = index
})

const crcReleaseOrderMap = {}
crcCookieReleaseOrder.forEach((name, index) => {
    crcReleaseOrderMap[name] = index
})

const releaseOrderMapCandy = {}
candyReleaseOrder.forEach((name, index) => {
    releaseOrderMapCandy[name] = index
})

function cookieReleaseOrderForGame(gameId) {
    if (gameId === "crc" && crcCookieReleaseOrder.length) return crcCookieReleaseOrder
    return cookieReleaseOrder
}

function releaseOrderMapForGame(gameId) {
    if (gameId === "crc" && Object.keys(crcReleaseOrderMap).length) return crcReleaseOrderMap
    return releaseOrderMap
}
