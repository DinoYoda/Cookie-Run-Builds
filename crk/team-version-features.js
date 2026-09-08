/**
 * Game-version gates for team build display (data stays modern; UI hides unavailable systems).
 * Per-resonance dates: tools/resonant_toppings.json → "update" on each entry.
 */
;(function () {
  const TEAM_FEATURE_MIN_VERSION = {
    beascuits: "5.0",
    resonantToppings: "4.4",
    tarts: "6.3",
    legendaryTarts: "7.7",
  }

  let _resonanceUpdateMap = null
  let _resonanceMapPromise = null

  function siteRelativePath(file) {
    const p = (location.pathname || "").replace(/\\/g, "/")
    if (/\/crk\/[^/]+\.html$/i.test(p)) return `../${file}`
    return file
  }

  function parseGameVersion(version) {
    if (version == null) return null
    const s = String(version).trim()
    if (!s) return null
    const m = s.match(/^(\d+)(?:\.(\d+))?$/)
    if (!m) return null
    return {
      major: parseInt(m[1], 10),
      minor: parseInt(m[2] || "0", 10),
    }
  }

  function compareGameVersion(a, b) {
    const pa = parseGameVersion(a)
    const pb = parseGameVersion(b)
    if (!pa && !pb) return 0
    if (!pa) return -1
    if (!pb) return 1
    if (pa.major !== pb.major) return pa.major - pb.major
    return pa.minor - pb.minor
  }

  function gameVersionAtLeast(version, minVersion) {
    return compareGameVersion(version, minVersion) >= 0
  }

  function normalizeResonanceSlug(slug) {
    return String(slug || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_")
  }

  function buildResonanceUpdateMap(resonantMap) {
    const out = {}
    if (!resonantMap || typeof resonantMap !== "object") return out
    for (const [slug, raw] of Object.entries(resonantMap)) {
      if (!slug || slug.startsWith("_")) continue
      let minVersion = TEAM_FEATURE_MIN_VERSION.resonantToppings
      if (raw && typeof raw === "object" && !Array.isArray(raw) && raw.update != null) {
        const u = String(raw.update).trim()
        if (u) minVersion = u
      }
      out[normalizeResonanceSlug(slug)] = minVersion
    }
    return out
  }

  function loadResonanceUpdateMap() {
    if (_resonanceUpdateMap) return Promise.resolve(_resonanceUpdateMap)
    if (!_resonanceMapPromise) {
      _resonanceMapPromise = fetch(siteRelativePath("tools/resonant_toppings.json"))
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          _resonanceUpdateMap = buildResonanceUpdateMap(j)
          return _resonanceUpdateMap
        })
        .catch(() => {
          _resonanceUpdateMap = {}
          return _resonanceUpdateMap
        })
    }
    return _resonanceMapPromise
  }

  /**
   * @param {string|null|undefined} gameVersion — omit/null = current meta (show all).
   */
  function getTeamRenderFeatures(gameVersion) {
    if (gameVersion == null || String(gameVersion).trim() === "") {
      return {
        beascuits: true,
        resonantToppings: true,
        tarts: true,
        legendaryTarts: true,
      }
    }
    return {
      beascuits: gameVersionAtLeast(gameVersion, TEAM_FEATURE_MIN_VERSION.beascuits),
      resonantToppings: gameVersionAtLeast(gameVersion, TEAM_FEATURE_MIN_VERSION.resonantToppings),
      tarts: gameVersionAtLeast(gameVersion, TEAM_FEATURE_MIN_VERSION.tarts),
      legendaryTarts: gameVersionAtLeast(gameVersion, TEAM_FEATURE_MIN_VERSION.legendaryTarts),
    }
  }

  /**
   * Returns resonance slug for display, or null → render epic toppings instead.
   * @param {object|null|undefined} updateMap from loadResonanceUpdateMap()
   */
  function resolveResonanceForGameVersion(resonance, gameVersion, updateMap) {
    if (resonance == null || String(resonance).trim() === "") return null
    if (gameVersion == null || String(gameVersion).trim() === "") return resonance

    if (!gameVersionAtLeast(gameVersion, TEAM_FEATURE_MIN_VERSION.resonantToppings)) {
      return null
    }

    const slug = normalizeResonanceSlug(resonance)
    const minVer =
      (updateMap && updateMap[slug]) || TEAM_FEATURE_MIN_VERSION.resonantToppings
    if (!gameVersionAtLeast(gameVersion, minVer)) return null
    return resonance
  }

  window.TEAM_FEATURE_MIN_VERSION = TEAM_FEATURE_MIN_VERSION
  window.parseGameVersion = parseGameVersion
  window.compareGameVersion = compareGameVersion
  window.gameVersionAtLeast = gameVersionAtLeast
  window.normalizeResonanceSlug = normalizeResonanceSlug
  window.buildResonanceUpdateMap = buildResonanceUpdateMap
  window.loadResonanceUpdateMap = loadResonanceUpdateMap
  window.getTeamRenderFeatures = getTeamRenderFeatures
  window.resolveResonanceForGameVersion = resolveResonanceForGameVersion
})()
