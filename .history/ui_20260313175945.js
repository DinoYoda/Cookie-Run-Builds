let DATA

let currentGame = null
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
const cookieByDate = [
    "Adventurer Cookie",
    "Alchemist Cookie",
    "Angel Cookie",
    "Avocado Cookie",
    "Beet Cookie",
    "Blackberry Cookie",
    "Carrot Cookie",
    "Cherry Cookie",
    "Chili Pepper Cookie",
    "Clover Cookie",
    "Custard Cookie III",
    "Dark Choco Cookie",
    "Espresso Cookie",
    "GingerBrave",
    "Gumball Cookie",
    "Herb Cookie",
    "Knight Cookie",
    "Licorice Cookie",
    "Madeline Cookie",
    "Milk Cookie",
    "Mint Choco Cookie",
    "Muscle Cookie",
    "Ninja Cookie",
    "Onion Cookie",
    "Pancake Cookie",
    "Poison Mushroom Cookie",
    "Pomegranate Cookie",
    "Princess Cookie",
    "Purple Yam Cookie",
    "Rye Cookie",
    "Snow Sugar Cookie",
    "Sparkling Cookie",
    "Strawberry Cookie",
    "Tiger Lily Cookie",
    "Vampire Cookie",
    "Werewolf Cookie",
    "Wizard Cookie",
    "Kumiho Cookie",
    "Cream Puff Cookie",
    "Latte Cookie",
    "Almond Cookie",
    "Black Raisin Cookie",
    "Pure Vanilla Cookie",
    "Strawberry Crepe Cookie",
    "Fig Cookie",
    "Pastry Cookie",
    "Devil Cookie",
    "Red Velvet Cookie",
    "Mango Cookie",
    "Sea Fairy Cookie",
    "Lilac Cookie",
    "Sorbet Shark Cookie",
    "Squid Ink Cookie",
    "Parfait Cookie",
    "Hollyberry Cookie",
    "Raspberry Cookie",
    "Moon Rabbit Cookie",
    "Sonic Cookie",
    "Tails Cookie",
    "Mala Sauce Cookie",
    "Twizzly Gummy Cookie",
    "Pumpkin Pie Cookie",
    "Cotton Cookie",
    "Frost Queen Cookie",
    "Cocoa Cookie",
    "Eclair Cookie",
    "Tea Knight Cookie",
    "Affogato Cookie",
    "Dark Cacao Cookie",
    "Caramel Arrow Cookie",
    "Cherry Blossom Cookie",
    "Clotted Cream Cookie",
    "Wildberry Cookie",
    "Crunchy Chip Cookie",
    "Oyster Cookie",
    "Financier Cookie",
    "Aladdin Cookie",
    "Alice Cookie",
    "Ariel Cookie",
    "Beast Cookie",
    "Belle Cookie",
    "Cinderella Cookie",
    "Daisy Duck Cookie",
    "Donald Duck Cookie",
    "Goofy Cookie",
    "Jasmine Cookie",
    "Lilo Cookie",
    "Mickey Mouse Cookie",
    "Minnie Mouse Cookie",
    "Mulan Cookie",
    "Peter Pan Cookie",
    "Pocahontas Cookie",
    "Princess Aurora Cookie",
    "Snow White Cookie",
    "Stitch Cookie",
    "Tinker Bell Cookie",
    "Cream Unicorn Cookie",
    "Black Pearl Cookie",
    "Captain Caviar Cookie",
    "Candy Diver Cookie",
    "J-hope Cookie",
    "Jimin Cookie",
    "Jin Cookie",
    "Jung Kook Cookie",
    "RM Cookie",
    "Schwarzwälder",
    "SUGA Cookie",
    "V Cookie",
    "BTS",
    "Macaron Cookie",
    "Carol Cookie",
    "Sherbet Cookie",
    "Pinecone Cookie",
    "Prophet Cookie",
    "Milky Way Cookie",
    "Moonlight Cookie",
    "Blueberry Pie Cookie",
    "Space Doughnut",
    "Stardust Cookie",
    "Capsaicin Cookie",
    "Prune Juice Cookie",
    "Kouign-Amann Cookie",
    "Pitaya Dragon Cookie",
    "Royal Margarine Cookie",
    "Snapdragon Cookie",
    "Tarte Tatin Cookie",
    "Rockstar Cookie",
    "Shining Glitter Cookie",
    "Black Lemonade Cookie",
    "Peppermint Cookie",
    "Aquamarine Cookie",
    "Crimson Coral Cookie",
    "Gold Citrine Cookie",
    "Mystic Opal Cookie",
    "Frilled Jellyfish Cookie",
    "Burnt Cheese Cookie",
    "Golden Cheese Cookie",
    "Fettuccine Cookie",
    "Mozzarella Cookie",
    "Olive Cookie",
    "Icicle Yeti Cookie",
    "Crème Brûlée Cookie",
    "Linzer Cookie",
    "Rebel Cookie",
    "Silverbell Cookie",
    "White Lily Cookie",
    "Mercurial Knight Cookie",
    "Elder Faerie Cookie",
    "Matcha Cookie",
    "Butter Roll Cookie",
    "Witchberry Cookie",
    "Caramel Choux Cookie",
    "Street Urchin Cookie",
    "Stormbringer Cookie",
    "Cloud Haetae Cookie",
    "Mystic Flour Cookie",
    "Twisted Donut Cookie",
    "Dark Cacao Cookie (Dragon Lord)",
    "Peach Blossom Cookie",
    "Cream Ferret Cookie",
    "MyCookie",
    "Star Coral Cookie",
    "Wind Archer Cookie",
    "Burning Spice Cookie",
    "Nutmeg Tiger Cookie",
    "Smoked Cheese Cookie",
    "Golden Cheese Cookie (Immortal)",
    "Young Kulfi",
    "Camellia Cookie",
    "Golden Osmanthus Cookie",
    "Red Osmanthus Cookie",
    "Choco Drizzle Cookie",
    "Pudding à la Mode Cookie",
    "Green Tea Mousse Cookie",
    "Okchun Cookie",
    "Rainbow Sherbet Cookie",
    "Candy Apple Cookie",
    "Shadow Milk Cookie",
    "Black Sapphire Cookie",
    "Pure Vanilla Cookie (Compassionate)",
    "Black Forest Cookie",
    "Wedding Cake Cookie",
    "Agar Agar Cookie",
    "Fire Spirit Cookie",
    "Eternal Sugar Cookie",
    "Pavlova Cookie",
    "Hollyberry Cookie (Aegis)",
    "Sugarfly Cookie",
    "Cream Soda Cookie",
    "Lemon Cookie",
    "Marshmallow Bunny Cookie",
    "Orange Cookie",
    "Lime Cookie",
    "Jagae Cookie",
    "Manju Cookie",
    "Grapefruit Cookie",
    "Seltzer Cookie",
    "Doughael",
    "Menthol Cookie",
    "Charcoal Cookie",
    "Silent Salt Cookie",
    "Salt Cellar Cookie",
    "White Lily Cookie (Dawnbringer)",
    "Chess Choco Cookie",
    "Elphaba Cookie",
    "Glinda Cookie",
    "Millennial Tree Cookie",
    "Dark Enchantress Cookie",
    "Mold Dough Cookie",
    "Venom Dough Cookie",
    "Pom-pom Dough Cookie",
    "Sugar Swan Cookie"
];
cookieByDate.forEach((name, index) => {
    releaseOrderMap[name] = index
})

