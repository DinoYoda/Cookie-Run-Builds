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

const gameSelect = document.getElementById("gameSelect")
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
    return currentSection?.features ?? currentGame?.features ?? {}
}
function getCurrentFilters() {
    return currentSection?.filters ?? currentGame?.filters ?? {}
}
function getCurrentRoles() {
    return currentSection?.roles ?? currentGame?.roles ?? []
}

DATA = window.CRK_DATA || {}
if (DATA.games && DATA.games.length) {
    buildGameSelector()
}



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

    // Populate section dropdown with this game's top-level groups
    gameSelect.innerHTML = ""
    currentGame.tierlists.forEach(section => {
        const option = document.createElement("option")
        option.value = section.name
        option.textContent = section.name
        gameSelect.appendChild(option)
    })

    gameSelect.onchange = () => {
        loadSection(gameSelect.value)
        saveUIState()
    }

    const saved = loadUIState()
    loadSection((saved.game === currentGame.id ? saved.section : null) || currentGame.tierlists[0]?.name)
}

function loadSection(sectionName) {
    currentSection = currentGame.tierlists.find(g => g.name === sectionName) || currentGame.tierlists[0]
    gameSelect.value = currentSection.name

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

            const iconPath = `pictures/icons/${value}.png`

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

    .forEach(btn => btn.classList.remove("active"))
    document.querySelectorAll(".filter-icon-btn")

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



/* -----------------------------
RENDER TIERLIST
----------------------------- */

function renderTierlist() {
    tierlistContainer.innerHTML = ""
    if (!currentTierlist) return

    const features = getCurrentFeatures()
    const isCandy = features.cardStyle === "candy"

    // Only build role header if roles are enabled
    if (features.role) {
        buildRoleHeader(tierlistContainer)
    }

    const tiers = currentTierlist.tiers
    const entries = currentTierlist.entries

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
                            column.appendChild(createCard(c))
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
                        column.appendChild(createCard(c))
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
        counter.textContent = `${totalCards} card${totalCards === 1 ? "" : "s"}`
    }
}



/* -----------------------------
CHARACTER CARD
----------------------------- */
function getCardImagePath(name) {
    if (getCurrentFeatures().cardStyle === "candy") {
        return `pictures/candy/${name}_mc_lv3.png`
    }
    return `pictures/cards/Cookie_${String(name || "").toLowerCase()}_card.png`
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

function createCard(char) {

    const card = document.createElement("div")
    card.className = "card"

    const f = getCurrentFeatures()
    const imgSrc = getCardImagePath(char.name)

    let link
    let newTab = ""

    if (f.cardStyle === "candy") {

        link = getWikiLink(char.displayName ?? char.name)
        newTab = `target="_blank"`

    } else {

        link = `character.html?char=${encodeURIComponent(char.name)}`

    }

    let html = `<a class="portrait" href="${link}" ${newTab}>
        <img src="${imgSrc}" class="character-img" onerror="this.src='pictures/icons/null.png'">`

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