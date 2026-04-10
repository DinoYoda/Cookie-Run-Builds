let DATA

let currentGame = null
let currentSection = null  // dropdown selection (e.g. "Cookies" or "Magic Candies")
let currentTierlist = null
let currentTab = null
let currentGroup = null
let currentSubTab = null

let searchText = ""
let activeFilters = {}
let characterMap = {}

function getGamePictureRoot() {
    const g = currentGame
    if (!g) return "crk/pictures"
    const folder = g.assetsBase != null ? g.assetsBase : g.id
    return `${folder}/pictures`
}

/** Card art filename under {pictureRoot}/cards/ */
function cardImageFilename(gameId, name) {
    const n = name || ""
    if (gameId === "toa") {
        return `${n}_Cookie_Profile_Icon.png`
    }
    return `Cookie_${String(n).toLowerCase(n)}_card.png`
}

const tierSectionSelect = document.getElementById("tierSectionSelect")
const tierSectionSelectTrigger = document.getElementById("tierSectionSelectTrigger")
const tierSectionSelectLabel = document.getElementById("tierSectionSelectLabel")
const tierSectionSelectPanel = document.getElementById("tierSectionSelectPanel")
const tierTabs = document.getElementById("tierTabs")
const filtersContainer = document.getElementById("filters")
const tierlistContainer = document.getElementById("tierlist")
const searchInput = document.getElementById("search")
const resetBtn = document.getElementById("reset")

const releaseOrderMap = {}
cookieByDate.forEach((name, index) => {
    releaseOrderMap[name] = index
})

const releaseOrderMapCandy = {}
candyByDate.forEach((name, index) => {
    releaseOrderMapCandy[name] = index
})

/* -----------------------------
LOAD DATA
----------------------------- */
const UI_STATE_KEY = "tierlistUIState"

function saveUIState() {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify({
        game: currentGame?.id,
        section: currentSection?.name,
        group: currentGroup?.name,
        sub: currentSubTab?.name
    }))
}

function loadUIState() {
    try {
        return JSON.parse(localStorage.getItem(UI_STATE_KEY)) || {}
    } catch {
        return {}
    }
}
function getCurrentFeatures() {
    return currentTierlist?.features ?? currentSection?.features ?? currentGame?.features ?? {}
}
function getCurrentFilters() {
    return currentTierlist?.filters ?? currentSection?.filters ?? currentGame?.filters ?? {}
}
function getCurrentRoles() {
    return currentTierlist?.roles ?? currentSection?.roles ?? currentGame?.roles ?? []
}

DATA = window.CRK_DATA || {}

document.addEventListener("click", () => {
    document.querySelectorAll(".select-expand.is-open").forEach(root => {
        root.classList.remove("is-open")
        const trig = root.querySelector(".select-expand-trigger")
        const pan = root.querySelector(".select-expand-panel")
        if (trig) trig.setAttribute("aria-expanded", "false")
        if (pan) pan.hidden = true
    })
})
document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return
    document.querySelectorAll(".select-expand.is-open").forEach(root => {
        root.classList.remove("is-open")
        const trig = root.querySelector(".select-expand-trigger")
        const pan = root.querySelector(".select-expand-panel")
        if (trig) trig.setAttribute("aria-expanded", "false")
        if (pan) pan.hidden = true
    })
})



/* -----------------------------
GAME SELECTOR
----------------------------- */

function buildGameSelector() {
    const saved = loadUIState()
    loadGame(saved.game || DATA.games[0]?.id)
}

