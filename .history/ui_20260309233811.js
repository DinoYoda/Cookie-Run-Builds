let DATA

let currentGame
let currentTierlist

let searchText = ""
let activeFilters = {}

fetch("data.js")
.then(r=>r.json())
.then(data=>{

  DATA = data

  buildGameSelector()

})

function buildGameSelector(){

  const select = document.getElementById("gameSelect")

  DATA.games.forEach(game=>{

    const option = document.createElement("option")

    option.value = game.id
    option.textContent = game.name

    select.appendChild(option)

  })

  select.onchange = () => loadGame(select.value)

  loadGame(DATA.games[0].id)

}

function loadGame(gameId){

  currentGame = DATA.games.find(g=>g.id===gameId)

  buildTabs()

  buildFilters()

}

function buildTabs(){

  const container = document.getElementById("tierTabs")

  container.innerHTML = ""

  currentGame.tierlists.forEach(tl=>{

    const tab = document.createElement("button")

    tab.textContent = tl.name

    tab.onclick = ()=>{

      currentTierlist = tl

      renderTierlist()

    }

    container.appendChild(tab)

  })

  currentTierlist = currentGame.tierlists[0]

}

function buildFilters(){

  const container = document.getElementById("filters")

  container.innerHTML=""

  Object.entries(currentGame.filters).forEach(([category,values])=>{

    const group = document.createElement("div")

    group.className="filter-group"

    values.forEach(v=>{

      const btn=document.createElement("button")

      btn.textContent=v

      btn.onclick=()=>{

        activeFilters[category]=v

        renderTierlist()

      }

      group.appendChild(btn)

    })

    container.appendChild(group)

  })

}

function renderTierlist(){

  const container = document.getElementById("tierlist")

  container.innerHTML=""

  buildRoleHeader(container)

  currentTierlist.tiers.forEach(tier=>{

    const row=document.createElement("div")

    row.className="tier-row"

    const label=document.createElement("div")

    label.className="tier-label"
    label.textContent=tier

    row.appendChild(label)

    currentGame.roles.forEach(role=>{

      const col=document.createElement("div")

      col.className="role-column"

      currentTierlist.characters
        .filter(c=>c.tier===tier)
        .filter(c=>c.role===role.id)
        .filter(applyFilters)
        .sort((a,b)=>a.name.localeCompare(b.name))
        .forEach(c=>col.appendChild(createCard(c)))

      row.appendChild(col)

    })

    container.appendChild(row)

  })

}

function createCard(char){

  const card=document.createElement("div")

  card.className="card"

  let tagsHTML=""

  if(currentGame.features.tags && char.tags){

    tagsHTML=`<div class="tags">${char.tags.join(", ")}</div>`

  }

  let eidolonHTML=""

  if(currentGame.features.eidolon){

    eidolonHTML=`<div class="eidolon">E${char.eidolon}</div>`

  }

  let iconHTML=""

  if(currentGame.features.elementIcon){

    iconHTML=`<img class="element" src="${char.icon}">`

  }

  card.innerHTML=`

    <div class="portrait">

      <img src="${char.image}">

      ${iconHTML}

      ${eidolonHTML}

    </div>

    <div class="name">${char.name}</div>

    ${tagsHTML}

  `

  return card

}