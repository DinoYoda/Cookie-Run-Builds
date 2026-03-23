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

async function getSectionHTML(page, index){

    const res = await axios.get(API,{
        params:{
            action:"parse",
            page,
            prop:"text",
            section:index,
            format:"json"
        }
    })

    return res.data.parse.text["*"]
}

function cleanDescription(html){

    let text = html

    text = text.replace(/<\/p>/g,"\n")
    text = text.replace(/<[^>]+>/g,"")

    text = text.trim().replace(/\n+/g,"\n")
    text = text.replace(/\n/g,"<br>")

    return text
}

function cleanSkill(html){

    let text = html

    // remove tables but keep their text
    text = text.replace(/<table[\s\S]*?<\/table>/g, match =>
        match.replace(/<[^>]+>/g,"")
    )

    text = text.replace(/<\/p>/g,"\n")
    text = text.replace(/<br\s*\/?>/g,"\n")

    text = text.replace(/<[^>]+>/g,"")

    text = text.trim().replace(/\n+/g,"\n")
    text = text.replace(/\n/g,"<br>")

    return text
}

async function scrape(page){

    const sections = await getSections(page)

    const gameDesc = sections.find(s => s.line === "Game Description")
    const skill = sections.find(s => s.line === "Skill")

    const descHTML = await getSectionHTML(page, gameDesc.index)
    const skillHTML = await getSectionHTML(page, skill.index)

const key = slug(page)

output.description[key] = cleanDescription(descHTML)
output.skill_description[key] = cleanSkill(skillHTML)

    // keep skill raw so you can format it yourself
    output.skill_description[key] = skillHTML
}

async function run(){

    for(const cookie of cookies){
        console.log("Fetching:",cookie)
        await scrape(cookie)
    }

    fs.writeFileSync(
        "crk_descriptions.js",
        JSON.stringify(output,null,2)
    )

    console.log("Done.")
}

run()