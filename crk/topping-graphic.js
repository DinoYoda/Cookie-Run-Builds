/**
 * Outline color (#e7a765) sets crop/placement inside each slot; slot size is % of tart plate (CSS).
 * Bounds are pre-baked in tools/topping_graphic_bounds.json (no runtime canvas when available).
 * Manual nudges: tools/topping_graphic_overrides.json
 */
(function () {
  const _boundsCache = new Map()
  const OUTLINE_R = 0xe7
  const OUTLINE_G = 0xa7
  const OUTLINE_B = 0x65
  const DEFAULT_OUTLINE_TOLERANCE = 16
  const ALPHA_THRESHOLD = 8
  const DEFAULT_REF_OUTLINE_W = 102
  const DEFAULT_REF_OUTLINE_H = 149
  const FIT_BATCH_SIZE = 6

  let _overridesPromise = null
  let _overrides = null
  let _bakedBounds = null
  let _bakedPromise = null
  const _pendingFit = new Set()
  let _flushScheduled = false
  let _intersectionObserver = null

  function siteRelativePath(file) {
    const p = (location.pathname || "").replace(/\\/g, "/")
    if (/\/crk\/[^/]+\.html$/i.test(p)) return `../${file}`
    return file
  }

  function loadToppingGraphicOverrides() {
    if (_overrides) return Promise.resolve(_overrides)
    if (!_overridesPromise) {
      _overridesPromise = fetch(siteRelativePath("tools/topping_graphic_overrides.json"))
        .then((r) => (r.ok ? r.json() : {}))
        .then((j) => {
          _overrides = j && typeof j === "object" ? j : {}
          return _overrides
        })
        .catch(() => {
          _overrides = {}
          return _overrides
        })
    }
    return _overridesPromise
  }

  function loadBakedBounds() {
    if (_bakedBounds) return Promise.resolve(_bakedBounds)
    if (!_bakedPromise) {
      _bakedPromise = fetch(siteRelativePath("tools/topping_graphic_bounds.json"))
        .then((r) => (r.ok ? r.json() : {}))
        .then((j) => {
          const b = j && typeof j.bounds === "object" ? j.bounds : {}
          _bakedBounds = b
          return b
        })
        .catch(() => {
          _bakedBounds = {}
          return _bakedBounds
        })
    }
    return _bakedPromise
  }

  function parseToppingSrc(src) {
    const raw = String(src || "")
    const file = raw.split("/").pop()?.split("?")[0] || ""
    const m = file.match(/^Topping_(?:tart_)?([a-z0-9]+)_([^.]+)\.png$/i)
    if (!m) return { type: "", resonance: "", file }
    return { type: m[1].toLowerCase(), resonance: m[2].toLowerCase(), file }
  }

  function getImageSrcKey(img) {
    return String(img?.currentSrc || img?.src || "")
  }

  function resolveGraphicOverride(src, overrides) {
    if (!overrides || typeof overrides !== "object") return null
    const { type, resonance, file } = parseToppingSrc(src)
    const candidates = [
      type && resonance ? `${type}/${resonance}` : "",
      file,
      resonance,
    ].filter(Boolean)
    for (const key of candidates) {
      const entry = overrides[key]
      if (entry && typeof entry === "object" && !Array.isArray(entry)) return entry
    }
    return null
  }

  function adjustBounds(bounds, override) {
    if (!override) return bounds
    const b = { ...bounds }
    const trimLeft = Number(override.trimLeft) || 0
    const trimRight = Number(override.trimRight) || 0
    const trimTop = Number(override.trimTop) || 0
    const trimBottom = Number(override.trimBottom) || 0
    if (trimLeft > 0) {
      b.x += trimLeft
      b.w -= trimLeft
    }
    if (trimRight > 0) b.w -= trimRight
    if (trimTop > 0) {
      b.y += trimTop
      b.h -= trimTop
    }
    if (trimBottom > 0) b.h -= trimBottom
    if (b.w < 1 || b.h < 1) return bounds
    return b
  }

  function getToppingRoot(img) {
    return img.closest(".char-toppings-row") || img.closest(".char-toppings-plate") || document.documentElement
  }

  function getOutlineTolerance(img) {
    const root = getToppingRoot(img)
    const n = parseFloat(getComputedStyle(root).getPropertyValue("--char-topping-outline-tolerance").trim())
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_OUTLINE_TOLERANCE
  }

  function getReferenceOutlineNatural(img) {
    const root = getToppingRoot(img)
    const style = getComputedStyle(root)
    const w = parseFloat(style.getPropertyValue("--char-topping-reference-outline-width").trim())
    const h = parseFloat(style.getPropertyValue("--char-topping-reference-outline-height").trim())
    return {
      w: Number.isFinite(w) && w > 0 ? w : DEFAULT_REF_OUTLINE_W,
      h: Number.isFinite(h) && h > 0 ? h : DEFAULT_REF_OUTLINE_H,
    }
  }

  function matchesOutline(r, g, b, a, tolerance) {
    if (a < 20) return false
    const dr = Math.abs(r - OUTLINE_R)
    const dg = Math.abs(g - OUTLINE_G)
    const db = Math.abs(b - OUTLINE_B)
    return dr <= tolerance && dg <= tolerance && db <= tolerance
  }

  function measureGraphicBoundsCanvas(img) {
    const tolerance = getOutlineTolerance(img)
    const key = `${getImageSrcKey(img)}|tol=${tolerance}|canvas`
    if (_boundsCache.has(key)) return _boundsCache.get(key)

    const nw = img.naturalWidth
    const nh = img.naturalHeight
    if (!nw || !nh) return null

    const canvas = document.createElement("canvas")
    canvas.width = nw
    canvas.height = nh
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null

    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, nw, nh).data

    let outlineMinX = nw
    let outlineMinY = nh
    let outlineMaxX = 0
    let outlineMaxY = 0
    let outlineFound = false

    let alphaMinX = nw
    let alphaMinY = nh
    let alphaMaxX = 0
    let alphaMaxY = 0
    let alphaFound = false

    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const i = (y * nw + x) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]

        if (a > ALPHA_THRESHOLD) {
          alphaFound = true
          if (x < alphaMinX) alphaMinX = x
          if (y < alphaMinY) alphaMinY = y
          if (x > alphaMaxX) alphaMaxX = x
          if (y > alphaMaxY) alphaMaxY = y
        }

        if (matchesOutline(r, g, b, a, tolerance)) {
          outlineFound = true
          if (x < outlineMinX) outlineMinX = x
          if (y < outlineMinY) outlineMinY = y
          if (x > outlineMaxX) outlineMaxX = x
          if (y > outlineMaxY) outlineMaxY = y
        }
      }
    }

    let bounds = null
    if (outlineFound) {
      bounds = {
        x: outlineMinX,
        y: outlineMinY,
        w: outlineMaxX - outlineMinX + 1,
        h: outlineMaxY - outlineMinY + 1,
        nw,
        nh,
        method: "outline",
      }
    } else if (alphaFound) {
      bounds = {
        x: alphaMinX,
        y: alphaMinY,
        w: alphaMaxX - alphaMinX + 1,
        h: alphaMaxY - alphaMinY + 1,
        nw,
        nh,
        method: "alpha",
      }
    }

    if (bounds) _boundsCache.set(key, bounds)
    return bounds
  }

  function measureGraphicBounds(img) {
    const tolerance = getOutlineTolerance(img)
    const srcKey = getImageSrcKey(img)
    const cacheKey = `${srcKey}|tol=${tolerance}`
    if (_boundsCache.has(cacheKey)) return _boundsCache.get(cacheKey)

    const { file } = parseToppingSrc(srcKey)
    if (file && _bakedBounds && _bakedBounds[file]) {
      const baked = { ..._bakedBounds[file] }
      _boundsCache.set(cacheKey, baked)
      return baked
    }

    const bounds = measureGraphicBoundsCanvas(img)
    if (bounds) _boundsCache.set(cacheKey, bounds)
    return bounds
  }

  function needsGraphicFit(img) {
    if (!(img instanceof HTMLImageElement)) return false
    if (!img.classList.contains("char-topping-item")) return false
    const key = getImageSrcKey(img)
    if (!key) return false
    return !(img.dataset.graphicFit === "1" && img.dataset.graphicFitSrc === key)
  }

  function ensureGraphicWrapper(img) {
    let graphic = img.closest(".char-topping-graphic")
    if (graphic) return graphic

    graphic = document.createElement("div")
    graphic.className = "char-topping-graphic"
    img.parentNode.insertBefore(graphic, img)
    graphic.appendChild(img)
    return graphic
  }

  function applyToppingGraphicFit(img, overrides) {
    const rawBounds = measureGraphicBounds(img)
    if (!rawBounds) return false

    const override = resolveGraphicOverride(getImageSrcKey(img), overrides)
    const bounds = adjustBounds(rawBounds, override)
    const ref = getReferenceOutlineNatural(img)

    const scale = Math.min(ref.w / bounds.w, ref.h / bounds.h)
    const scaledW = bounds.w * scale
    const scaledH = bounds.h * scale
    const padX = (ref.w - scaledW) / 2
    const padY = (ref.h - scaledH) / 2

    const graphic = ensureGraphicWrapper(img)
    graphic.style.width = ""
    graphic.style.height = ""
    graphic.style.overflow = "visible"

    const shiftX = Number(override?.shiftX) || 0
    const shiftY = Number(override?.shiftY) || 0
    graphic.style.setProperty("--topping-shift-x", `${(shiftX / ref.w) * 100}%`)
    graphic.style.setProperty("--topping-shift-y", `${(shiftY / ref.h) * 100}%`)

    img.style.width = `${((bounds.nw * scale) / ref.w) * 100}%`
    img.style.height = `${((bounds.nh * scale) / ref.h) * 100}%`
    img.style.marginLeft = `${((-bounds.x * scale + padX) / ref.w) * 100}%`
    img.style.marginTop = `${((-bounds.y * scale + padY) / ref.h) * 100}%`
    img.style.maxWidth = "none"
    img.style.display = "block"
    img.dataset.graphicFit = "1"
    img.dataset.graphicFitSrc = getImageSrcKey(img)
    img.dataset.graphicBounds = rawBounds.method || "outline"
    if (override) img.dataset.graphicOverride = "1"
    else delete img.dataset.graphicOverride
    img.dispatchEvent(new CustomEvent("topping-graphic-fit", { bubbles: true }))
    return true
  }

  function runGraphicFit(img) {
    if (!img.isConnected || !needsGraphicFit(img)) return
    if (!img.naturalWidth) return
    void Promise.all([loadToppingGraphicOverrides(), loadBakedBounds()]).then(([overrides]) => {
      if (!img.isConnected || !needsGraphicFit(img)) return
      applyToppingGraphicFit(img, overrides)
    })
  }

  function scheduleFitFlush() {
    if (_flushScheduled) return
    _flushScheduled = true
    const flush = () => {
      _flushScheduled = false
      let n = 0
      for (const img of _pendingFit) {
        if (n >= FIT_BATCH_SIZE) {
          scheduleFitFlush()
          break
        }
        _pendingFit.delete(img)
        runGraphicFit(img)
        n++
      }
    }
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(flush, { timeout: 120 })
    } else {
      requestAnimationFrame(flush)
    }
  }

  function queueGraphicFit(img) {
    if (!needsGraphicFit(img)) return
    _pendingFit.add(img)
    scheduleFitFlush()
  }

  function getIntersectionObserver() {
    if (_intersectionObserver) return _intersectionObserver
    if (typeof IntersectionObserver === "undefined") return null
    _intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const img = entry.target
        _intersectionObserver.unobserve(img)
        queueGraphicFit(img)
      })
    }, { rootMargin: "120px" })
    return _intersectionObserver
  }

  function setupToppingItem(img) {
    if (!(img instanceof HTMLImageElement)) return
    if (!needsGraphicFit(img)) return

    const start = () => {
      if (!needsGraphicFit(img) || !img.naturalWidth) return
      const io = getIntersectionObserver()
      if (io) io.observe(img)
      else queueGraphicFit(img)
    }

    if (img.dataset.graphicBound === "1") {
      start()
      return
    }
    img.dataset.graphicBound = "1"
    img.addEventListener("load", start, { once: true })
    img.addEventListener("error", () => {
      delete img.dataset.graphicBound
    }, { once: true })
    if (img.complete && img.naturalWidth) start()
  }

  function initToppingGraphics(root) {
    const scope = root && root.querySelectorAll ? root : document
    void loadBakedBounds()
    scope.querySelectorAll(".char-topping-item").forEach(setupToppingItem)
  }

  function initToppingGraphic(img) {
    setupToppingItem(img)
  }

  window.initToppingGraphics = initToppingGraphics
  window.initToppingGraphic = initToppingGraphic
  window.applyToppingGraphicFit = applyToppingGraphicFit
  window.loadToppingGraphicOverrides = loadToppingGraphicOverrides

})()
