;(function () {
  function formatManualPageDate(iso) {
    const s = String(iso || "").trim()
    if (!s) return ""
    const hasTime = /T\d/.test(s)
    const d = new Date(hasTime ? s : s.length <= 10 ? s + "T12:00:00" : s)
    if (Number.isNaN(d.getTime())) return s
    try {
      if (hasTime) {
        return d.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      }
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    } catch {
      return s
    }
  }

  window.formatManualPageDate = formatManualPageDate

  function applyStaticPageLastUpdated() {
    const body = document.body
    if (!body) return
    const id = body.getAttribute("data-site-page")
    if (!id) return
    const map = window.SITE_PAGE_LAST_UPDATED || {}
    const raw = map[id]
    if (raw == null || String(raw).trim() === "") return
    const iso = String(raw).trim()
    const foot = document.querySelector(".site-copyright")
    if (!foot) return
    let el = document.getElementById("siteLastUpdated")
    if (!el) {
      el = document.createElement("p")
      el.id = "siteLastUpdated"
      el.className = "site-last-updated"
      foot.insertBefore(el, foot.firstChild)
    }
    el.hidden = false
    el.replaceChildren()
    el.appendChild(document.createTextNode("Page last updated on "))
    const time = document.createElement("time")
    time.dateTime = iso
    time.textContent = formatManualPageDate(iso)
    el.appendChild(time)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyStaticPageLastUpdated)
  } else {
    applyStaticPageLastUpdated()
  }
})()
