# Tier feedback worker (Cloudflare)

Stores tier list suggestions in **Cloudflare KV** (free tier).

| Method | Auth | Response |
|--------|------|----------|
| `POST /` | Public | `{ "ok": true, "id": "..." }` |
| `GET /` | Admin token | `{ "submissions": [ ... ] }` |

## Setup

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/) and log in:
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. Create a KV namespace and copy the id into `wrangler.toml`:
   ```bash
   cd tools/tier-feedback-worker
   npx wrangler kv namespace create TIER_FEEDBACK_KV
   ```
   Replace `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.toml` with the printed id.

3. Set an admin token (used to read submissions on the review page):
   ```bash
   npx wrangler secret put ADMIN_TOKEN
   ```

4. Deploy:
   ```bash
   npx wrangler deploy
   ```
   Note the URL, e.g. `https://crk-tier-feedback.<your-subdomain>.workers.dev`

5. Point the site at the worker — in `tools/tier-feedback-config.local.js` (gitignored):
   ```js
   window.TIER_FEEDBACK_CONFIG_LOCAL = {
     submitUrl: "https://crk-tier-feedback.<your-subdomain>.workers.dev",
     listUrl: "https://crk-tier-feedback.<your-subdomain>.workers.dev",
     adminToken: "same-secret-as-ADMIN_TOKEN",
   };
   ```

   Or set `submitUrl` / `listUrl` in `tools/tier-feedback-config.js` if you are fine committing the worker URL (keep `adminToken` in the local file only).

6. Open the review page with your token:
   ```
   https://<your-site>/crk/tier-feedback-review.html?token=YOUR_ADMIN_TOKEN
   ```

## Local dev

The Python file server still works for offline testing:

```bash
python tools/tier_feedback_server.py
```

When `submitUrl` is empty and you are on `localhost`, the form uses that server instead of the worker.

## Payload shape

```json
{
  "cookie": "Candy Diver Cookie",
  "cookieId": "Candy_diver",
  "tierlist": "World Exploration",
  "suggestedTier": "A",
  "reason": "...",
  "pageUrl": "https://...",
  "submittedAt": "2026-07-05T..."
}
```
