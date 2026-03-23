;(function () {
    const UI_STATE_KEY = "tierlistUIState"
    const FALLBACK_GAMES = [
        { id: "crk", name: "Cookie Run: Kingdom" },
        { id: "toa", name: "Tales of Aria" }
    ]

    const btn  = document.getElementById("sidebarGameBtn")
    const menu = document.getElementById("sidebarGameMenu")
    const nameEl = document.getElementById("sidebarGameName")
    if (!btn || !menu || !nameEl) return

    let state = {}
    try { state = JSON.parse(localStorage.getItem(UI_STATE_KEY)) || {} } catch {}
    const activeId = state.game || "crk"

    const games = (window.CRK_DATA?.games || FALLBACK_GAMES).map(g => ({
        id: g.id,
        name: g.name || FALLBACK_GAMES.find(f => f.id === g.id)?.name || g.id
    }))

    nameEl.textContent = games.find(g => g.id === activeId)?.name || activeId

    games.forEach(g => {
        const opt = document.createElement("button")
        opt.className = "sidebar-game-option" + (g.id === activeId ? " active" : "")
        opt.dataset.game = g.id
        opt.textContent = g.name
        opt.addEventListener("click", e => {
            e.stopPropagation()
            const newState = Object.assign({}, state, { game: g.id, section: null, group: null, sub: null })
            localStorage.setItem(UI_STATE_KEY, JSON.stringify(newState))
            if (typeof loadGame === "function") {
                loadGame(g.id)
                menu.classList.remove("open")
                btn.classList.remove("open")
            } else {
                window.location.href = "index.html"
            }
        })
        menu.appendChild(opt)
    })

    btn.addEventListener("click", e => {
        e.stopPropagation()
        menu.classList.toggle("open")
        btn.classList.toggle("open")
    })

    document.addEventListener("click", () => {
        menu.classList.remove("open")
        btn.classList.remove("open")
    })

    menu.addEventListener("click", e => e.stopPropagation())
})()
