const axios = require("axios")
const fs = require("fs")

const API = "https://cookierunkingdom.fandom.com/api.php"

const cookies = [
    "Fig Cookie"
]

const output = {
    description: {},
    skill_description: {}
}

function slug(name){
    return name.toLowerCase().replace(/\s+/g,"_")
}

async function getSections(page){

    const res = await axios.get(API,{
        params:{
            action:"parse",
            page,
            prop:"sections",
            format:"json"
        }
    })

    return res.data.parse.sections
}

async function getSectionText(page, sectionIndex){

    const res = await axios.get(API,{
        params:{
            action:"parse",
            page,
            prop:"text",
            section:sectionIndex,
            format:"json"
        }
    })

    return res.data.parse.text["*"]
}

function strip(html){
    return html.replace(/<[^>]+>/g,"").trim()
}

async function scrape(page){

    const sections = await getSections(page)

    const descSection = sections.find(s => s.line === "Game Description")
    const skillSection = sections.find(s => s.line === "Skill")

    const descHTML = await getSectionText(page, descSection.index)
    const skillHTML = await getSectionText(page, skillSection.index)

    const description = strip(descHTML)
    const skill = strip(skillHTML)

    const key = slug(page)

    output.description[key] = description
    output.skill_description[key] = skill
}

async function run(){

    for(const cookie of cookies){
        console.log("Fetching",cookie)
        await scrape(cookie)
    }

    fs.writeFileSync(
        "crk_descriptions.js",
        JSON.stringify(output,null,2)
    )
}

run()