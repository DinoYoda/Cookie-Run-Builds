/**
 * Prints CRC character rows as JSON for Python importers.
 * Usage: node crc/tools/extract_crc_characters.mjs
 */
import fs from "fs"
import vm from "vm"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..", "..")
const code = fs.readFileSync(path.join(root, "crc", "data.js"), "utf8")
const sandbox = { window: { CRK_DATA: { games: [] } }, console }
sandbox.window.registerGameData = (game) => {
  if (game?.id) sandbox.window.CRK_DATA.games.push(game)
}
vm.createContext(sandbox)
vm.runInContext(code, sandbox)
const game = sandbox.window.CRK_DATA?.games?.find((g) => g.id === "crc")
if (!game?.characters) {
  console.error("No crc characters in crc/data.js")
  process.exit(1)
}
const rows = game.characters.map((c) => ({
  name: c.name,
  displayName: c.displayName ?? c.name,
  skill: c.skill ?? null,
  skillAttr: c.skillAttr ?? null,
  element: c.element ?? null,
  role: c.role ?? null,
  rarity: c.rarity ?? null,
}))
process.stdout.write(JSON.stringify(rows))
