/**
 * One-off: split crk/data.js → cookie-data.js, team-data.js, tier-data.js
 * Usage: node crk/tools/split_crk_data.mjs
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const crkDir = path.join(__dirname, "..")
const src = path.join(crkDir, "data.js")
const lines = fs.readFileSync(src, "utf8").split(/\r?\n/)

const charStart = lines.findIndex((l) => /^\s+characters:\s*\[/.test(l))
let charEnd = -1
for (let i = charStart + 1; i < lines.length; i++) {
  if (/^\s+\],\s*$/.test(lines[i]) && lines[i + 1]?.trim().startsWith("teams:")) {
    charEnd = i
    break
  }
}
const teamsStart = lines.findIndex((l) => /^\s+teams:\s*\{/.test(l))
let teamsEnd = -1
for (let i = teamsStart + 1; i < lines.length; i++) {
  if (/^\s+\},\s*$/.test(lines[i]) && lines[i + 1]?.trim().startsWith("tierlists:")) {
    teamsEnd = i
    break
  }
}
const tierStart = lines.findIndex((l) => /^\s+tierlists:\s*\[/.test(l))
let tierEnd = -1
for (let i = tierStart + 1; i < lines.length; i++) {
  if (/^\s+\]\s*$/.test(lines[i]) && /^\s*\}\);\s*$/.test(lines[i + 1] ?? "")) {
    tierEnd = i
    break
  }
}

if ([charStart, charEnd, teamsStart, teamsEnd, tierStart, tierEnd].some((n) => n < 0)) {
  console.error("Could not find split boundaries", {
    charStart,
    charEnd,
    teamsStart,
    teamsEnd,
    tierStart,
    tierEnd,
  })
  process.exit(1)
}

const idLine = lines.find((l) => /^\s+id:/.test(l))
const nameLine = lines.find((l) => /^\s+name:/.test(l))
const charBody = lines.slice(charStart + 1, charEnd)
const teamsBody = lines.slice(teamsStart, teamsEnd + 1)
const tierBody = lines.slice(tierStart, tierEnd + 1)

const cookieData =
  "window.registerGameData({\n" +
  `${idLine}\n` +
  `${nameLine}\n` +
  "    characters: [\n" +
  charBody.join("\n") +
  "\n    ]\n});\n"

let teamData =
  "window.registerGameData({\n" +
  '    id: "crk",\n' +
  teamsBody.join("\n") +
  "\n});\n"
teamData = teamData.replace(
  /(\{\s*\n\s+name: "Strawberry_crepe"\s*\n\s+\}),\s*\n,/,
  '$1,\n'
)

const tierData =
  "window.registerGameData({\n" +
  '    id: "crk",\n' +
  tierBody.join("\n") +
  "\n});\n"

fs.writeFileSync(path.join(crkDir, "cookie-data.js"), cookieData)
fs.writeFileSync(path.join(crkDir, "team-data.js"), teamData)
fs.writeFileSync(path.join(crkDir, "tier-data.js"), tierData)
console.log(
  "Wrote cookie-data.js, team-data.js, tier-data.js",
  `(characters ${charBody.length} lines, teams ${teamsBody.length}, tier ${tierBody.length})`
)