const releaseOrderMapCandy = {}
const candyByDate = [
    "Espresso",
    "Purple Yam",
    "Vampire",
    "Milk",
    "Rye",
    "Squid Ink",
    "Werewolf",
    "Licorice",
    "Cream Puff",
    "Mala Sauce",
    "Latte",
    "Madeleine",
    "Tea Knight",
    "Wildberry",
    "Mango",
    "Parfait",
    "Sea Fairy",
    "Black Pearl",
    "Sorbet Shark",
    "Black Raisin",
    "Snow Queen",
    "Snow Sugar",
    "Financier",
    "Pinecone",
    "Captain Caviar",
    "Cream Unicorn",
    "Strawberry Crepe",
    "Twizzly Gummy",
    "Blueberry Pie",
    "Caramel Arrow",
    "Dark Choco",
    "Moonlight",
    "Mint Choco",
    "Pastry",
    "Peppermint",
    "Frilled Jellyfish",
    "Sparkling",
    "Kouign-Amann",
    "Raspberry",
    "Stormbringer",
    "Silverbell",
    "Green Tea Mousse",
    "Wind Archer",
    "Poison Mushroom",
    "Pomegranate"
];
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
fetch("data.js")
    .then(r => r.json())
    .then(data => {

        DATA = data

        buildGameSelector()

    })



