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

