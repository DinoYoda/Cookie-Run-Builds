function getCharacterFromURL(){

    const params = new URLSearchParams(window.location.search)
    return params.get("char")

}

function renderCharacter(){

    const slug = getCharacterFromURL()

    if(!slug) return

    const imgPath = `chars/${slug}_illustration.png`

    document.getElementById("char-image").src = imgPath

}

renderCharacter()