/* -----------------------------
GAME SELECTOR
----------------------------- */

function buildGameSelector() {

    gameSelect.innerHTML = ""

    DATA.games.forEach(game => {

        const option = document.createElement("option")

        option.value = game.id
        option.textContent = game.name

        gameSelect.appendChild(option)

    })

    gameSelect.onchange = () => {
        loadGame(gameSelect.value)
        saveUIState()
    }

    const saved = loadUIState()
    loadGame(saved.game || DATA.games[0].id)

}

function loadGame(gameId) {
    gameSelect.value = gameId
    currentGame = DATA.games.find(g => g.id === gameId)

    // build character lookup
    characterMap = {}
    currentGame.characters.forEach(c => {
        characterMap[c.name] = c
    })

    activeFilters = {}
    searchText = ""

    searchInput.value = ""

    currentGroup = null
    currentSubTab = null
    currentTierlist = null
    console.log(characterMap)
    buildTabs()
    buildFilters()
    renderTierlist()
}



/* -----------------------------
TIERLIST TABS
----------------------------- */

function buildTabs() {

    tierTabs.innerHTML = ""

    currentGame.tierlists.forEach(tierlist => {

        // GROUP TAB
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

        // NORMAL TAB
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
            currentGame.tierlists.find(t => t.name === saved.group) ||
            currentGame.tierlists[0]

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

    currentGame.tierlists.forEach(tierlist => {

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

    const filters = currentGame.filters

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

    document.querySelectorAll(".filter-btn")
        .forEach(btn => btn.classList.remove("active"))

    renderTierlist()

}



/* -----------------------------
FILTER LOGIC
----------------------------- */

function applyFilters(character) {
    // Search filter
    if (searchText) {
        if (!character.name.toLowerCase().includes(searchText)) return false
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
            if (!values.includes(charValue)) {
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

    currentGame.roles.forEach(role => {

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

    // Only build role header if roles are enabled
    if (currentGame.features.role) {
        buildRoleHeader(tierlistContainer)
    }

    const tiers = currentTierlist.tiers
    const entries = currentTierlist.entries

    // Build dynamic rarity order based on filter UI
    const rarityOrder = {}
    currentGame.filters.rarity?.forEach((r, index) => {
        rarityOrder[r] = index
    })

    let totalCards = 0

    tiers.forEach((tierName, i) => {
        const row = document.createElement("div")
        row.className = "tier-row"

        const tierLabel = document.createElement("div")
        tierLabel.className = "tier-label " + tierName
        tierLabel.textContent = tierName
        row.appendChild(tierLabel)

        if (currentGame.features.role) {
            currentGame.roles.forEach(role => {
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
                            return a.name.localeCompare(b.name)
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
                        if (currentGame.id === 'crk') {
                            // 1. Sort by rarity
                            const rarityDiff = (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b.rarity] ??
                                999)
                            if (rarityDiff !== 0) return rarityDiff

                            // 2. Sort by release order (newer cookies first)
                            return (releaseOrderMap[b.name] ?? 9999) - (releaseOrderMap[a.name] ?? 9999)
                        } else if (currentGame.id === 'crk-candy') {
                            return (releaseOrderMapCandy[b.name] ?? 9999) - (releaseOrderMapCandy[a.name] ??
                                9999)
                        }
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
function getCardImagePath(name, id) {
    if (id === 'crk') {
        let newName = name.toLowerCase()

        // 2. Remove 'cookie' at the end if it exists
        newName = newName.replace(/ cookie$/i, "")

        // 3. Replace spaces with underscores
        newName = newName.replace(/\s+/g, "_")

        // 4. Build image path
        return `pictures/icons/cookie_${newName}_card.png`
    } else if (id === 'crk-candy') {
        let newName = name[0] + name.slice(1).toLowerCase()
        newName = newName.replace(/\s+/g, "_")
        return `pictures/icons/${newName}_mc_lv3.png`
    }
}

function getPageImagePath(name) {{
           let lower = name.toLowerCase()

        // 2. Remove 'cookie' at the end if it exists
        lower = lower.replace(/ cookie$/i, "")

        lower = lower.replace(/\s+/g,"_")

        let newName = lower.charAt(0).toUpperCase() + lower.slice(1)

        // 4. Build image path
        return `pictures/chars/${newName}_illustration.png`
    }
}

function getWikiLink(name, id) {
    if (id === 'crk') {
        newName = name.replace(" ", "_");
        let link = "https://cookierunkingdom.fandom.com/wiki/" + newName
        return link
    } else if (id === 'crk-candy') {
        newName = name.replace(" ", "_");
        let link = "https://cookierunkingdom.fandom.com/wiki/" + newName + "_Cookie#Magic_Candy_Skill"
        console.log(link);
        return link
    }
}

function createCard(char) {

    const card = document.createElement("div")
    card.className = "card"

    const imgSrc = getCardImagePath(char.name, currentGame.id)

    let link
    let newTab = ""

    if (currentGame.features?.builds) {

    const slug = getSlug(char.name)

    link = `character.html?char=${slug}`

} else {

        link = getWikiLink(char.name, currentGame.id)
        newTab = `target="_blank"`

    }

    let html = `<a class="portrait" href="${link}" ${newTab}>
        <img src="${imgSrc}" class="character-img">`

    if (currentGame.features?.elementIcon && char.icon) {
        html += `<img class="element-icon" src="${char.icon}">`
    }

    if (currentGame.features?.eidolon) {
        html += `<div class="eidolon">E${char.eidolon ?? 0}</div>`
    }

    html += `</a>`

    html += `<div class="name">${char.name}</div>`

    if (currentGame.features?.tags && char.tags) {
        html += `<div class="tags">${char.tags.join(", ")}</div>`
    }

    if (currentGame.features?.badges && char.badges) {
        html += `<div class="badges">${char.badges.join(", ")}</div>`
    }

    card.innerHTML = html

    return card
}

function getCharacterFromURL(){

    const params = new URLSearchParams(window.location.search)
    return params.get("char")

}


function renderCharacterPage(){

    const slug = getCharacterFromURL()

    if(!slug) return

    const char = DATA.characters.find(c => getSlug(c.name) === slug)

    if(!char) return

    // IMAGE
    document.getElementById("char-image").src =
        getCharacterIllustration(char.name)

    // DESCRIPTION
    document.getElementById("char-description").innerHTML =
        DESCRIPTIONS.description[slug] || ""

    // SKILL
    document.getElementById("char-skill").innerHTML =
        DESCRIPTIONS.skill_description[slug] || ""

    // META INFO
    document.getElementById("char-rarity").textContent = char.rarity || ""
    document.getElementById("char-element").textContent = char.element || ""
    document.getElementById("char-position").textContent = char.position || ""
    document.getElementById("char-type").textContent = char.type || ""

    // BUILDS
    renderBuilds(char)

}


function renderBuilds(char){

    const container = document.getElementById("builds-container")

    container.innerHTML = ""

    if(!char.builds) return

    char.builds.forEach(build => {

        const div = document.createElement("div")
        div.className = "build-card"

        div.innerHTML = `
            <h3>${build.name}</h3>
            <p>${build.description || ""}</p>
        `

        container.appendChild(div)

    })

}
