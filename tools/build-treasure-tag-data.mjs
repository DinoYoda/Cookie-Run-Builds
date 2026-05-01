import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const kwPath = path.join(root, "tools", "wiki_treasure_keyword_display.json")
const overridePath = path.join(root, "tools", "wiki_treasure_slug_map.json")
const treasuresDir = path.join(root, "crk", "pictures", "treasures")
const outPath = path.join(root, "crk", "treasure-tag-data.js")

function normDisplay(s) {
  return String(s)
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function normStem(stem) {
  return normDisplay(String(stem).replace(/27/g, "'"))
}

const files = fs.readdirSync(treasuresDir).filter((f) => f.startsWith("Treasure_") && f.endsWith(".png"))
const stems = files.map((f) => f.slice("Treasure_".length, -".png".length))

const stemByNorm = new Map()
for (const stem of stems) {
  const n = normStem(stem)
  if (!stemByNorm.has(n)) stemByNorm.set(n, stem)
}

const kw = JSON.parse(fs.readFileSync(kwPath, "utf8"))
const overrides = JSON.parse(fs.readFileSync(overridePath, "utf8"))

const slugMap = { ...overrides }

for (const [wikiKey, display] of Object.entries(kw)) {
  if (slugMap[wikiKey]) continue
  const n = normDisplay(display)
  const stem = stemByNorm.get(n)
  if (!stem) {
    console.warn(`build-treasure-tag-data: no PNG for "${display}" (keyword "${wikiKey}") norm=${n}`)
    continue
  }
  slugMap[wikiKey] = stem
}

for (const stem of stems) {
  if (slugMap[stem] == null) slugMap[stem] = stem
}

for (const stem of stems) {
  const us = stem.replace(/-/g, "_")
  if (us !== stem && slugMap[us] == null) slugMap[us] = stem
}

const out =
  ";(function (g) {\n" +
  "  g.CRK_TREASURE_SLUG_MAP = " +
  JSON.stringify(slugMap, null, 2) +
  "\n  g.CRK_TREASURE_KEYWORD_DISPLAY = " +
  JSON.stringify(kw, null, 2) +
  "\n})(typeof window !== \"undefined\" ? window : globalThis)\n"

fs.writeFileSync(outPath, out)
console.log("Wrote", path.relative(root, outPath), "map keys:", Object.keys(slugMap).length)
