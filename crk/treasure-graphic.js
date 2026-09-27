/**
 * Crop transparent padding so treasure art fills each team slot (like topping-graphic.js).
 * Bounds: crk/tools/treasure_graphic_bounds.json (regenerate with bake_treasure_bounds.py).
 */
(function () {
  const _boundsCache = new Map()
  const ALPHA_THRESHOLD = 8
  const FIT_BATCH_SIZE = 8

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

  function loadBakedBounds() {
    if (_bakedBounds) return Promise.resolve(_bakedBounds)
    if (!_bakedPromise) {
      _bakedPromise = fetch(siteRelativePath("crk/tools/treasure_graphic_bounds.json"))
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

  function getImageSrcKey(img) {
    return String(img?.currentSrc || img?.src || "")
  }

  function parseTreasureFile(src) {
    const raw = String(src || "")
    const file = raw.split("/").pop()?.split("?")[0] || ""
    return file
  }

  function measureGraphicBoundsCanvas(img) {
    const key = `${getImageSrcKey(img)}|canvas`
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

    let alphaMinX = nw
    let alphaMinY = nh
    let alphaMaxX = 0
    let alphaMaxY = 0
    let alphaFound = false

    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const i = (y * nw + x) * 4
        const a = data[i + 3]
        if (a > ALPHA_THRESHOLD) {
          alphaFound = true
          if (x < alphaMinX) alphaMinX = x
          if (y < alphaMinY) alphaMinY = y
          if (x > alphaMaxX) alphaMaxX = x
          if (y > alphaMaxY) alphaMaxY = y
        }
      }
    }

    let bounds = null
    if (alphaFound) {
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
    const srcKey = getImageSrcKey(img)
    const cacheKey = srcKey
    if (_boundsCache.has(cacheKey)) return _boundsCache.get(cacheKey)

    const file = parseTreasureFile(srcKey)
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
    if (!img.classList.contains("teams-treasure-icon")) return false
    const key = getImageSrcKey(img)
    if (!key) return false
    return !(img.dataset.treasureGraphicFit === "1" && img.dataset.treasureGraphicFitSrc === key)
  }

  function ensureGraphicWrapper(img) {
    let graphic = img.closest(".teams-treasure-graphic")
    if (graphic) return graphic

    graphic = document.createElement("div")
    graphic.className = "teams-treasure-graphic"
    img.parentNode.insertBefore(graphic, img)
    graphic.appendChild(img)
    return graphic
  }

  function getSlotSize(img) {
    const item = img.closest(".teams-treasure-item") || document.documentElement
    const style = getComputedStyle(item)
    const w = parseFloat(style.getPropertyValue("--teams-treasure-slot-size").trim())
    if (Number.isFinite(w) && w > 0) return { w, h: w }
    return { w: 54, h: 54 }
  }

  function applyTreasureGraphicFit(img) {
    const rawBounds = measureGraphicBounds(img)
    if (!rawBounds) return false

    const bounds = rawBounds
    const ref = { w: bounds.nw, h: bounds.nh }
    const slot = getSlotSize(img)

    const scale = Math.min(ref.w / bounds.w, ref.h / bounds.h)
    const scaledW = bounds.w * scale
    const scaledH = bounds.h * scale
    const padX = (ref.w - scaledW) / 2
    const padY = (ref.h - scaledH) / 2

    const graphic = ensureGraphicWrapper(img)
    graphic.style.width = `${slot.w}px`
    graphic.style.height = `${slot.h}px`
    graphic.style.overflow = "hidden"

    img.style.width = `${((bounds.nw * scale) / ref.w) * 100}%`
    img.style.height = `${((bounds.nh * scale) / ref.h) * 100}%`
    img.style.marginLeft = `${((-bounds.x * scale + padX) / ref.w) * 100}%`
    img.style.marginTop = `${((-bounds.y * scale + padY) / ref.h) * 100}%`
    img.style.maxWidth = "none"
    img.style.display = "block"
    img.dataset.treasureGraphicFit = "1"
    img.dataset.treasureGraphicFitSrc = getImageSrcKey(img)
    return true
  }

  function runGraphicFit(img) {
    if (!img.isConnected || !needsGraphicFit(img)) return
    if (!img.naturalWidth) return
    void loadBakedBounds().then(() => {
      if (!img.isConnected || !needsGraphicFit(img)) return
      applyTreasureGraphicFit(img)
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

  function setupTreasureIcon(img) {
    if (!(img instanceof HTMLImageElement)) return
    if (!needsGraphicFit(img)) return

    const start = () => {
      if (!needsGraphicFit(img) || !img.naturalWidth) return
      const io = getIntersectionObserver()
      if (io) io.observe(img)
      else queueGraphicFit(img)
    }

    if (img.dataset.treasureGraphicBound === "1") {
      start()
      return
    }
    img.dataset.treasureGraphicBound = "1"
    img.addEventListener("load", start, { once: true })
    img.addEventListener("error", () => {
      delete img.dataset.treasureGraphicBound
    }, { once: true })
    if (img.complete && img.naturalWidth) start()
  }

  function initTreasureGraphics(root) {
    const scope = root && root.querySelectorAll ? root : document
    void loadBakedBounds()
    scope.querySelectorAll(".teams-treasure-icon").forEach(setupTreasureIcon)
  }

  window.initTreasureGraphics = initTreasureGraphics
})()
