;(function () {
    function siteRelativePath(file) {
        const p = (location.pathname || "").replace(/\\/g, "/")
        if (/\/crk\/[^/]+\.html$/i.test(p)) return "../" + file
        return file
    }

    const UI_STATE_KEY = "tierlistUIState"

    const btn  = document.getElementById("sidebarGameBtn")
    const menu = document.getElementById("sidebarGameMenu")
    const nameEl = document.getElementById("sidebarGameName")
    if (!btn || !menu || !nameEl) return
    const selectorRoot = btn.closest(".sidebar-game-selector")

    const games = (window.CRK_DATA?.games || [])
        .filter(g => g && g.id)
        .map(g => ({
            id: g.id,
            name: g.name || g.id
        }))
    if (!games.length) {
        if (selectorRoot) selectorRoot.remove()
        return
    }

    let state = {}
    try { state = JSON.parse(localStorage.getItem(UI_STATE_KEY)) || {} } catch {}
    const activeId = state.game || games[0].id

    if (games.length === 1) {
        if (selectorRoot) selectorRoot.remove()
        return
    }

    nameEl.textContent = games.find(g => g.id === activeId)?.name || activeId

    games.forEach(g => {
        const opt = document.createElement("button")
        opt.className = "sidebar-game-option" + (g.id === activeId ? " active" : "")
        opt.dataset.game = g.id
        opt.textContent = g.name
        opt.addEventListener("click", e => {
            e.stopPropagation()
            menu.classList.remove("open")
            btn.classList.remove("open")
            const path = window.location.pathname || ""
            const onCharsHome = /characters\.html$/i.test(path)
            if (g.id === activeId && onCharsHome) return
            const newState = Object.assign({}, state, { game: g.id, section: null, group: null, sub: null })
            localStorage.setItem(UI_STATE_KEY, JSON.stringify(newState))
            window.location.href = siteRelativePath("characters.html")
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