function loadGame(gameId) {
    currentGame = DATA.games.find(g => g.id === gameId) || DATA.games[0]
    if (!currentGame) return

    // Update sidebar game button label and highlight active option
    const sidebarGameName = document.getElementById("sidebarGameName")
    if (sidebarGameName) sidebarGameName.textContent = currentGame.name || currentGame.id
    document.querySelectorAll(".sidebar-game-option").forEach(opt => {
        opt.classList.toggle("active", opt.dataset.game === currentGame.id)
    })

    // Build character lookup
    characterMap = {}
    if (currentGame.characters) {
        currentGame.characters.forEach(c => {
            characterMap[c.name] = c
            if (c.displayName) characterMap[c.displayName] = c
            const stripped = (c.displayName || "").replace(/\s+Cookie\b/i, "").trim()
            if (stripped && stripped !== c.displayName) characterMap[stripped] = c
        })
    }

    tierSectionSelectPanel.innerHTML = ""
    currentGame.tierlists.forEach(section => {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "select-expand-option"
        btn.dataset.value = section.name
        btn.textContent = section.name
        btn.setAttribute("role", "option")
        btn.addEventListener("click", e => {
            e.stopPropagation()
            tierSectionSelect.classList.remove("is-open")
            tierSectionSelectPanel.hidden = true
            tierSectionSelectTrigger.setAttribute("aria-expanded", "false")
            loadSection(section.name)
            saveUIState()
        })
        tierSectionSelectPanel.appendChild(btn)
    })

    tierSectionSelectTrigger.onclick = e => {
        e.stopPropagation()
        const opening = !tierSectionSelect.classList.contains("is-open")
        document.querySelectorAll(".select-expand.is-open").forEach(root => {
            root.classList.remove("is-open")
            const t = root.querySelector(".select-expand-trigger")
            const p = root.querySelector(".select-expand-panel")
            if (t) t.setAttribute("aria-expanded", "false")
            if (p) p.hidden = true
        })
        if (opening) {
            tierSectionSelect.classList.add("is-open")
            tierSectionSelectPanel.hidden = false
            tierSectionSelectTrigger.setAttribute("aria-expanded", "true")
        }
    }

    const saved = loadUIState()
    loadSection((saved.game === currentGame.id ? saved.section : null) || currentGame.tierlists[0]?.name)
}

function loadSection(sectionName) {
    currentSection = currentGame.tierlists.find(g => g.name === sectionName) || currentGame.tierlists[0]
    tierSectionSelectLabel.textContent = currentSection.name
    tierSectionSelectPanel.querySelectorAll(".select-expand-option").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.value === currentSection.name)
    })

    activeFilters = {}
    searchText = ""
    searchInput.value = ""

    currentGroup = null
    currentSubTab = null
    currentTierlist = null

    buildTabs()
    buildFilters()
    renderTierlist()
}



/* -----------------------------
TIERLIST TABS
----------------------------- */

function buildTabs() {

    tierTabs.innerHTML = ""

    currentSection.tierlists.forEach(tierlist => {

        // GROUP TAB (e.g. Guild Battle with nested sub-tabs)
        if (tierlist.tierlists) {

            const group = document.createElement("div")
            group.className = "tier-group"

            const groupBtn = document.createElement("button")
            groupBtn.className = "tier-tab group"
            groupBtn.textContent = tierlist.name

            groupBtn.onclick = () => {

                if (currentGroup === tierlist) return

                currentGroup = tierlist
                currentSubTab = tierlist.tierlists[0]
                currentTierlist = currentSubTab
                saveUIState()
                updateActiveTabs()
                renderTierlist()

            }

            group.appendChild(groupBtn)

            const subTabs = document.createElement("div")
            subTabs.className = "sub-tabs"

            tierlist.tierlists.forEach(sub => {

                const subBtn = document.createElement("button")
                subBtn.className = "tier-tab sub"
                subBtn.textContent = sub.name

                subBtn.onclick = () => {

                    currentSubTab = sub
                    currentTierlist = sub
                    saveUIState()
                    updateActiveTabs()
                    renderTierlist()

                }

                subTabs.appendChild(subBtn)

                sub._button = subBtn
            })

            group.appendChild(subTabs)

            tierTabs.appendChild(group)

            tierlist._button = groupBtn
            tierlist._subContainer = subTabs
        }

        // NORMAL TAB (e.g. World Exploration, Kingdom Arena)
        else {

            const tab = document.createElement("button")
            tab.className = "tier-tab"
            tab.textContent = tierlist.name

            tab.onclick = () => {

                if (currentGroup === tierlist) return

                currentGroup = tierlist
                currentSubTab = null
                currentTierlist = tierlist
                saveUIState()
                updateActiveTabs()
                renderTierlist()

            }

            tierTabs.appendChild(tab)

            tierlist._button = tab
        }

    })
    const saved = loadUIState()
    // initialize selection
    if (!currentGroup) {

        currentGroup =
            currentSection.tierlists.find(t => t.name === saved.group) ||
            currentSection.tierlists[0]

        if (currentGroup.tierlists) {

            currentSubTab =
                currentGroup.tierlists.find(s => s.name === saved.sub) ||
                currentGroup.tierlists[0]

            currentTierlist = currentSubTab

        } else {

            currentTierlist = currentGroup

        }
    }

    updateActiveTabs()

}

