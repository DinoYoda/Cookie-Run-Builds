let DATA
let activeFilters = {}

fetch("characters.json")
  .then(r => r.json())
  .then(data => {

    DATA = data

    buildFilters()
    renderTierlist()
  })


function buildFilters(){

  const container = document.getElementById("filters")

  Object.entries(DATA.filters).forEach(([category, values]) => {

    const group = document.createElement("div")
    group.className = "filter-group"

    values.forEach(value => {

      const btn = document.createElement("button")
      btn.textContent = value
      btn.dataset.category = category
      btn.dataset.value = value

      btn.onclick = () => toggleFilter(category,value,btn)

      group.appendChild(btn)

    })

    container.appendChild(group)

  })

}


function toggleFilter(category,value,btn){

  if(activeFilters[category] === value){

    delete activeFilters[category]
    btn.classList.remove("active")

  }else{

    activeFilters[category] = value

    document
      .querySelectorAll(`[data-category="${category}"]`)
      .forEach(b => b.classList.remove("active"))

    btn.classList.add("active")

  }

  renderTierlist()

}


function renderTierlist(){

  const container = document.getElementById("tierlist")
  container.innerHTML = ""

  DATA.tiers.forEach(tier => {

    const row = document.createElement("div")
    row.className = "tier-row"

    const label = document.createElement("div")
    label.className = "tier-label"
    label.textContent = tier

    const cards = document.createElement("div")
    cards.className = "tier-cards"

    DATA.characters
      .filter(c => c.tier === tier)
      .filter(applyFilters)
      .sort((a,b)=>a.name.localeCompare(b.name))
      .forEach(c => cards.appendChild(createCard(c)))

    row.appendChild(label)
    row.appendChild(cards)

    container.appendChild(row)

  })

}


function applyFilters(char){

  if(searchText && !char.name.toLowerCase().includes(searchText))
    return false

  return Object.entries(activeFilters)
    .every(([k,v]) => char[k] === v)
}


function createCard(char){

  const card = document.createElement("div")
  card.className = "card"

  card.innerHTML = `
    <img src="${char.image}">
    <div class="name">${char.name}</div>
  `

  return card

}