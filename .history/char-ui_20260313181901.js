function getCharacterFromURL(){

    const params = new URLSearchParams(window.location.search)
    return params.get("char")

}

function getPageImagePath(name) {{
           let lower = name.toLowerCase()

        // 2. Remove 'cookie' at the end if it exists
        lower = lower.replace(/ cookie$/i, "")

        lower = lower.replace(/\s+/g,"_")

        let newName = lower.charAt(0).toUpperCase() + lower.slice(1)

        // 4. Build image path
        return `pictures/chars/${newName}_illustration.png`
    }
}

function renderCharacterPage(){

    const name = localStorage.getItem("selectedCookie")

    if(!name) return

    const img = document.getElementById("char-image")

    if(img){
        img.src = getPageImagePath(name)
    }

}

renderCharacterPage()