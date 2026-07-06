/**
 * Cloudflare Worker — tier feedback storage (KV).
 *
 * POST /  public — append submission
 * GET  /  admin  — { submissions: [...] }  (Bearer token or ?token=)
 */
const KV_KEY = "submissions"
const MAX_REASON_LEN = 4000
const MAX_ENTRIES = 5000

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

async function readAll(kv) {
    const raw = await kv.get(KV_KEY)
    if (!raw) return []
    try {
        const data = JSON.parse(raw)
        return Array.isArray(data) ? data : []
    } catch {
        return []
    }
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
    })
}

function isAdmin(request, env) {
    const secret = env.ADMIN_TOKEN
    if (!secret) return false
    const auth = request.headers.get("Authorization") || ""
    if (auth === `Bearer ${secret}`) return true
    return new URL(request.url).searchParams.get("token") === secret
}

function validatePayload(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Expected JSON object" }
    }
    const cookie = String(body.cookie || "").trim()
    const tierlist = String(body.tierlist || "").trim()
    const suggestedTier = String(body.suggestedTier || "").trim()
    const reason = String(body.reason || "").trim()

    if (!cookie) return { error: "Missing cookie" }
    if (!tierlist) return { error: "Missing tierlist" }
    if (!suggestedTier) return { error: "Missing suggestedTier" }
    if (!reason) return { error: "Missing reason" }
    if (reason.length > MAX_REASON_LEN) {
        return { error: `Reason too long (max ${MAX_REASON_LEN} chars)` }
    }

    return {
        payload: {
            id: crypto.randomUUID(),
            cookie,
            cookieId: body.cookieId ? String(body.cookieId).trim() : null,
            tierlist,
            suggestedTier,
            reason,
            pageUrl: body.pageUrl ? String(body.pageUrl).slice(0, 500) : "",
            submittedAt: body.submittedAt || new Date().toISOString(),
        },
    }
}

export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS })
        }

        if (!env.TIER_FEEDBACK_KV) {
            return json({ error: "KV not configured" }, 500)
        }

        if (request.method === "GET") {
            if (!isAdmin(request, env)) {
                return json({ error: "Unauthorized" }, 401)
            }
            const submissions = await readAll(env.TIER_FEEDBACK_KV)
            return json({ submissions })
        }

        if (request.method === "POST") {
            let body
            try {
                body = await request.json()
            } catch {
                return json({ error: "Invalid JSON" }, 400)
            }

            const result = validatePayload(body)
            if (result.error) return json({ error: result.error }, 400)

            const items = await readAll(env.TIER_FEEDBACK_KV)
            items.push(result.payload)
            const trimmed = items.length > MAX_ENTRIES
                ? items.slice(items.length - MAX_ENTRIES)
                : items
            await env.TIER_FEEDBACK_KV.put(KV_KEY, JSON.stringify(trimmed))

            return json({ ok: true, id: result.payload.id })
        }

        return json({ error: "Method not allowed" }, 405)
    },
}
