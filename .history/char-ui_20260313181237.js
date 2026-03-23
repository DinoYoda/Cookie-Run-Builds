function getCharacterFromURL(){

    const params = new URLSearchParams(window.location.search)
    return params.get("char")

}

function renderCharacter(){

    const slug = getCharacterFromURL()

    if(!slug) return

    const imgPath = `chars/character_illustration.png`

    document.getElementById("char-image").src = imgPath

}

renderCharacter()