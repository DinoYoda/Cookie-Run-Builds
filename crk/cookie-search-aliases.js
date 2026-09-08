/**
 * Cookie search / wiki {{Kch|…}} aliases.
 * Data: tools/cookie_search_aliases.json → { "aliases": { ... } }
 */
;(function (global) {
  function siteRelativePath(file) {
    const p = (location.pathname || "").replace(/\\/g, "/")
    if (/\/crk\/[^/]+\.html$/i.test(p)) return `../${file}`
    return file
  }

  function mergeAliasBlob(out, raw) {
    if (!raw || typeof raw !== "object") return
    const blob = raw.aliases && typeof raw.aliases === "object" ? raw.aliases : raw
    if (!blob || typeof blob !== "object" || Array.isArray(blob)) return
    for (const [k, v] of Object.entries(blob)) {
      if (v == null) continue
      const key = String(k).trim().toLowerCase()
      if (!key || key.startsWith("_")) continue
      out[key] = String(v).trim()
    }
  }

  function buildAutoAbbrevFromCharacters(characters) {
    const byAbbrev = {}
    for (const c of characters || []) {
      const name = String(c?.name || "").trim()
      if (!name || !name.includes("_")) continue
      const parts = name.split("_").filter(Boolean)
      if (parts.length < 2) continue
      let ab = ""
      for (const p of parts) {
        if (p && /[a-z0-9]/i.test(p[0])) ab += p[0].toLowerCase()
      }
      if (ab.length < 2) continue
      if (!byAbbrev[ab]) byAbbrev[ab] = new Set()
      byAbbrev[ab].add(name)
    }
    const out = {}
    for (const [ab, names] of Object.entries(byAbbrev)) {
      if (names.size === 1) out[ab] = [...names][0]
    }
    return out
  }

  let storedAliasPromise = null

  /** Aliases from tools/cookie_search_aliases.json. */
  function loadStoredCookieAliases(basePath) {
    if (storedAliasPromise) return storedAliasPromise
    const root = basePath || siteRelativePath("tools")
    storedAliasPromise = fetch(`${root}/cookie_search_aliases.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        const out = {}
        mergeAliasBlob(out, data?.aliases)
        // legacy wiki/custom sections
        mergeAliasBlob(out, data?.wiki)
        mergeAliasBlob(out, data?.custom)
        return out
      })
      .catch(() => ({}))
    return storedAliasPromise
  }

  function buildAliasMap(characters, storedExtras) {
    return { ...buildAutoAbbrevFromCharacters(characters), ...(storedExtras || {}) }
  }

  /** Display label for search (no duplicate slug). */
  function buildSearchHaystack(char) {
    if (!char) return ""
    const displayName = char.displayName != null ? String(char.displayName).trim() : ""
    if (displayName) return displayName.toLowerCase()
    const spaced = char.name ? String(char.name).replace(/_/g, " ") : ""
    return spaced.toLowerCase()
  }

  function buildSearchSlug(char) {
    return char?.name ? String(char.name).trim().toLowerCase() : ""
  }

  /** Query (spaces stripped) appears contiguously in the display name (spaces stripped). */
  function matchesCompactContiguous(query, label) {
    const q = normalizeCompact(query)
    if (!q) return true
    return normalizeCompact(label).includes(q)
  }

  /** Each query character matches the start of a later word (e.g. smc → Shadow Milk Cookie). */
  function matchesWordInitialSubsequence(query, label) {
    const q = normalizeCompact(query)
    if (!q) return true
    const words = searchWordsFromLabel(label)
    if (!words.length) return false
    let qi = 0
    for (let wi = 0; wi < words.length && qi < q.length; wi++) {
      const word = words[wi]
      if (word && word[0] === q[qi]) qi++
    }
    return qi === q.length
  }

  function normalizeCompact(text) {
    return String(text || "").toLowerCase().replace(/\s+/g, "")
  }

  function searchWordsFromLabel(label) {
    return String(label || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
  }

  /** Compact substring in name, or word-initial abbreviation — not free subsequence. */
  function matchesAbbreviationSearch(query, label) {
    if (!query || !String(query).trim()) return true
    return matchesCompactContiguous(query, label) || matchesWordInitialSubsequence(query, label)
  }

  /** @deprecated use matchesAbbreviationSearch */
  function isOrderedSubsequence(needle, haystack) {
    return matchesAbbreviationSearch(needle, haystack)
  }

  function cookieMatchesSearch(char, query, aliasMap) {
    if (!query) return true
    const q = String(query).trim().toLowerCase()
    if (!q) return true
    if (!char) return false

    const haystack = buildSearchHaystack(char)
    const slug = buildSearchSlug(char)
    const slugSpaced = slug.replace(/_/g, " ")
    if (haystack.includes(q) || slug.includes(q) || slugSpaced.includes(q)) return true
    if (matchesAbbreviationSearch(q, haystack)) return true

    const name = String(char.name || "")
    const map = aliasMap && typeof aliasMap === "object" ? aliasMap : {}

    const exact = map[q]
    if (exact && exact === name) return true

    for (const [alias, targetName] of Object.entries(map)) {
      if (targetName !== name) continue
      if (alias === q) return true
      if (q.length >= 2 && alias.startsWith(q)) return true
      if (matchesAbbreviationSearch(q, alias)) return true
    }

    return false
  }

  global.CookieSearchAliases = {
    siteRelativePath,
    buildAutoAbbrevFromCharacters,
    buildAliasMap,
    loadStoredCookieAliases,
    /** @deprecated use loadStoredCookieAliases */
    loadManualKchAliases: loadStoredCookieAliases,
    buildSearchHaystack,
    buildSearchSlug,
    normalizeCompact,
    matchesCompactContiguous,
    matchesWordInitialSubsequence,
    matchesAbbreviationSearch,
    isOrderedSubsequence,
    cookieMatchesSearch,
  }
})(typeof window !== "undefined" ? window : globalThis)
