import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

function migratePropertyKeys(code) {
  return code.replace(/^(\s+)type:(?=\s)/gm, "$1role:")
}

function migrateInlineTypeTags(code) {
  return code.replace(/type\{([^}]+)\}/g, (_m, inner) => {
    const v = String(inner).trim().toLowerCase()
    if (v === "front" || v === "middle" || v === "rear") {
      const label = v.charAt(0).toUpperCase() + v.slice(1)
      return `position{${label}}`
    }
    return `role{${v}}`
  })
}

const propertyFiles = [
  "data.js",
  "tools/imported_cookie_data.js",
]

const tagFiles = [
  "crk/crk_descriptions.js",
  "crk/crk_cn_descriptions.js",
  "tools/imported_skill_details.js",
  "tools/imported_cn_content.js",
]

for (const rel of propertyFiles) {
  const p = path.join(root, rel)
  const before = fs.readFileSync(p, "utf8")
  const after = migratePropertyKeys(before)
  fs.writeFileSync(p, after)
  const n = (before.match(/^(\s+)type:(?=\s)/gm) ?? []).length
  console.log(`${rel}: ${n} property keys → role`)
}

for (const rel of tagFiles) {
  const p = path.join(root, rel)
  const before = fs.readFileSync(p, "utf8")
  const after = migrateInlineTypeTags(before)
  fs.writeFileSync(p, after)
  const n = (before.match(/type\{/g) ?? []).length
  console.log(`${rel}: ${n} inline type{…} tags migrated`)
}
