const axios = require("axios")
const fs = require("fs")

const API = "https://cookierunkingdom.fandom.com/api.php"

const cookies = [
    "Wind Archer Cookie",
    "Stormbringer Cookie",
    "Financier Cookie"
]

const output = {
    description: {},
    skill_description: {}
}

function slug(name) {
    return name.toLowerCase().replace(/\s+/g, "_")
}

async function getPage(name) {

    const res = await axios.get(API, {
        params: {
            action: "parse",
            page: name,
            prop: "text",
            format: "json"
        }
    })

    return res.data.parse.text["*"]
}

function extractIntro(html) {

    const match = html.match(/<p>(.*?)<\/p>/)
    return match ? match[1].replace(/<[^>]*>/g, "").trim() : ""
}

function extractSkill(html) {

    const skillMatch = html.match(/<span[^>]*id="Skill"[^>]*>[\s\S]*?<\/h2>([\s\S]*?)<\/p>/)

    if (!skillMatch) return ""

    return skillMatch[1]
        .replace(/<[^>]*>/g, "")
        .trim()
}

async function run() {

    for (const cookie of cookies) {

        console.log("Fetching:", cookie)

        const html = await getPage(cookie)

        const key = slug(cookie)

        output.description[key] = extractIntro(html)
        output.skill_description[key] = extractSkill(html)
    }

    fs.writeFileSync(
        "crk_descriptions.js",
        JSON.stringify(output, null, 2)
    )

    console.log("Done.")
}

run()