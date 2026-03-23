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