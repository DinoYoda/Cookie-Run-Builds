#!/usr/bin/env node
/**
 * Skill Tag Converter - Converts wiki format to tagged format (ice{}, status{}, etc.)
 * Usage: node skill-tag-converter.js <input.txt>
 *
 * Replacements: [phrase, replacement] - phrase becomes replacement in output.
 * Use status{id} for status icons, element{value} for element/color spans.
 */

const fs = require("fs")

const REPLACEMENTS = [
  ["Status FreezeElement Ice ", "status{freeze}"],
  ["Status Frost ", "status{frost}"],
  [/\bIce Element(\d+\.?\d*%)/g, (_, pct) => `ice{${pct}}`],
]

const inputFile = process.argv[2]

function convert(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  const processed = lines.map((line, i) => {
    let text = line

    for (const [phrase, replacement] of REPLACEMENTS) {
      if (typeof phrase === "string") {
        text = text.split(phrase).join(replacement)
      } else {
        text = text.replace(phrase, replacement)
      }
    }

    if (i === 0 && !text.includes("{")) {
      text = `ice{${text}}`
    }
    return text
  })

  return processed.join("<br>")
}

function main() {
  let raw
  if (inputFile) {
    raw = fs.readFileSync(inputFile, "utf8").trim()
  } else {
    process.stderr.write("Usage: node skill-tag-converter.js <input.txt>\n")
    process.exit(1)
  }

  const result = convert(raw)
  console.log(JSON.stringify(result))
}

main()
