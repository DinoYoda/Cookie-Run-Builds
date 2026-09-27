/**
 * Game-aware sidebar: hide CRK-only links and update labels when another game is selected.
 */
;(function () {
  const UI_STATE_KEY = "tierlistUIState"

  function selectedGameId() {
    try {
      const s = JSON.parse(localStorage.getItem(UI_STATE_KEY) || "{}")
      if (s.game) return s.game
    } catch {}
    return window.CRK_DATA?.games?.[0]?.id || "crk"
  }

  function gameById(id) {
    return (window.CRK_DATA?.games || []).find(g => g && g.id === id) || null
  }

  function syncSidebarNav() {
    const id = selectedGameId()
    const game = gameById(id)
    const isCrk = id === "crk"

    document.querySelectorAll("[data-crk-only]").forEach(el => {
      el.hidden = !isCrk
    })

    const charsLink = document.querySelector('.sidebar-link[href*="characters.html"]')
    if (charsLink) {
      charsLink.textContent = game?.listLabel || (isCrk ? "Cookies" : "Characters")
    }

    document.querySelectorAll("[data-game-list-title]").forEach(el => {
      el.textContent = game?.listLabel || (isCrk ? "Cookies" : "Characters")
    })
  }

  function start() {
    syncSidebarNav()
    window.addEventListener("crkSettingsChanged", syncSidebarNav)
  }

  if (typeof whenGamesReady === "function") whenGamesReady(start)
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start)
  else start()
})()
