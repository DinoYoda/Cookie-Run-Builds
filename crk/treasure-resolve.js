/**
 * Shared Template:Crk treasure resolution (wiki keywords, slugs, custom names).
 * Depends on treasure-tag-data.js (CRK_TREASURE_SLUG_MAP, CRK_TREASURE_KEYWORD_DISPLAY).
 * https://cookierun.wiki/w/Template:Crk_treasure
 */
;(function (global) {
  function parseTreasureBracketInner(content) {
    const s = String(content ?? "").trim()
    const parts = s.split("|").map((p) => p.trim())
    const main = (parts[0] ?? "").trim()
    let iconOnly = false
    for (let i = 1; i < parts.length; i++) {
      const f = parts[i].toLowerCase().replace(/\s+/g, "")
      if (f === "icononly" || f === "icononly=true" || f.startsWith("icononly=")) {
        iconOnly = true
        break
      }
    }
    return { main, iconOnly }
  }

  function treasureKwDisplay(kw, key) {
    if (!kw || key == null || key === "") return null
    const k = String(key).trim()
    if (kw[k] != null) return kw[k]
    const spaced = k.replace(/_/g, " ")
    if (kw[spaced] != null) return kw[spaced]
    const low = k.toLowerCase()
    for (const [wk, v] of Object.entries(kw)) {
      if (wk.toLowerCase() === low) return v
    }
    return null
  }

  function treasureDisplayLabel(wikiKey, slug, tmap, kw) {
    const k = String(wikiKey || "").trim()
    const slugL = String(slug || "").trim().toLowerCase()
    const fromKw = (key) => treasureKwDisplay(kw, key)

    let hit = fromKw(k)
    if (hit) return hit

    for (const [mk, ms] of Object.entries(tmap)) {
      if (String(ms).toLowerCase() !== slugL) continue
      hit = fromKw(mk)
      if (hit) return hit
    }

    if (tmap[k] && String(tmap[k]).toLowerCase() === slugL) {
      hit = fromKw(k)
      return hit || k
    }

    const keyAsSlug = k.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "")
    if (keyAsSlug === slugL) {
      for (const [mk, ms] of Object.entries(tmap)) {
        if (String(ms).toLowerCase() !== slugL) continue
        hit = fromKw(mk)
        if (hit) return hit
      }
      return slug.split(/[-_]/g).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ")
    }
    if (k) return k
    return slug.split(/[-_]/g).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ")
  }

  function resolveTreasureWiki(main, tmap, kw) {
    const m = String(main || "").trim()
    const tm = tmap && typeof tmap === "object" ? tmap : {}
    const kwd = kw && typeof kw === "object" ? kw : {}
    if (!m) return { slug: "", display: "" }

    if (tm[m]) {
      const slug = tm[m]
      return { slug, display: treasureDisplayLabel(m, slug, tm, kwd) }
    }
    const spaced = m.replace(/_/g, " ")
    if (tm[spaced]) {
      const slug = tm[spaced]
      return { slug, display: treasureDisplayLabel(spaced, slug, tm, kwd) }
    }
    const hyphen = m.replace(/_/g, "-")
    if (tm[hyphen]) {
      const slug = tm[hyphen]
      return { slug, display: treasureDisplayLabel(m, slug, tm, kwd) }
    }
    const low = m.toLowerCase()
    for (const [mk, ms] of Object.entries(tm)) {
      if (typeof mk !== "string" || !mk) continue
      if (mk.toLowerCase() === low) {
        return { slug: ms, display: treasureDisplayLabel(mk, ms, tm, kwd) }
      }
    }

    for (const [wk, v] of Object.entries(kwd)) {
      if (v && v.toLowerCase() === low && tm[wk]) {
        return { slug: tm[wk], display: v }
      }
    }

    if (/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(m)) {
      const slug = tm[m] || m
      return { slug, display: treasureDisplayLabel(m, slug, tm, kwd) }
    }

    const slug = m.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    return { slug, display: m }
  }

  global.parseTreasureBracketInner = parseTreasureBracketInner
  global.resolveTreasureWiki = resolveTreasureWiki
  global.treasureKwDisplay = treasureKwDisplay
  global.treasureDisplayLabel = treasureDisplayLabel
})(typeof window !== "undefined" ? window : globalThis)