function updateActiveTabs() {

    document.querySelectorAll(".tier-tab")
        .forEach(btn => btn.classList.remove("active"))

    currentSection.tierlists.forEach(tierlist => {

        // group
        if (tierlist.tierlists) {

            tierlist._button.classList.toggle(
                "active",
                currentGroup === tierlist
            )

            tierlist._subContainer.style.display =
                currentGroup === tierlist ? "flex" : "none"

            tierlist.tierlists.forEach(sub => {

                sub._button.classList.toggle(
                    "active",
                    currentSubTab === sub
                )

            })
        }

        // normal tab
        else {

            tierlist._button.classList.toggle(
                "active",
                currentGroup === tierlist
            )

        }

    })

}



/* -----------------------------
FILTER UI
----------------------------- */

function buildFilters() {

    filtersContainer.innerHTML = ""

    const filters = getCurrentFilters()

    Object.entries(filters).forEach(([category, values]) => {

        const group = document.createElement("div")
        group.className = "filter-group"

        values.forEach(value => {

            const btn = document.createElement("button")

            btn.className = "filter-icon-btn"

            btn.dataset.category = category
            btn.dataset.value = value

            const iconPath = `${getGamePictureRoot()}/icons/${value}.png`

            btn.title = value

            btn.innerHTML = `
                <img src="${iconPath}" alt="${value}">
            `

            btn.onclick = () => {

                if (!activeFilters[category]) {
                    activeFilters[category] = []
                }

                const index = activeFilters[category].indexOf(value)

                if (index > -1) {

                    // remove filter
                    activeFilters[category].splice(index, 1)
                    btn.classList.remove("active")

                    if (activeFilters[category].length === 0) {
                        delete activeFilters[category]
                    }

                } else {

                    // add filter
                    activeFilters[category].push(value)
                    btn.classList.add("active")

                }

                renderTierlist()

            }

            group.appendChild(btn)

        })

        filtersContainer.appendChild(group)

    })

}



/* -----------------------------
SEARCH
----------------------------- */

searchInput.addEventListener("input", () => {

    searchText = searchInput.value.toLowerCase()

    renderTierlist()

})



/* -----------------------------
RESET BUTTON
----------------------------- */

resetBtn.onclick = () => {

    activeFilters = {}
    searchText = ""

    searchInput.value = ""

    document.querySelectorAll(".filter-icon-btn").forEach(btn => btn.classList.remove("active"))

    renderTierlist()

}



/* -----------------------------
FILTER LOGIC
----------------------------- */

function applyFilters(character) {
    // Search filter
    if (searchText) {
        let searchBase = character.name ? character.name.replace(/_/g, " ") : ""
        if (character.displayName && /cookie/i.test(character.displayName) && !/cookie/i.test(searchBase)) {
            searchBase += (searchBase ? " " : "") + "cookie"
        }
        const searchIn = [searchBase, character.displayName].filter(Boolean).join(" ").toLowerCase()
        if (!searchIn.includes(searchText)) return false
    }

    // Category filters
    for (const [category, values] of Object.entries(activeFilters)) {

        const charValue = character[category]

        // Character has multiple values (ex: tags)
        if (Array.isArray(charValue)) {

            // pass if ANY match
            if (!charValue.some(v => values.includes(v))) {
                return false
            }

        } else {

            // single value (ex: type)
            let passes = values.includes(charValue)
            // Ancient filter includes both Ancient and AncientA (awakened ancients)
            if (category === "rarity" && !passes && values.includes("Ancient") && charValue === "AncientA") {
                passes = true
            }
            if (!passes) {
                return false
            }

        }

    }

    return true
}



/* -----------------------------
ROLE HEADER
----------------------------- */

function buildRoleHeader(container) {

    const header = document.createElement("div")

    header.className = "role-header"

    const empty = document.createElement("div")
    empty.className = "tier-label"

    header.appendChild(empty)

    getCurrentRoles().forEach(role => {

        const roleDiv = document.createElement("div")

        roleDiv.className = "role-name"
        roleDiv.textContent = role.name

        header.appendChild(roleDiv)

    })

    container.appendChild(header)

}

/** Global rank index from S+ downward (matches tier band labels across lists). */
const OVERALL_TIER_RANK_ORDER = ["S+", "S", "A+", "A", "B", "C", "D", "E", "F"]

function tierLabelToRankValue(label) {
    const i = OVERALL_TIER_RANK_ORDER.indexOf(label)
    return i >= 0 ? i : null
}

