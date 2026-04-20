/**
 * Prints CRK character name + displayName as JSON (stdout) for Python tooling.
 * Usage: node tools/extract_crk_characters.mjs
 *
 * hasMc / hasCj / cnEx come straight from data.js:
 *   hasMc  — truthy `mcSkill` (magic candy skill name)
 *   hasCj  — truthy `cjSkill` (crystal jam skill name)
 *   cnEx   — China-first / CN-exclusive wiki layout (bilingual <tabber> story, etc.)
 * Used by import_wiki_candy.py, import_wiki_skill_icons.py, import_wiki_cookie_data.py,
 * import_wiki_skill_details.py (skillAttr / cjSkillAttr / skillAttrMc for max-value clamp).
 */
import fs from "fs"
import vm from "vm"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const code = fs.readFileSync(path.join(root, "data.js"), "utf8")
const sandbox = { window: {}, console }
vm.createContext(sandbox)
vm.runInContext(code, sandbox)
const game = sandbox.window.CRK_DATA?.games?.find((g) => g.id === "crk")
if (!game?.characters) {
  console.error("No crk characters in data.js")
  process.exit(1)
}
const rows = game.characters.map((c) => {
  const row = {
    name: c.name,
    displayName: c.displayName ?? c.name,
    hasMc: Boolean(c.mcSkill),
    hasCj: Boolean(c.cjSkill),
    cnEx: Boolean(c.cnEx),
  }
  if (c.skill && typeof c.skill === "string") row.skill = c.skill
  if (c.mcSkill && typeof c.mcSkill === "string") row.mcSkill = c.mcSkill
  if (c.cjSkill && typeof c.cjSkill === "string") row.cjSkill = c.cjSkill
  if (c.skillAttr && typeof c.skillAttr === "object") row.skillAttr = c.skillAttr
  if (c.cjSkillAttr && typeof c.cjSkillAttr === "object") row.cjSkillAttr = c.cjSkillAttr
  if (c.skillAttrMc && typeof c.skillAttrMc === "object") row.skillAttrMc = c.skillAttrMc
  if (c.mcSkillAttr && typeof c.mcSkillAttr === "object") row.mcSkillAttr = c.mcSkillAttr
  if (c.element !== undefined) row.element = c.element
  return row
})
process.stdout.write(JSON.stringify(rows))
