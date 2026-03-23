let DATA

let searchText = ""
let activeFilters = {}

fetch("characters.json")
.then(r => r.json())
.then(data => {

  DATA = data

  buildFilters()
  buildRoleHeader()
  renderTierlist()

})


document.getElementById("search").oninput = e => {

  searchText = e.target.value.toLowerCase()

  renderTierlist()

}


document.getElementById("reset").onclick = () => {

  searchText = ""

  activeFilters = {}

  document.querySelectorAll(".active")
  .forEach(x=>x.classList.remove("active"))

  document.getElementById("search").value = ""

  renderTierlist()

}



function buildFilters(){

  const container = document.getElementById("filters")

  Object.entries(DATA.filters).forEach(([category,values])=>{

    const group = document.createElement("div")

    group.className="filter-group"

    const all = createFilterButton("*",category,null)

    group.appendChild(all)

    values.forEach(v=>{

      group.appendChild(createFilterButton(v,category,v))

    })

    container.appendChild(group)

  })

}



function createFilterButton(label,category,value){

  const btn = document.createElement("button")

  btn.textContent = label

  btn.onclick = ()=>{

    if(value === null){

      delete activeFilters[category]

    }else{

      activeFilters[category] = value

    }

    document
    .querySelectorAll(`[data-category="${category}"]`)
    .forEach(x=>x.classList.remove("active"))

    btn.classList.add("active")

    renderTierlist()

  }

  btn.dataset.category = category

  return btn

}



function buildRoleHeader(){

  const tierlist = document.getElementById("tierlist")

  const header = document.createElement("div")

  header.className = "role-header"

  header.appendChild(document.createElement("div"))

  DATA.roles.forEach(r=>{

    const h = document.createElement("div")

    h.textContent = r.name

    header.appendChild(h)

  })

  tierlist.appendChild(header)

}



function renderTierlist(){

  const tierlist = document.getElementById("tierlist")

  tierlist.querySelectorAll(".tier-row").forEach(x=>x.remove())

  DATA.tiers.forEach(tier=>{

    const row = document.createElement("div")

    row.className = "tier-row"

    const label = document.createElement("div")

    label.className = "tier-label"

    label.textContent = tier

    row.appendChild(label)

    DATA.roles.forEach(role=>{

      const column = document.createElement("div")

      column.className = "role-column"

      DATA.characters

      .filter(c=>c.tier === tier)
      .filter(c=>c.role === role.id)
      .filter(applyFilters)
      .sort((a,b)=>a.name.localeCompare(b.name))

      .forEach(c=>column.appendChild(createCard(c)))

      row.appendChild(column)

    })

    tierlist.appendChild(row)

  })

}



function applyFilters(char){

  if(searchText && !char.name.toLowerCase().includes(searchText))
    return false

  return Object.entries(activeFilters)
  .every(([k,v])=>char[k] === v)

}



function createCard(char){

  const card = document.createElement("div")

  card.className = "card"

  card.innerHTML = `

    <div class="portrait">

      <img src="${char.image}">

      <img class="element" src="${char.icon}">

      <div class="eidolon">E${char.eidolon}</div>

    </div>

    <div class="name">${char.name}</div>

    <div class="tags">

      ${char.tags.map(t=>t.toUpperCase()).join(", ")}

    </div>

  `

  return card

}