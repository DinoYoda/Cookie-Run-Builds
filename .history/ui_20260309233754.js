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