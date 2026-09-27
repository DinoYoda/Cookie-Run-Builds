/**
 * Loads per-game data into window.CRK_DATA.games.
 * CRK uses cookie-data.js + team-data.js + tier-data.js; other games use {gameId}/data.js.
 * Each chunk calls window.registerGameData({ id, ... }) (merged by id).
 */
;(function () {
  window.CRK_DATA = window.CRK_DATA || { games: [] }
  if (!Array.isArray(window.CRK_DATA.games)) window.CRK_DATA.games = []

  window.registerGameData = function (game) {
    if (!game || !game.id) return
    const i = window.CRK_DATA.games.findIndex(g => g && g.id === game.id)
    if (i >= 0) window.CRK_DATA.games[i] = { ...window.CRK_DATA.games[i], ...game }
    else window.CRK_DATA.games.push({ ...game })
  }

  const CRK_DATA_PARTS = ["cookie-data.js", "team-data.js", "tier-data.js"]

  function gameDataScriptSrcs(gameId) {
    const p = (location.pathname || "").replace(/\\/g, "/")
    const inGameSubdir = new RegExp("/" + gameId + "/[^/]+\\.html$", "i").test(p)
    if (gameId === "crk") {
      if (inGameSubdir) return CRK_DATA_PARTS.slice()
      if (/\/crk\/[^/]+\.html$/i.test(p)) {
        return CRK_DATA_PARTS.map(f => "../crk/" + f)
      }
      return CRK_DATA_PARTS.map(f => "crk/" + f)
    }
    if (inGameSubdir) return ["data.js"]
    if (/\/crk\/[^/]+\.html$/i.test(p)) {
      return ["../" + gameId + "/data.js"]
    }
    return [gameId + "/data.js"]
  }

  function finishGameDataLoad() {
    window.__gamesReady = true
    window.dispatchEvent(new Event("gamesDataReady"))
  }

  window.whenGamesReady = function (fn) {
    if (window.__gamesReady) fn()
    else window.addEventListener("gamesDataReady", fn, { once: true })
  }

  window.finishGameDataLoad = finishGameDataLoad

  window.loadGameDataFiles = function (ids) {
    const list = (ids || []).filter(Boolean)
    if (!list.length) {
      finishGameDataLoad()
      return
    }
    const urls = list.flatMap(id => gameDataScriptSrcs(id))
    let pending = urls.length
    urls.forEach(src => {
      const s = document.createElement("script")
      s.src = src
      s.onload = s.onerror = function () {
        pending -= 1
        if (pending <= 0) finishGameDataLoad()
      }
      document.head.appendChild(s)
    })
  }

  function bootFromRegistry() {
    if (Array.isArray(window.GAME_IDS) && window.GAME_IDS.length) {
      window.loadGameDataFiles(window.GAME_IDS)
    }
  }

  window.bootGameDataFromRegistry = bootFromRegistry
  bootFromRegistry()
})()
