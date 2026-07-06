/**
 * Tier feedback API endpoints.
 *
 * Deploy: tools/tier-feedback-worker/ (see README there).
 *
 * Local dev file server (no worker):
 *   python tools/tier_feedback_server.py
 *
 * Optional secrets (gitignored): tools/tier-feedback-config.local.js
 */
window.TIER_FEEDBACK_CONFIG = {
    /** POST — tier feedback JSON. Same URL as listUrl. */
    submitUrl: "",
    /** GET — { submissions: [...] }. Requires adminToken. */
    listUrl: "",
    /** Review page only — do not commit a real token. Use .local.js or ?token= in URL. */
    adminToken: "",
}