function flattenTierlistLeaves(nodes) {
    if (!Array.isArray(nodes)) return []
    const out = []
    for (const n of nodes) {
        if (!n || n.computedAverage) continue
        if (n.tiers && Array.isArray(n.entries)) out.push(n)
        if (n.tierlists) out.push(...flattenTierlistLeaves(n.tierlists))
    }
    return out
}

function nameMatchesCell(char, cell) {
    if (!cell || !char) return false
    const t = (s) => String(s).trim()
    const cellT = t(cell)
    if (cellT === t(char.displayName || "")) return true
    if (cellT === t(char.name || "")) return true
    const base = t(char.displayName || "").replace(/\s+Cookie$/i, "").trim()
    if (cellT === base) return true
    return false
}

function tierValueForCharacter(char, leaf) {
    if (!leaf?.tiers || !leaf?.entries) return null
    for (let i = 0; i < leaf.entries.length; i++) {
        const row = leaf.entries[i]
        if (!row) continue
        for (const cell of row) {
            if (nameMatchesCell(char, cell)) {
                return tierLabelToRankValue(leaf.tiers[i])
            }
        }
    }
    return null
}

/** 0 = best row in that list; used for Guild Battle per-boss normalization. */
function tierRowIndexForCharacter(char, leaf) {
    if (!leaf?.tiers || !leaf?.entries) return null
    for (let i = 0; i < leaf.entries.length; i++) {
        const row = leaf.entries[i]
        if (!row) continue
        for (const cell of row) {
            if (nameMatchesCell(char, cell)) return i
        }
    }
    return null
}

function entryKeyForCharacter(char, worldLeaf) {
    if (!worldLeaf?.entries) return char.displayName || char.name
    for (const row of worldLeaf.entries) {
        if (!row) continue
        for (const cell of row) {
            if (nameMatchesCell(char, cell)) return cell
        }
    }
    return char.displayName || char.name
}

function isIntegerAverageValue(x) {
    return Math.abs(x - Math.round(x)) < 1e-9
}

function roundNearestHalfDown(x) {
    const f = Math.floor(x)
    if (Math.abs(x - (f + 0.5)) < 1e-9) return f
    return Math.round(x)
}

function normalizeTierLabel(label) {
    const clean = String(label ?? "").toUpperCase().replace(/[^A-Z+]/g, "")
    return OVERALL_TIER_RANK_ORDER.includes(clean) ? clean : null
}

function shouldHighlightRatingMismatch(char, placedTierLabel) {
    const isOverallComputed = currentTierlist?.computedAverage &&
        currentGame?.id === "crk" &&
        currentSection?.name === "Cookies"
    if (!isOverallComputed) return false

    const dataRating = normalizeTierLabel(char?.rating)
    const placed = normalizeTierLabel(placedTierLabel)
    if (!dataRating || !placed) return false
    return dataRating !== placed
}

function sortEntryKeysForDisplay(keys, isCandy, rarityOrder) {
    const uniq = [...new Set(keys)]
    return uniq.sort((ka, kb) => {
        const a = characterMap[ka]
        const b = characterMap[kb]
        if (!a || !b) return String(ka).localeCompare(String(kb))
        if (isCandy) {
            return (releaseOrderMapCandy[b.displayName ?? b.name] ?? 9999) -
                (releaseOrderMapCandy[a.displayName ?? a.name] ?? 9999)
        }
        const rarityDiff = (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b.rarity] ?? 999)
        if (rarityDiff !== 0) return rarityDiff
        return (releaseOrderMap[(b.displayName ?? b.name)] ?? 9999) - (releaseOrderMap[(a.displayName ?? a.name)] ?? 9999)
    })
}

/**
 * CRK Cookies only: average World Exploration + Kingdom Arena rank indices; branch rules for ties / lower tiers.
 * When the W+A mean sits at A or below (index >= 3) and needs other lists, weights are ⅓ World EX,
 * ⅓ Arena, and ⅓ the mean of all remaining tier lists (not equal weight across every list).
 */
