/**
 * One-off migration: move substats and bonusEffect from sets.toppings[] onto builds.
 * Run from repo root: node tools/migrate_substats_to_builds.mjs
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(__dirname, "..", "data.js")

function loadData() {
  const raw = fs.readFileSync(dataPath, "utf8")
  const body = raw.replace(/^window\.CRK_DATA\s*=\s*/, "").replace(/;\s*$/, "")
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${body})`)()
}

function serializeKey(key) {
  const s = String(key)
  if (/^\d+$/.test(s)) return s
  if (/^[A-Za-z_$][\w$]*$/.test(s)) return s
  return JSON.stringify(s)
}

function serialize(value, indent = 0) {
  const pad = " ".repeat(indent)
  const padInner = " ".repeat(indent + 4)
  if (value === null) return "null"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null"
  if (typeof value === "string") return JSON.stringify(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    return `[\n${value.map((item) => `${padInner}${serialize(item, indent + 4)}`).join(",\n")}\n${pad}]`
  }
  if (typeof value === "object") {
    const keys = Object.keys(value)
    if (keys.length === 0) return "{}"
    return `{\n${keys
      .map((key) => `${padInner}${serializeKey(key)}: ${serialize(value[key], indent + 4)}`)
      .join(",\n")}\n${pad}}`
  }
  return "null"
}

function migrateCharacter(char) {
  const builds = char.builds
  const toppingSets = char.sets?.toppings
  if (!builds || typeof builds !== "object" || !Array.isArray(toppingSets)) return

  for (const [id, build] of Object.entries(builds)) {
    if (id === "notes" || !build || typeof build !== "object") continue
    const idx = build.toppings
    if (!Number.isInteger(idx) || idx < 1) continue
    const topSet = toppingSets[idx - 1]
    if (!topSet || typeof topSet !== "object") continue
    if (Array.isArray(topSet.substats) && topSet.substats.length && !build.substats) {
      build.substats = topSet.substats.slice()
    }
    if (topSet.bonusEffect != null && String(topSet.bonusEffect).trim() !== "" && build.bonusEffect == null) {
      build.bonusEffect = topSet.bonusEffect
    }
  }

  for (const topSet of toppingSets) {
    if (!topSet || typeof topSet !== "object") continue
    delete topSet.substats
    delete topSet.bonusEffect
  }
}

function migrate(data) {
  for (const game of data.games || []) {
    for (const char of game.characters || []) {
      migrateCharacter(char)
    }
  }
}

const data = loadData()
migrate(data)
const out = `window.CRK_DATA = ${serialize(data, 0)};\n`
fs.writeFileSync(dataPath, out, "utf8")
console.log("Migrated substats and bonusEffect onto builds in data.js")
