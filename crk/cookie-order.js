window.cookieOrder = {
    "Front": ["Rumi Cookie", "Mira Cookie", "GingerBrave", "Tea Knight Cookie", "Millennial Tree Cookie", "Silent Salt Cookie", "Hollyberry Cookie (Aegis)", "Hollyberry Cookie", "Rajapendra Cookie of Mortality", "Space Doughnut", "Kouign-Amann Cookie", "Schwarzwälder", "Stormbringer Cookie", "Cloud Haetae Cookie", "Mold Dough Cookie", "Fettuccine Cookie", "Pinecone Cookie", "Elder Faerie Cookie", "Capsaicin Cookie", "Mala Sauce Cookie", "Camellia Cookie", "Wildberry Cookie", "Icicle Yeti Cookie", "Strawberry Cookie", "Moon Rabbit Cookie", "Mercurial Knight Cookie", "Princess Cookie", "Cocoa Cookie", "Dark Choco Cookie", "Muscle Cookie", "Crunchy Chip Cookie", "Crimson Coral Cookie", "Salt Cellar Cookie", "Pulpo Cookie", "Burnt Cheese Cookie", "Pitaya Dragon Cookie", "Avocado Cookie", "Milky Way Cookie", "Rebel Cookie", "Strawberry Crepe Cookie", "Purple Yam Cookie", "Financier Cookie", "Butter Roll Cookie", "Kumiho Cookie", "Milk Cookie", "Dark Cacao Cookie", "Madeleine Cookie", "Knight Cookie", "Red Velvet Cookie", "Black Forest Cookie", "Burning Spice Cookie", "Jagae Cookie", "Cream Soda Cookie", "Grapefruit Cookie", "Ash Salt Cookie", "Green Tea Mousse Cookie", "Raspberry Cookie", "Werewolf Cookie", "Caramel Arrow Cookie"],
    "Middle": ["Snow Sugar Cookie", "Peach Blossom Cookie", "Red Osmanthus Cookie", "Choco Drizzle Cookie", "Mozzarella Cookie", "Sonic Cookie", "Frilled Jellyfish Cookie", "Matcha Cookie", "Macaron Cookie", "Clotted Cream Cookie", "Ananas Dragon Cookie", "Time Shadow Cookie", "Pom-Pom Dough Cookie", "Royal Margarine Cookie", "Tails Cookie", "Golden Osmanthus Cookie", "Street Urchin Cookie", "Sherbet Cookie", "Eternal Sugar Cookie", "Golden Cheese Cookie (Immortal)", "Golden Cheese Cookie", "Doughael", "Rockstar Cookie", "Timekeeper Cookie", "Shadow Milk Cookie", "Black Lemonade Cookie", "Blueberry Pie Cookie", "Prune Juice Cookie", "Stardust Cookie", "Affogato Cookie", "Shining Glitter Cookie", "Captain Caviar Cookie", "Pomegranate Cookie", "Eclair Cookie", "Moonlight Cookie", "Black Sapphire Cookie", "Sorbet Shark Cookie", "Mango Cookie", "Sea Fairy Cookie", "Fig Cookie", "Black Raisin Cookie", "Candy Apple Cookie", "Latte Cookie", "Espresso Cookie", "Lilac Cookie", "Poison Mushroom Cookie", "Onion Cookie", "Chili Pepper Cookie", "Dark Enchantress Cookie", "Carrot Cookie", "Devil Cookie", "White Lily Cookie (Dawnbringer)", "White Lily Cookie", "Squid Ink Cookie", "Wizard Cookie", "Licorice Cookie", "Adventurer Cookie", "Alchemist Cookie", "Povidone-Iodine Cookie", "Asphodel Cookie", "Frost Queen Cookie", "Lemon Cookie", "Black Pearl Cookie", "Wedding Cake Cookie", "Agar Agar Cookie", "Pumpkin Pie Cookie", "Okchun Cookie", "Ninja Cookie"],
    "Back": ["Linzer Cookie", "Blackberry Cookie", "Prophet Cookie", "Tarte Tatin Cookie", "Oyster Cookie", "Pudding à la Mode Cookie", "Twizzly Gummy Cookie", "Mint Choco Cookie", "Cotton Cookie", "Angel Cookie", "Herb Cookie", "Sparkling Cookie", "Pure Vanilla Cookie (Compassionate)", "Pure Vanilla Cookie", "Parfait Cookie", "Seltzer Cookie", "Cherry Blossom Cookie", "Sugarfly Cookie", "Menthol Cookie", "Orange Cookie", "Manju Cookie", "Pavlova Cookie", "Venom Dough Cookie", "Charcoal Cookie", "Litmus Cookie", "Mogra Cookie", "Croissant Cookie", "Nether Queen Cookie", "Lime Cookie", "Chess Choco Cookie", "Zoey Cookie", "Glinda Cookie", "Elphaba Cookie", "Peppermint Cookie", "Caramel Choux Cookie", "Rye Cookie", "Crème Brûlée Cookie", "Pancake Cookie", "Gumball Cookie", "Beet Cookie", "Mystic Flour Cookie", "Clover Cookie", "Vampire Cookie", "Cream Puff Cookie", "Custard Cookie III", "Cherry Cookie", "Cream Unicorn Cookie", "Carol Cookie", "Nutmeg Tiger Cookie", "Olive Cookie", "Silverbell Cookie", "Pastry Cookie", "Tiger Lily Cookie", "Fire Spirit Cookie", "Smoked Cheese Cookie", "Wind Archer Cookie", "Almond Cookie", "Cream Ferret Cookie", "Star Coral Cookie", "Candy Diver Cookie", "Snapdragon Cookie", "Marshmallow Bunny Cookie", "BTS", "Jung Kook Cookie", "V Cookie", "Jimin Cookie", "J-hope Cookie", "Sugar Swan Cookie", "SUGA Cookie", "Jin Cookie", "RM Cookie"],
}