function computeCookiesOverallEntries(game, section) {
    const tierOrder = [...OVERALL_TIER_RANK_ORDER]
    const leaves = flattenTierlistLeaves(section.tierlists)
    const world = leaves.find(t => t.name === "World Exploration")
    const arena = leaves.find(t => t.name === "Kingdom Arena")
    if (!world || !arena) {
        return { tiers: tierOrder, entries: tierOrder.map(() => []) }
    }
    const allLeaves = leaves.filter(t => t.tiers && t.entries)
    const otherLeaves = allLeaves.filter(t => t !== world && t !== arena)
    const chars = game.characters || []
    const entries = tierOrder.map(() => [])

    for (const char of chars) {
        const vW = tierValueForCharacter(char, world)
        const vA = tierValueForCharacter(char, arena)
        if (vW == null || vA == null) continue

        const avg2 = (vW + vA) / 2
        let finalV

        if (isIntegerAverageValue(avg2)) {
            finalV = Math.round(avg2)
        } else if (avg2 < 3) {
            finalV = Math.floor(avg2)
        } else {
            const otherVals = otherLeaves.map(leaf => tierValueForCharacter(char, leaf)).filter(v => v != null)
            let blended
            if (otherVals.length === 0) {
                blended = (vW + vA) / 2
            } else {
                const avgOthers = otherVals.reduce((a, b) => a + b, 0) / otherVals.length
                blended = (vW + vA + avgOthers) / 3
            }
            finalV = roundNearestHalfDown(blended)
        }

        finalV = Math.max(0, Math.min(finalV, tierOrder.length - 1))
        const label = tierOrder[finalV]
        const row = tierOrder.indexOf(label)
        if (row < 0) continue
        entries[row].push(entryKeyForCharacter(char, world))
    }

    const isCandy = (getCurrentFeatures().cardStyle === "candy")
    let orderRarities = [...(getCurrentFilters().rarity || [])]
    if (!isCandy) {
        const beastIdx = orderRarities.indexOf("Beast")
        if (beastIdx >= 0) orderRarities.splice(beastIdx, 0, "AncientA")
    }
    const rarityOrder = {}
    orderRarities.forEach((r, index) => {
        rarityOrder[r] = index
    })

    for (let i = 0; i < entries.length; i++) {
        entries[i] = sortEntryKeysForDisplay(entries[i], isCandy, rarityOrder)
    }

    return { tiers: tierOrder, entries }
}


/* -----------------------------
RENDER TIERLIST
----------------------------- */

function renderTierlist() {
    tierlistContainer.innerHTML = ""
    tierlistContainer.classList.remove("tierlist--roles")
    tierlistContainer.style.removeProperty("--role-columns")
    if (!currentTierlist) return

    const features = getCurrentFeatures()
    const isCandy = features.cardStyle === "candy"

    // Only build role header if roles are enabled
    if (features.role) {
        const roles = getCurrentRoles()
        const n = Math.max(1, roles.length)
        tierlistContainer.classList.add("tierlist--roles")
        tierlistContainer.style.setProperty("--role-columns", String(n))
        buildRoleHeader(tierlistContainer)
    }

    let tiers = currentTierlist.tiers
    let entries = currentTierlist.entries
    if (currentTierlist.computedAverage && currentGame?.id === "crk" && currentSection?.name === "Cookies") {
        const computed = computeCookiesOverallEntries(currentGame, currentSection)
        tiers = computed.tiers
        entries = computed.entries
    }

    // Build dynamic rarity order based on filter UI (AncientA injected for sort: above Beast, no filter button)
    let orderRarities = [...(getCurrentFilters().rarity || [])]
    if (!isCandy) {
        const beastIdx = orderRarities.indexOf("Beast")
        if (beastIdx >= 0) orderRarities.splice(beastIdx, 0, "AncientA")
    }
    const rarityOrder = {}
    orderRarities.forEach((r, index) => {
        rarityOrder[r] = index
    })

    let totalCards = 0

    tiers.forEach((tierName, i) => {
        const row = document.createElement("div")
        row.className = "tier-row"

        const tierLabel = document.createElement("div")
        const pos = Math.min(i + 1, 12)
        tierLabel.className = "tier-label tier-pos-" + pos
        tierLabel.textContent = tierName
        row.appendChild(tierLabel)

        if (features.role) {
            getCurrentRoles().forEach(role => {
                const column = document.createElement("div")
                column.className = "role-column"

                if (entries[i]) {
                    entries[i]
                        .map(name => characterMap[name])
                        .filter(Boolean)
                        .filter(c => c.role === role.name)
                        .filter(applyFilters)
                        .sort((a, b) => {
                            const rarityDiff = (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b
                                .rarity] ?? 999)
                            if (rarityDiff !== 0) return rarityDiff
                            return (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name)
                        })
                        .forEach(c => {
                            column.appendChild(createCard(c, { placedTierLabel: tierName }))
                            totalCards++
                        })
                }

                row.appendChild(column)
            })
        } else {
            const column = document.createElement("div")
            column.className = "tier-column"

            if (entries[i]) {
                entries[i]
                    .map(name => characterMap[name])
                    .filter(Boolean)
                    .filter(applyFilters)
                    .sort((a, b) => {
                        if (isCandy) {
                            return (releaseOrderMapCandy[b.displayName ?? b.name] ?? 9999) - (releaseOrderMapCandy[a.displayName ?? a.name] ?? 9999)
                        }
                        // 1. Sort by rarity
                        const rarityDiff = (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b.rarity] ?? 999)
                        if (rarityDiff !== 0) return rarityDiff
                        // 2. Sort by release order (newer cookies first)
                        return (releaseOrderMap[(b.displayName ?? b.name)] ?? 9999) - (releaseOrderMap[(a.displayName ?? a.name)] ?? 9999)
                    })
                    .forEach(c => {
                        column.appendChild(createCard(c, { placedTierLabel: tierName }))
                        totalCards++
                    })
            }

            row.appendChild(column)
        }

        tierlistContainer.appendChild(row)
    })

    // Update the counter element
    const counter = document.getElementById("cardCounter")
    if (counter) {
        counter.textContent = `Showing ${totalCards} cookie${totalCards === 1 ? "" : "s"}`
    }
}



