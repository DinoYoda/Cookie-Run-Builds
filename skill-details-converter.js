#!/usr/bin/env node
/**
 * Skill Details Converter
 * Usage: node skill-details-converter.js <input.txt>
 *   Or:  node skill-details-converter.js  (paste, then Ctrl+D)
 * Add replacements to the REPLACEMENTS array below.
 */

const fs = require("fs")

const REPLACEMENTS = [
  ["Status SilenceStatus", '<img src="pictures/icons/Silence.png" alt="Silence" class="skill-icon">'],
  ["Darkness Element", '<img src="pictures/icons/Darkness.png" alt="Darkness" class="skill-icon">'],
  ["Steel Element", '<img src="pictures/icons/Steel.png" alt="Steel" class="skill-icon">'],
  ["Status DMG Dealt UpStatus", '<img src="pictures/icons/DMG_Dealt_Up.png" alt="DMG Dealt Up" class="skill-icon">'],
  ["Status Undispellable Buff", '<img src="pictures/icons/Undispellable_Buff.png" alt="Undispellable Buff" class="skill-icon">'],
  ["Status Rooted", '<img src="pictures/icons/Rooted.png" alt="Rooted" class="skill-icon">'],
  ["Status Petrified", '<img src="pictures/icons/Petrified.png" alt="Petrified" class="skill-icon">'],
  ["Status Weakness Taken", '<img src="pictures/icons/Weakness_Taken.png" alt="Weakness Taken" class="skill-icon">'],
  ["Status DMG Dealt Down", '<img src="pictures/icons/DMG_Dealt_Down.png" alt="DMG Dealt Down" class="skill-icon">'],
  ["Status Consuming Darkness", '<img src="pictures/icons/Consuming_Darkness.png" alt="Consuming Darkness" class="skill-icon">'],
  ["Status Forsaken FreedomStatus", '<img src="pictures/icons/Forsaken_Freedom.png" alt="Forsaken Freedom" class="skill-icon">'],
  ["Status HP Shield", '<img src="pictures/icons/HP_Shield.png" alt="HP Shield" class="skill-icon">'],
  ["Status DMG Down", '<img src="pictures/icons/DMG_Down.png" alt="DMG Down" class="skill-icon">'],
  ["Status Cooldown Recovery Up", '<img src="pictures/icons/Cooldown_Recovery_Up.png" alt="Cooldown Recovery Up" class="skill-icon">'],
  ["Status Fury of the CatacombsStatus", '<img src="pictures/icons/Fury_of_the_Catacombs.png" alt="Fury of the Catacombs" class="skill-icon">'],
  ["Status Undispellable Debuff", '<img src="pictures/icons/Undispellable_Debuff.png" alt="Undispellable Debuff" class="skill-icon">'],
  ["Status InvulnerableStatus", '<img src="pictures/icons/Invulnerable.png" alt="Invulnerable" class="skill-icon">'],
]

const inputFile = process.argv[2]

async function main() {
  let raw
  if (inputFile) {
    raw = fs.readFileSync(inputFile, "utf8").trim()
  } else {
    process.stderr.write("Paste wiki skill details, then Ctrl+D (Ctrl+Z on Windows):\n\n")
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    raw = Buffer.concat(chunks).toString("utf8").trim()
  }

  if (!raw) {
    console.error("Usage: node skill-details-converter.js <input.txt>")
    process.exit(1)
  }

  let text = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join("<br>")

  for (const [phrase, replacement] of REPLACEMENTS) {
    text = text.split(phrase).join(replacement)
  }

  const escaped = JSON.stringify(text)
  console.log(escaped)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