;(function () {
  const ROWS = ["Front", "Middle", "Back"]
  const indexMap = new Map()

  function registerKey(key, row, idx) {
    const k = String(key || "").trim().toLowerCase()
    if (!k || indexMap.has(k)) return
    indexMap.set(k, { row, idx })
  }

  function registerDisplayName(name, row, idx) {
    registerKey(name, row, idx)
    if (/\s+Cookie$/i.test(name)) {
      registerKey(name.replace(/\s+Cookie$/i, ""), row, idx)
    } else {
      registerKey(`${name} Cookie`, row, idx)
    }
    registerKey(name.replace(/_/g, " "), row, idx)
  }

  for (let row = 0; row < ROWS.length; row++) {
    const list = window.cookieOrder[ROWS[row]] || []
    list.forEach((name, idx) => registerDisplayName(name, row, idx))
  }

  function lookupRank(label) {
    if (!label) return null
    const direct = indexMap.get(String(label).trim().toLowerCase())
    if (direct) return direct
    const underscored = String(label).trim().replace(/\s+/g, "_").toLowerCase()
    return indexMap.get(underscored.replace(/_/g, " ")) || null
  }

  window.getCookieBattleOrderRank = function getCookieBattleOrderRank(charData, member) {
    const candidates = []
    if (charData?.displayName) candidates.push(charData.displayName)
    if (charData?.name) {
      candidates.push(charData.name)
      candidates.push(charData.name.replace(/_/g, " "))
    }
    if (member?.char) candidates.push(member.char, String(member.char).replace(/_/g, " "))
    if (member?.name) candidates.push(member.name, String(member.name).replace(/_/g, " "))

    for (const c of candidates) {
      const hit = lookupRank(c)
      if (hit) return hit
    }
    return { row: 999, idx: 999 }
  }
})()