/* -----------------------------
CHARACTER CARD
----------------------------- */
function getCardImagePath(name) {
    const pic = getGamePictureRoot()
    if (getCurrentFeatures().cardStyle === "candy") {
        return `${pic}/candy/${name}_mc_lv3.png`
    }
    return `${pic}/cards/${cardImageFilename(currentGame?.id, name)}`
}

function getWikiLink(displayName) {
    if (getCurrentFeatures().cardStyle === "candy") {
        const baseName = displayName.replace(/\s+Cookie\b/i, "").trim()
        const wikiName = baseName.replace(/\s+/g, "_")
        return "https://cookierunkingdom.fandom.com/wiki/" + wikiName + "_Cookie#Magic_Candy_Skill"
    }
    const wikiName = displayName.replace(/\s+/g, "_")
    return "https://cookierunkingdom.fandom.com/wiki/" + wikiName
}

function toaRarityImgClass(rarity) {
    if (currentGame?.id !== "toa" || rarity == null || rarity === "") return ""
    const key = String(rarity).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase()
    return key ? ` toa-rarity-${key}` : ""
}

function createCard(char, opts = {}) {

    const card = document.createElement("div")
    card.className = "card"
    if (shouldHighlightRatingMismatch(char, opts.placedTierLabel)) {
        card.classList.add("card-rating-mismatch")
        const placed = normalizeTierLabel(opts.placedTierLabel)
        const rated = normalizeTierLabel(char.rating)
        card.title = `Tier mismatch: placed ${placed}, data rating ${rated}`
    }

    const f = getCurrentFeatures()
    const imgSrc = getCardImagePath(char.name)
    const pic = getGamePictureRoot()
    const rarityImgClass = toaRarityImgClass(char.rarity)

    let link
    let newTab = ""

    if (f.cardStyle === "candy") {

        link = getWikiLink(char.displayName ?? char.name)
        newTab = `target="_blank"`

    } else {

        link = `crk/character.html?char=${encodeURIComponent(char.name)}`

    }

    let html = `<a class="portrait" href="${link}" ${newTab}>
        <img src="${imgSrc}" class="character-img${rarityImgClass}" onerror="this.onerror=null;if(this.src.indexOf('null.png')===-1){this.src='${pic}/icons/null.png'}else{this.style.display='none'}">`

    if (f.elementIcon && char.icon) {
        html += `<img class="element-icon" src="${char.icon}">`
    }

    if (f.eidolon) {
        html += `<div class="eidolon">E${char.eidolon ?? 0}</div>`
    }

    html += `</a>`

    const displayLabel = f.cardStyle === "candy"
        ? (char.displayName ?? char.name).replace(/\s+Cookie\b/i, "").trim()
        : (char.displayName ?? char.name)
    html += `<div class="name">${displayLabel}</div>`

    if (f.tags && char.tags) {
        html += `<div class="tags">${char.tags.join(", ")}</div>`
    }

    if (f.badges && char.badges) {
        html += `<div class="badges">${char.badges.join(", ")}</div>`
    }

    card.innerHTML = html

    return card
}

if (DATA.games && DATA.games.length) {
    buildGameSelector()
}