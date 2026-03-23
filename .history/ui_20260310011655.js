let DATA

let currentGame = null
let currentTierlist = null

let searchText = ""
let activeFilters = {}

const gameSelect = document.getElementById("gameSelect")
const tierTabs = document.getElementById("tierTabs")
const filtersContainer = document.getElementById("filters")
const tierlistContainer = document.getElementById("tierlist")
const searchInput = document.getElementById("search")
const resetBtn = document.getElementById("reset")



/* -----------------------------
LOAD DATA
----------------------------- */

fetch("data.js")
.then(r => r.json())
.then(data => {

    DATA = data

    buildGameSelector()

})



/* -----------------------------
GAME SELECTOR
----------------------------- */

function buildGameSelector(){

    gameSelect.innerHTML = ""

    DATA.games.forEach(game => {

        const option = document.createElement("option")

        option.value = game.id
        option.textContent = game.name

        gameSelect.appendChild(option)

    })

    gameSelect.onchange = () => {

        loadGame(gameSelect.value)

    }

    loadGame(DATA.games[0].id)

}



function loadGame(gameId){

    currentGame = DATA.games.find(g => g.id === gameId)

    activeFilters = {}
    searchText = ""

    searchInput.value = ""

    buildTabs()
    buildFilters()

    renderTierlist()

}



/* -----------------------------
TIERLIST TABS
----------------------------- */

function buildTabs(){

    tierTabs.innerHTML = ""

    currentGame.tierlists.forEach((tierlist, index) => {

        const tab = document.createElement("button")

        tab.textContent = tierlist.name
        tab.className = "tier-tab"

        tab.onclick = () => {

            currentTierlist = tierlist

            updateActiveTab(tab)

            renderTierlist()

        }

        if(index === 0){

            currentTierlist = tierlist
            tab.classList.add("active")

        }

        tierTabs.appendChild(tab)

    })

}



function updateActiveTab(active){

    document.querySelectorAll(".tier-tab").forEach(t => {

        t.classList.remove("active")

    })

    active.classList.add("active")

}



/* -----------------------------
FILTER UI
----------------------------- */

function buildFilters(){

    filtersContainer.innerHTML=""

    const filters = currentGame.filters

    Object.entries(filters).forEach(([category,values])=>{

        const group=document.createElement("div")
        group.className="filter-group"

        values.forEach(value=>{

            const btn=document.createElement("button")

            btn.className="filter-icon-btn"

            btn.dataset.category = category
            btn.dataset.value = value

            const iconPath = `icons/${value}.png`

            btn.title = value

            btn.innerHTML = `
                <img src="${iconPath}" alt="${value}">
            `

            btn.onclick = ()=>{

                if(activeFilters[category] === value){

                    delete activeFilters[category]
                    btn.classList.remove("active")

                }else{

                    activeFilters[category] = value

                    group.querySelectorAll("button")
                        .forEach(b=>b.classList.remove("active"))

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

function applyFilters(character){
    // Search filter
    if(searchText){
        if(!character.name.toLowerCase().includes(searchText)) return false
    }

    // Category filters
    for(const [category, value] of Object.entries(activeFilters)){
        const charValue = character[category]

        if(Array.isArray(charValue)){
            // Pass if any value matches
            if(!charValue.includes(value)) return false
        } else {
            // Single value
            if(charValue != value) return false
        }
    }

    return true
}



/* -----------------------------
ROLE HEADER
----------------------------- */

function buildRoleHeader(container){

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
                        .map(name => currentGame.characters.find(c => c.name === name))
                        .filter(Boolean)
                        .filter(c => c.role === role.name)
                        .filter(applyFilters)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .forEach(c => column.appendChild(createCard(c)))
                }

                row.appendChild(column)
            })
        } else {
            const column = document.createElement("div")
            column.className = "tier-column"

            if (entries[i]) {
                entries[i]
                    .map(name => currentGame.characters.find(c => c.name === name))
                    .filter(Boolean)
                    .filter(applyFilters)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .forEach(c => column.appendChild(createCard(c)))
            }

            row.appendChild(column)
        }

        tierlistContainer.appendChild(row)
    })
}

// Example: createCard also checks features
function createCard(char) {
    const card = document.createElement("div")
    card.className = "card"

    let html = `<div class="portrait"><img src="${char.image}" class="character-img">`

    if (currentGame.features.elementIcon && char.icon) {
        html += `<img class="element-icon" src="${char.icon}">`
    }

    if (currentGame.features.eidolon) {
        html += `<div class="eidolon">E${char.eidolon ?? 0}</div>`
    }

    html += `</div><div class="name">${char.name}</div>`

    if (currentGame.features.tags && char.tags) {
        html += `<div class="tags">${char.tags.join(", ")}</div>`
    }

    if (currentGame.features.badges && char.badges) {
        html += `<div class="badges">${char.badges.join(", ")}</div>`
    }

    card.innerHTML = html
    return card
}



/* -----------------------------
CHARACTER CARD
----------------------------- */
function getCardImagePath(name) {
    // 1. Convert to lowercase
    let newName = name.toLowerCase()

    // 2. Remove 'cookie' at the end if it exists
    newName = newName.replace(/ cookie$/i, "")

    // 3. Replace spaces with underscores
    newName = newName.replace(/\s+/g, "_")

    // 4. Build image path
    return `images/cookie_${newName}_card.png`
}
function createCard(char) {
    const card = document.createElement("div")
    card.className = "card"

    const imgSrc = getCardImagePath(char.name)

    let html = `<div class="portrait"><img src="${imgSrc}" class="character-img">`

    if(currentGame.features.elementIcon && char.icon){
        html += `<img class="element-icon" src="${char.icon}">`
    }

    if(currentGame.features.eidolon){
        html += `<div class="eidolon">E${char.eidolon ?? 0}</div>`
    }

    html += `</div><div class="name">${char.name}</div>`

    if(currentGame.features.tags && char.tags){
        html += `<div class="tags">${char.tags.join(", ")}</div>`
    }

    if(currentGame.features.badges && char.badges){
        html += `<div class="badges">${char.badges.join(", ")}</div>`
    }

    card.innerHTML = html
    return card
}