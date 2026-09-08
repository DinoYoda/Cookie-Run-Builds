/**
 * Tierlist feedback form — cookie, tier list, suggested tier, reason.
 */
(function () {
    const COOKIE_SECTION = "Cookies"
    const WORLD_EXPLORATION = "World Exploration"

    function getConfig() {
        const base = window.TIER_FEEDBACK_CONFIG || {}
        const local = window.TIER_FEEDBACK_CONFIG_LOCAL || {}
        return { ...base, ...local }
    }

    /** Cookie tier lists in page order (tabs left-to-right, sub-tabs top-to-bottom). */
    function collectTierlistOptions(game) {
        if (!game?.tierlists) return []
        const cookiesSection = game.tierlists.find(s => s.name === COOKIE_SECTION)
        if (!cookiesSection?.tierlists) return []
        const out = []
        function walk(nodes) {
            for (const n of nodes) {
                if (!n || n.computedAverage) continue
                if (n.tiers && Array.isArray(n.entries)) {
                    out.push({ name: n.name, tiers: [...n.tiers] })
                } else if (n.tierlists) {
                    walk(n.tierlists)
                }
            }
        }
        walk(cookiesSection.tierlists)
        return out
    }

    function cookieSearchHaystack(character) {
        let searchBase = character.name ? character.name.replace(/_/g, " ") : ""
        if (character.displayName && /cookie/i.test(character.displayName) && !/cookie/i.test(searchBase)) {
            searchBase += (searchBase ? " " : "") + "cookie"
        }
        return [searchBase, character.displayName].filter(Boolean).join(" ").toLowerCase()
    }

    function cookieMatchesSearch(character, query) {
        const CSA = typeof CookieSearchAliases !== "undefined" ? CookieSearchAliases : null
        if (CSA) return CSA.cookieMatchesSearch(character, query, {})
        const q = String(query || "").trim().toLowerCase()
        if (!q) return true
        const haystack = cookieSearchHaystack(character)
        return haystack.includes(q)
    }

    /** @returns {{ label: string, id: string, character: object }[]} */
    function collectCookieOptions(characters) {
        if (!Array.isArray(characters)) return []
        const seen = new Set()
        const out = []
        for (const c of characters) {
            const id = c.name
            if (!id || seen.has(id)) continue
            if (typeof characterPassesCnExFilter === "function" && !characterPassesCnExFilter(c)) continue
            if (typeof characterPassesBetaFilter === "function" && !characterPassesBetaFilter(c)) continue
            seen.add(id)
            out.push({ label: c.displayName || c.name, id, character: c })
        }
        out.sort((a, b) => a.label.localeCompare(b.label))
        return out
    }

    function findCookieOption(options, idOrLabel) {
        const q = String(idOrLabel || "").trim()
        if (!q) return null
        return options.find(o => o.id === q || o.label === q)
            || options.find(o => o.label.toLowerCase() === q.toLowerCase())
            || null
    }

    /** Suggested-tier options always match World Exploration. */
    function getSuggestedTierOptions(game) {
        const worldEx = collectTierlistOptions(game).find(o => o.name === WORLD_EXPLORATION)
        return worldEx?.tiers?.length
            ? [...worldEx.tiers]
            : ["S+", "S", "A+", "A", "B", "C", "D", "E"]
    }

    function findTierlistOption(options, name) {
        const n = String(name || "").trim()
        return options.find(o => o.name === n) || null
    }

    function buildPayload(fields) {
        const cookie = String(fields.cookieLabel || "").trim()
        const tierlist = String(fields.tierlistLabel || "").trim()
        const suggestedTier = String(fields.suggestedTier || "").trim()
        const reason = String(fields.reason || "").trim()

        if (!cookie) throw new Error("Select a cookie.")
        if (!tierlist) throw new Error("Select a tier list.")
        if (!suggestedTier) throw new Error("Select a suggested tier.")
        if (!reason) throw new Error("Enter your reasoning.")

        return {
            cookie,
            cookieId: fields.cookieId || null,
            tierlist,
            suggestedTier,
            reason,
            pageUrl: typeof location !== "undefined" ? location.href : "",
            submittedAt: new Date().toISOString(),
        }
    }

    function resolveSubmitUrl() {
        const { submitUrl, listUrl } = getConfig()
        if (submitUrl) return submitUrl
        if (listUrl) return listUrl
        if (typeof location !== "undefined") {
            const host = location.hostname
            if (host === "localhost" || host === "127.0.0.1") {
                return `${location.origin}/api/tier-feedback`
            }
        }
        return ""
    }

    function resolveListUrl() {
        const { listUrl, submitUrl } = getConfig()
        return listUrl || submitUrl || ""
    }

    function resolveAdminToken() {
        const { adminToken } = getConfig()
        if (adminToken) return adminToken
        if (typeof location === "undefined") return ""
        try {
            const fromUrl = new URL(location.href).searchParams.get("token")
            if (fromUrl) {
                sessionStorage.setItem("tierFeedbackAdminToken", fromUrl)
                return fromUrl
            }
            return sessionStorage.getItem("tierFeedbackAdminToken") || ""
        } catch {
            return ""
        }
    }

    async function fetchSubmissions() {
        const listUrl = resolveListUrl()
        if (!listUrl) return null

        const headers = {}
        const token = resolveAdminToken()
        if (token) headers.Authorization = `Bearer ${token}`

        const res = await fetch(listUrl, { headers, cache: "no-store" })
        if (!res.ok) {
            const text = await res.text().catch(() => "")
            throw new Error(text || `Fetch failed (${res.status})`)
        }
        const data = await res.json()
        return Array.isArray(data) ? data : (data.submissions || [])
    }

    async function submitPayload(payload) {
        const url = resolveSubmitUrl()
        if (!url) {
            const err = new Error("NO_ENDPOINT")
            err.payload = payload
            throw err
        }
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
        if (!res.ok) {
            const text = await res.text().catch(() => "")
            throw new Error(text || `Submit failed (${res.status})`)
        }
        return res.json().catch(() => ({ ok: true }))
    }

    async function copyPayload(payload) {
        const text = JSON.stringify(payload, null, 2)
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return
        }
        const ta = document.createElement("textarea")
        ta.value = text
        ta.setAttribute("readonly", "")
        ta.style.position = "fixed"
        ta.style.left = "-9999px"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
    }

    window.TierFeedback = {
        collectTierlistOptions,
        collectCookieOptions,
        cookieMatchesSearch,
        getSuggestedTierOptions,
        findTierlistOption,
        findCookieOption,
        buildPayload,
        submitPayload,
        copyPayload,
        fetchSubmissions,
        resolveAdminToken,
        resolveListUrl,
        resolveSubmitUrl,
        getConfig,
    }
})()
