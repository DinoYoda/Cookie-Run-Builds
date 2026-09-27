;(function () {
    function siteRelativePath(file) {
        const p = (location.pathname || "").replace(/\\/g, "/")
        if (/\/(?:crk|crc)\/[^/]+\.html$/i.test(p)) return "../" + file
        return file
    }

    function loadScript(relativePath) {
        const src = siteRelativePath(relativePath)
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve()
                return
            }
            const s = document.createElement("script")
            s.src = src
            s.onload = () => resolve()
            s.onerror = () => reject(new Error("Failed to load " + src))
            document.head.appendChild(s)
        })
    }

    function resolveGames() {
        if (Array.isArray(window.GAMES) && window.GAMES.length) {
            return window.GAMES.filter(g => g && g.id).map(g => ({
                id: g.id,
                name: g.name || g.id
            }))
        }
        return (window.CRK_DATA?.games || [])
            .filter(g => g && g.id)
            .map(g => ({
                id: g.id,
                name: g.name || g.id
            }))
    }

    async function ensureRegistry() {
        if (Array.isArray(window.GAMES) && window.GAMES.length) return
        if (Array.isArray(window.GAME_IDS) && window.GAME_IDS.length) return
        await loadScript("games-registry.js")
    }

    function initSidebarGameSelector() {
        const UI_STATE_KEY = "tierlistUIState"

        const btn  = document.getElementById("sidebarGameBtn")
        const menu = document.getElementById("sidebarGameMenu")
        const nameEl = document.getElementById("sidebarGameName")
        if (!btn || !menu || !nameEl) return
        const selectorRoot = btn.closest(".sidebar-game-selector")

        const games = resolveGames()
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

        if (selectorRoot) selectorRoot.classList.add("is-visible")

        nameEl.textContent = games.find(g => g.id === activeId)?.name || activeId

        menu.innerHTML = ""
        games.forEach(g => {
            const opt = document.createElement("button")
            opt.className = "sidebar-game-option" + (g.id === activeId ? " active" : "")
            opt.dataset.game = g.id
            opt.textContent = g.name
            opt.addEventListener("click", e => {
                e.stopPropagation()
                menu.classList.remove("open")
                btn.classList.remove("open")
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
    }

    ensureRegistry()
        .then(initSidebarGameSelector)
        .catch(() => initSidebarGameSelector())
})()
