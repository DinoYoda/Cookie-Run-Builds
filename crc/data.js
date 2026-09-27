/**
 * Cookie Run: Crumble — game data (edit this file only for CRC content).
 *
 * Card art (wiki Cc_thumbnail_*): crc/pictures/cards/{name}_card.png
 * Illustration: crc/pictures/chars/{name}_illustration.png
 * Head icon: crc/pictures/icons/cookie/{name}_head.png
 * Skill icon: crc/pictures/skills/{name}_skill.png
 * Story / skill text: crc/crc_descriptions.js (description, skill_description, skill_details)
 * Optional: characterPage, cardImageFilename(name), listLabel
 */
window.registerGameData({
  id: "crc",
  name: "Cookie Run: Crumble",
  listLabel: "Characters",
  characterPage: "crc/character.html",
  cardImageShape: "thumbnail",
  rarityIconShape: "square",
  tierFeedback: true,

  characters: [
    {
      name: "Strawberry",
      displayName: "Strawberry Cookie",
      rarity: "C",
      role: "Charge",
      element: "Fire",
      skill: "Stay Away...",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Duration", recipient: true }],
      skillAttr: {
        attr1: [18.7, 19.3, 19.8, 20.4, 21, 21.6],
        attr2: [3, 3, 3, 3.5, 3.5, 3.5]
      }
    },
    {
      name: "Muscle",
      displayName: "Muscle Cookie",
      rarity: "C",
      role: "Tank",
      element: "Dark",
      skill: "Muscle King Power",
      cd: 3,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [11.7, 12.3, 12.9, 13.6, 14.3, 15],
        attr2: [220.6, 232.2, 244.4, 257.3, 270.8, 285],
        attr3: [0.45, 0.45, 0.45, 0.6, 0.6, 0.6]
      },
    },
    {
      name: "Ninja",
      displayName: "Ninja Cookie",
      rarity: "C",
      role: "Ranged",
      element: "Dark",
      skill: "Swift Strike",
      cd: 2,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Volley", recipient: true }],
      skillAttr: {
        attr1: [45.8, 48.1, 50.6, 53.3, 56.1, 59],
        attr2: [10, 10, 10, 13.5, 13.5, 13.5]
      },
    },
    {
      name: "Wizard",
      displayName: "Wizard Cookie",
      rarity: "C",
      role: "Ranged",
      element: "Light",
      skill: "Magic Storm",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Rapid fire", recipient: true }],
      skillAttr: {
        attr1: [69.7, 73.4, 77.3, 81.4, 85.8, 90.3],
        attr2: [3, 3, 3, 4, 4, 4]
      },
    },
    {
      name: "Skater",
      displayName: "Skater Cookie",
      rarity: "C",
      role: "Charge",
      element: "Water",
      skill: "Rolling Faster",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Chain", recipient: true }],
      skillAttr: {
        attr1: [19.5, 20.6, 21.7, 22.8, 24, 25.3],
        attr2: [24, 24, 24, 36, 36, 36]
      },
    },
    {
      name: "GingerBrave",
      displayName: "GingerBrave",
      rarity: "C",
      role: "Charge",
      element: "Fire",
      skill: "Brave Dash",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [278.6, 293.3, 308.7, 324.9, 342, 360],
        attr2: [0.45, 0.6]
      },
    },
    {
      name: "GingerBright",
      displayName: "GingerBright",
      rarity: "C",
      role: "Charge",
      element: "Light",
      skill: "Jolly Candy",
      cd: 2,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Duration", recipient: true }],
      skillAttr: {
        attr1: [119.9, 126.2, 132.8, 139.8, 147.1, 154.9],
        attr2: [35, 35, 35, 45, 45, 45]
      },
    },
    {
      name: "Blueberry_Bird",
      displayName: "Blueberry Bird",
      rarity: "C",
      role: "Support",
      element: "Water",
      skill: "Blueberry Bird Wish Delivery",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Volley", recipient: true }],
      skillAttr: {
        attr1: [256.5, 270, 284.2, 299.2, 314.9, 331.5],
        attr2: [30, 35, 40, 45, 50, 55],
        attr3: [4, 4, 4, 5, 5, 5]
      },
    },
    {
      name: "Sugar_Gnome",
      displayName: "Sugar Gnome",
      rarity: "C",
      role: "Charge",
      element: "Grass",
      skill: "Hammer of Revolution",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [18.1, 19, 20, 21.1, 22.2, 23.3],
        attr2: [54.1, 57, 59.9, 63.1, 66.4, 69.9]
      },
    },
    {
      name: "Cheerleader",
      displayName: "Cheerleader Cookie",
      rarity: "U",
      role: "Support",
      element: "Water",
      skill: "Cheering You On!",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Duration",
        },
        {
        type: "Range",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [79.5, 81.8, 84.2, 86.6, 89.1, 96.1],
        attr2: [40, 75]
      },
    },
    {
      name: "Coffee",
      displayName: "Coffee Cookie",
      rarity: "U",
      role: "Support",
      element: "Water",
      skill: "Care for Some Coffee?",
      cd: 5,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Duration",
        },
        {
        type: "Rapid fire",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [30, 35, 40, 45, 50, 55],
        attr2: [40, 75]
      },
    },
    {
      name: "Zombie",
      displayName: "Zombie Cookie",
      rarity: "U",
      role: "Tank",
      element: "Grass",
      skill: "Braiiiiins",
      cd: 2,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Projectile speed", recipient: true }],
      skillAttr: {
        attr1: [20.6, 21.7, 22.8, 24, 25.3, 26.6],
        attr2: [66, 99]
      },
    },
    {
      name: "Princess",
      displayName: "Princess Cookie",
      rarity: "U",
      role: "Charge",
      element: "Fire",
      skill: "Royal Swing",
      cd: 2,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [87.5, 92.1, 96.9, 102, 107.4, 113.1],
        attr2: [10, 15]
      },
    },
    {
      name: "Knight",
      displayName: "Knight Cookie",
      rarity: "U",
      role: "Tank",
      element: "Light",
      skill: "Cavalry Charge",
      cd: 5,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Range",
        },
        {
        type: "Range",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [113.3, 119.3, 125.6, 132.2, 139.2, 146.6],
        attr2: [30, 50]
      },
    },
    {
      name: "Angel",
      displayName: "Angel Cookie",
      rarity: "U",
      role: "Support",
      element: "Light",
      skill: "Celestial Light",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Duration", recipient: true }],
      skillAttr: {
        attr1: [394.6, 415.4, 437.3, 460.3, 484.5, 510],
        attr2: [20, 30]
      },
    },
    {
      name: "Gumball",
      displayName: "Gumball Cookie",
      rarity: "U",
      role: "Tank",
      element: "Water",
      skill: "Gumball Cannon",
      cd: 5,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Volley", recipient: true }],
      skillAttr: {
        attr1: [82.2, 86.6, 91.1, 95.8, 100.9, 106.2],
        attr2: [1.5, 2],
        attr3: [60, 70]
      },
    },
    {
      name: "Onion",
      displayName: "Onion Cookie",
      rarity: "U",
      role: "Support",
      element: "Dark",
      skill: "Unstoppable Tears",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [18.3, 19.3, 20.3, 21.4, 22.5, 23.7],
        attr2: [-10, -15]
      },
    },
    {
      name: "Devil",
      displayName: "Devil Cookie",
      rarity: "U",
      role: "Ranged",
      element: "Dark",
      skill: "Candy Fork Toss",
      cd: 1,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Pierce", recipient: true }],
      skillAttr: {
        attr1: [48.8, 51.4, 54.1, 56.9, 59.9, 63.1],
        attr2: [35, 50],
        attr3: [40, 44, 48, 52, 56, 60]
      },
    },
    {
      name: "Red_Pepper",
      displayName: "Red Pepper Cookie",
      rarity: "U",
      role: "Charge",
      element: "Fire",
      skill: "Burning Spirit",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [25.9, 27.3, 28.7, 30.2, 31.8, 33.5],
        attr2: [10, 8],
        attr3: [5.5, 6, 6.2, 6.8, 7, 7.5]
      },
    },
    {
      name: "Adventurer",
      displayName: "Adventurer Cookie",
      rarity: "U",
      role: "Charge",
      element: "Grass",
      skill: "Rope Master",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Duration", recipient: true }],
      skillAttr: {
        attr1: [26, 28, 30, 32, 34, 36]
      },
    },
    {
      name: "Dark_Cherry",
      displayName: "Dark Cherry Cookie",
      rarity: "R",
      role: "Charge",
      element: "Fire",
      skill: "SLICE!",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Rapid fire", recipient: true }],
      skillAttr: {
        attr1: [38.7, 40.7, 42.8, 45.1, 47.5, 50]
      },
    },
    {
      name: "Grapevine",
      displayName: "Grapevine Cookie",
      rarity: "R",
      role: "Support",
      element: "Grass",
      skill: "Overly Rich Juice",
      cd: 5,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Rapid fire",
        },
        {
        type: "Range",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [190.4, 200.4, 210.9, 222, 233.7, 246],
        attr2: [1, 2]
      },
    },
    {
      name: "Berry_Yogurt",
      displayName: "Berry Yogurt Cookie",
      rarity: "R",
      role: "Tank",
      element: "Water",
      skill: "Yogurt Smash",
      cd: 1,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [30.2, 31.8, 33.4, 35.2, 37, 39],
        attr2: [1.75, 2.5]
      },
    },
    {
      name: "Blackberry",
      displayName: "Blackberry Cookie",
      rarity: "R",
      role: "Charge",
      element: "Dark",
      skill: "Ghost Servants",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Projectile speed", recipient: true }],
      skillAttr: {
        attr1: [14.5, 15.2, 16, 16.8, 17.7, 18.6],
        attr2: [7],
        attr3: [4, 4, 4, 5, 5, 5]
      },
    },
    {
      name: "Alchemist",
      displayName: "Alchemist Cookie",
      rarity: "R",
      role: "Ranged",
      element: "Water",
      skill: "Clinical Trial",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Projectile speed",
        },
        {
        type: "Range",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [77.8, 81.9, 86.2, 90.7, 95.6, 100.5],
        attr2: [50, 75]
      },
    },
    {
      name: "Lilac",
      displayName: "Lilac Cookie",
      rarity: "R",
      role: "Ranged",
      element: "Dark",
      skill: "Chakram Throw",
      cd: 2,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Pierce", recipient: true }],
      skillAttr: {
        attr1: [50.5, 53.2, 55.9, 58.8, 62, 65.2],
        attr2: [3, 4]
      },
    },
    {
      name: "Space_Doughnut",
      displayName: "Space Doughnut",
      rarity: "R",
      role: "Ranged",
      element: "Light",
      skill: "Doughnut Beam",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Pierce", recipient: true }],
      skillAttr: {
        attr1: [57.6, 60.7, 63.8, 67.2, 70.2, 74.4],
        attr2: [2, 3]
      },
    },
    {
      name: "Poison_Mushroom",
      displayName: "Poison Mushroom Cookie",
      rarity: "R",
      role: "Charge",
      element: "Dark",
      skill: "Poison Cloud",
      cd: 5,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [12.4, 13, 13.7, 14.4, 15.2, 16],
        attr2: [2.6, 3.5]
      },
    },
    {
      name: "Cheesecake",
      displayName: "Cheesecake Cookie",
      rarity: "R",
      role: "Support",
      element: "Light",
      skill: "Cheerful Invitation!",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Volley",
        },
        {
        type: "Pierce",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [2, 3],
        attr2: [2],
        attr3: [40, 44, 48, 52, 56, 60],
        attr4: [1],
        attr5: [7]
      },
    },
    {
      name: "Cherry",
      displayName: "Cherry Cookie",
      rarity: "R",
      role: "Ranged",
      element: "Fire",
      skill: "Cherry Bomb",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Rapid fire", recipient: true }],
      skillAttr: {
        attr1: [66.6, 70.1, 73.8, 77.7, 81.8, 86.1],
        attr2: [3],
        attr3: [1, 1.5]
      },
    },
    {
      name: "Cocoa",
      displayName: "Cocoa Cookie",
      rarity: "R",
      role: "Tank",
      element: "Water",
      skill: "Marshmallow Cocoa",
      cd: 5,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Projectile speed", recipient: true }],
      skillAttr: {
        attr1: [19.4, 20.3, 21.4, 22.5, 23.7, 25],
        attr2: [40, 40, 40, 60, 60, 60]
      },
    },
    {
      name: "Bear_Jelly_Worker",
      displayName: "Bear Jelly Worker",
      rarity: "R",
      role: "Charge",
      element: "Fire",
      skill: "Ultimate Strike",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Rapid fire", recipient: true }],
      skillAttr: {
        attr1: [67.2, 70.8, 74.5, 78.4, 82.5, 86.9]
      },
    },
    {
      name: "Licorice",
      displayName: "Licorice Cookie",
      rarity: "SR",
      role: "Tank",
      element: "Dark",
      skill: "Licorice Servants",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Volley", recipient: true }],
      skillAttr: {
        attr1: [60.8, 64, 67.4, 70.9, 74.6, 78.5],
        attr2: [1, 30],
        attr3: [20.7, 21.8, 22.9, 24.1, 25.4, 26.7],
        attr4: [100],
        attr5: [5],
        attr6: [5, 7]
      },
    },
    {
      name: "Herb",
      displayName: "Herb Cookie",
      rarity: "SR",
      role: "Support",
      element: "Grass",
      skill: "Sunny Garden",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Volley",
        provider: true,
        },
        {
        type: "Rapid fire",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [31.6, 33.3, 35.1, 36.9, 38.8, 40.8],
        attr2: [2.5],
        attr3: [6],
        attr4: [1, 2]
      },
    },
    {
      name: "Rye",
      displayName: "Rye Cookie",
      rarity: "SR",
      role: "Ranged",
      element: "Fire",
      skill: "Showdown Time",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Rapid fire", recipient: true }],
      skillAttr: {
        attr1: [96.8, 99.6, 102.4, 105.4, 108.4, 111.5],
        attr2: [10, 6]
      },
    },
    {
      name: "Popcorn",
      displayName: "Popcorn Cookie",
      rarity: "SR",
      role: "Ranged",
      element: "Light",
      skill: "Ready, Action!",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Duration", recipient: true }],
      skillAttr: {
        attr1: [59.8, 62.9, 66.2, 69.8, 73.4, 77.2],
        attr2: [6, 6, 6, 8, 8, 8]
      },
    },
    {
      name: "Dr._Wasabi",
      displayName: "Dr. Wasabi Cookie",
      rarity: "SR",
      role: "Ranged",
      element: "Grass",
      skill: "Wasabi Syrup",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Rapid fire", recipient: true }],
      skillAttr: {
        attr1: [62.3, 65.6, 69, 72.7, 76.5, 80.5],
        attr2: [1, 1.5]
      },
    },
    {
      name: "Peach",
      displayName: "Peach Cookie",
      rarity: "SR",
      role: "Charge",
      element: "Fire",
      skill: "Peach Bo-Staff",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Duration", recipient: true }],
      skillAttr: {
        attr1: [29.4, 31.1, 32.7, 34.5, 36.3, 38.3],
        attr2: [1.5],
        attr3: [59.4, 62.5, 65.8, 69.2, 72.8, 76.6],
        attr4: [2],
        attr5: [35, 45],
        attr6: [1.75]
      },
    },
    {
      name: "Pancake",
      displayName: "Pancake Cookie",
      rarity: "SR",
      role: "Ranged",
      element: "Grass",
      skill: "Take an Acorn!",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Duration", recipient: true }],
      skillAttr: {
        attr1: [40.8, 42.8, 45.1, 47.5, 50.1, 52.8],
        attr2: [0.5, 1],
        attr3: [-15, -18, -21, -24, -27, -30]
      },
    },
    {
      name: "Orange",
      displayName: "Orange Cookie",
      rarity: "SR",
      role: "Support",
      element: "Water",
      skill: "Juicy Smash",
      cd: 9,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Rapid fire",
        },
        {
        type: "Duration",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [197.4, 207.7, 218.6, 230.1, 242.2, 255],
        attr2: [30, 36, 42, 48, 54, 60],
        attr3: [1, 2]
      },
    },
    {
      name: "Macaron",
      displayName: "Macaron Cookie",
      rarity: "SR",
      role: "Support",
      element: "Grass",
      skill: "Mighty Macaron Parade",
      cd: 7,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Range",
        provider: true,
        },
        {
        type: "Rapid fire",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [72.9, 76.7, 80.8, 85, 89.4, 94],
        attr2: [0.5, 0.5, 0.5, 0.75, 0.75, 0.75],
        attr3: [7, 8, 9, 10, 11, 12]
      },
    },
    {
      name: "Rockstar",
      displayName: "Rockstar Cookie",
      rarity: "SR",
      role: "Support",
      element: "Fire",
      skill: "Legend of Rock",
      cd: 10,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Pierce",
        provider: true,
        },
        {
        type: "Range",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [5, 6, 7, 8, 9, 10],
        attr2: [2, 2, 2, 3, 3, 3]
      },
    },
    {
      name: "Tiger_Lily",
      displayName: "Tiger Lily Cookie",
      rarity: "SR",
      role: "Charge",
      element: "Grass",
      skill: "Tiger Pounce",
      cd: 10,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Volley",
        },
        {
        type: "Duration",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [2, 2, 2, 3, 3, 3],
        attr2: [88, 92.6, 97.5, 102.6, 108, 113.7]
      },
    },
    {
      name: "Lemon",
      displayName: "Lemon Cookie",
      rarity: "SR",
      role: "Ranged",
      element: "Light",
      skill: "Lightning Cube",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Projectile speed", recipient: true }],
      skillAttr: {
        attr1: [98.1, 103.3, 108.7, 114.4, 120.4, 126.7],
        attr2: [2.2, 3]
      },
    },
    {
      name: "Dr._Bones",
      displayName: "Dr. Bones Cookie",
      rarity: "SR",
      role: "Support",
      element: "Grass",
      skill: "Emergency CPR",
      cd: 5,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Chain", recipient: true }],
      skillAttr: {
        attr1: [311.4, 334, 351.7, 370.2, 389.7, 410.2],
        attr2: [52.4, 55.1, 58, 61, 64.3, 67.7],
        attr3: [3, 4],
        attr4: [10, 12, 14, 16, 18, 20]
      },
    },
    {
      name: "Witchberry",
      displayName: "Witchberry Cookie",
      rarity: "SR",
      role: "Ranged",
      element: "Dark",
      skill: "Feline Ruckus",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Pierce", recipient: true }],
      skillAttr: {
        attr1: [124.5, 131.5, 138.2, 145, 152, 160.3],
        attr2: [3, 3, 3, 4, 4, 4]
      },
    },
    {
      name: "Lime",
      displayName: "Lime Cookie",
      rarity: "SR",
      role: "Support",
      element: "Water",
      skill: "Beach Ball Surprise",
      cd: 8,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Chain",
        },
        {
        type: "Volley",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [114.7, 120.7, 127, 133.7, 140.7, 148.1],
        attr2: [30, 36, 42, 48, 54, 60],
        attr3: [1, 2]
      },
    },
    {
      name: "Vampire",
      displayName: "Vampire Cookie",
      rarity: "SSR",
      role: "Charge",
      element: "Fire",
      skill: "Vampirism",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Chain", recipient: true }],
      skillAttr: {
        attr1: [333.8, 351.4, 370, 389.5, 409.9, 431.5],
        attr2: [-35, -37, -39, -41, -43, -45],
        attr3: [60, 80]
      },
    },
    {
      name: "Espresso",
      displayName: "Espresso Cookie",
      rarity: "SSR",
      role: "Ranged",
      element: "Grass",
      skill: "Grinding",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [20.2, 21.2, 22.4, 23.6, 24.8, 26.2],
        attr2: [15, 20],
        attr3: [232.4, 244.6, 257.4, 271, 285.2, 300.3],
        attr4: [2.5, 7.5]
      },
    },
    {
      name: "Strawberry_Crepe",
      displayName: "Strawberry Crepe Cookie",
      rarity: "SSR",
      role: "Tank",
      element: "Light",
      skill: "Crepe Crasher",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Rapid fire", recipient: true }],
      skillAttr: {
        attr1: [123.1, 129.6, 135.4, 143.6, 151.2, 159.2],
        attr2: [2.25, 2.75]
      },
    },
    {
      name: "Cream_Puff",
      displayName: "Cream Puff Cookie",
      rarity: "SSR",
      role: "Ranged",
      element: "Light",
      skill: "Jellius Extremus!",
      cd: 7,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Duration", recipient: true }],
      skillAttr: {
        attr1: [14, 14.7, 15.5, 16.3, 17.2, 18.1],
        attr2: [2.4, 2.4, 2.4, 3, 3, 3]
      },
    },
    {
      name: "Twizzly_Gummy",
      displayName: "Twizzly Gummy Cookie",
      rarity: "SSR",
      role: "Ranged",
      element: "Dark",
      skill: "Twizzly Beam",
      cd: 3,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Chain", recipient: true }],
      skillAttr: {
        attr1: [163.8, 172.4, 181.5, 191, 201, 211.6]
      },
    },
    {
      name: "Milky_Way",
      displayName: "Milky Way Cookie",
      rarity: "SSR",
      role: "Ranged",
      element: "Light",
      skill: "Sugarcloud Express",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [61.1, 62.8, 64.6, 66.5, 68.4, 70.4],
        attr2: [15, 20]
      },
    },
    {
      name: "Dark_Choco",
      displayName: "Dark Choco Cookie",
      rarity: "SSR",
      role: "Tank",
      element: "Dark",
      skill: "Dark Sword Strike",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Duration", recipient: true }],
      skillAttr: {
        attr1: [39.3, 41.3, 43.4, 45.7, 48.2, 50.8],
        attr2: [1, 1.5],
        attr3: [-2.5, -3.5, -4.5, -5.5, -6.5, -7.5]
      },
    },
    {
      name: "Madeleine",
      displayName: "Madeleine Cookie",
      rarity: "SSR",
      role: "Tank",
      element: "Light",
      skill: "Commander's Blade",
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Projectile speed",
        recipient: true,
        },
        {
        type: "Range",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [126.3, 132.9, 139.9, 147.4, 155.2, 163.4],
        attr2: [12, 25]
      },
    },
    {
      name: "Toothpaste",
      displayName: "Toothpaste Cookie",
      rarity: "SSR",
      role: "Support",
      element: "Grass",
      skill: "Electronic Battlefield Orchestra",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Range",
        },
        {
        type: "Volley",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [189, 198.8, 209.3, 220.3, 232, 244.2],
        attr2: [235.2, 364.7, 383.8, 404, 425.2, 447.6],
        attr3: [50, 70]
      },
    },
    {
      name: "Schwarzwälder",
      displayName: "Schwarzwälder",
      rarity: "SSR",
      role: "Tank",
      element: "Fire",
      skill: "Choco Chip Hammer",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [98.6, 101.4, 104.3, 107.3, 110.4, 113.6],
        attr2: [10, 15]
      },
    },
    {
      name: "Pomegranate",
      displayName: "Pomegranate Cookie",
      rarity: "SSR",
      role: "Support",
      element: "Dark",
      skill: "Pomegranate Magic",
      cd: 10,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Projectile speed",
        },
        {
        type: "Volley",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [46.5, 51, 55.5, 60, 64.5, 69],
        attr2: [75, 100]
      },
    },
    {
      name: "Scorpion",
      displayName: "Scorpion Cookie",
      rarity: "SSR",
      role: "Ranged",
      element: "Fire",
      skill: "Venom Sting",
      cd: 4,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Volley",
        recipient: true,
        },
        {
        type: "Duration",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [21, 22.1, 23.3, 24.4, 25.8, 27.1],
        attr2: [75, 100],
        attr3: [7.5, 8, 8.5, 9, 9.5, 10]
      },
    },
    {
      name: "Space_Doughnut's_Royal_Excellence",
      displayName: "Space Doughnut's Royal Excellence",
      rarity: "SSR",
      role: "Support",
      element: "Light",
      skill: "Doughnut Beam",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Rapid fire",
        recipient: true,
        },
        {
        type: "Duration",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [56, 58.9, 62, 65.3, 68.7, 72.3],
        attr2: [2.5, 3]
      },
    },
    {
      name: "Cream_Soda",
      displayName: "Cream Soda Cookie",
      rarity: "SSR",
      role: "Charge",
      element: "Water",
      skill: "Cream Soda Blade",
      cd: 3,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Range",
        },
        {
        type: "Projectile speed",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [57.4, 60.4, 63.6, 67, 70.4, 74.1],
        attr2: [42, 44.2, 46.6, 49, 51.6, 54.4],
        attr3: [3, 4]
      },
    },
    {
      name: "Milk_Cookie's_Crunchy_Strong_Pediatrician",
      displayName: "Milk Cookie's Crunchy Strong Pediatrician",
      rarity: "SSR",
      role: "Support",
      element: "Light",
      skill: "Gentle Remedy",
      cd: 7,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Duration",
        provider: true,
        },
        {
        type: "Projectile speed",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [18.2, 19.2, 20.2, 21.3, 22.4, 23.6],
        attr2: [6, 6.8, 7.6, 8.4, 9.2, 10],
        attr3: [40, 75]
      },
    },
    {
      name: "Ion_Cookie_Robot",
      displayName: "Ion Cookie Robot",
      rarity: "SSR",
      role: "Tank",
      element: "Water",
      skill: "Ion Shield",
      cd: 7,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Volley", recipient: true }],
      skillAttr: {
        attr1: [156.3, 164.5, 173.2, 182.3, 191.9, 202],
        attr2: [7.5, 9, 10.5, 12, 13.5, 15],
        attr3: [3.5, 4.25]
      },
    },
    {
      name: "Cool_Mint",
      displayName: "Cool Mint Cookie",
      rarity: "SSR",
      role: "Charge",
      element: "Water",
      skill: "Impact Excavation",
      cd: 8,
      releaseDate: "August 13, 2026 (17:00 GMT +9)",
      synergy: [
        {
        type: "Volley",
        recipient: true,
        },
        {
        type: "Duration",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [22.7, 23.8, 25.2, 26.5, 27.8, 29.3],
        attr2: [184.7, 194.4, 204.6, 215.4, 226.8, 238.8],
        attr3: [5, 5, 5, 6.5, 6.5, 6.5],
        attr4: [0.4, 0.4, 0.4, 0.6, 0.6, 0.6],
        attr5: [48.5, 51.1, 53.6, 56.4, 59.5, 62.5]
      },
    },
    {
      name: "Strawberry_Shortcake",
      displayName: "Strawberry Shortcake Cookie",
      rarity: "SSR",
      role: "Charge",
      element: "Grass",
      skill: "Giant Cake Hound",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Pierce",
        },
        {
        type: "Projectile speed",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [60, 70, 80, 90, 100, 110],
        attr2: [2, 3],
        attr3: [143.9, 151.5, 159.4, 167.8, 176.7, 186]
      },
    },
    {
      name: "Nameless_Cake_Hound",
      displayName: "Nameless Cake Hound",
      rarity: "SSR",
      role: "Tank",
      element: "Fire",
      skill: "Giant Flame Slash",
      cd: 7,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [183.7, 193.3, 203.5, 214.2, 225.6, 237.4],
        attr2: [10, 15]
      },
    },
    {
      name: "Skating_Queen",
      displayName: "Skating Queen Cookie",
      rarity: "SSR",
      role: "Charge",
      element: "Water",
      skill: "A Perfect Perfomance",
      cd: 8,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [
        {
        type: "Chain",
        provider: true,
        },
        {
        type: "Duration",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [22, 23.2, 24.4, 25.7, 27, 28.4],
        attr2: [40, 45, 50, 55, 60, 65],
        attr3: [1, 2]
      },
    },
    {
      name: "Melon_Soda",
      displayName: "Melon Soda Cookie",
      rarity: "SSR",
      role: "Ranged",
      element: "Water",
      skill: "Soda Blast",
      cd: 5,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Rapid fire", recipient: true }],
      skillAttr: {
        attr1: [45.6, 48.1, 50.6, 53.2, 56, 59],
        attr2: [20, 25]
      },
    },
    {
      name: "Pinot_Noir",
      displayName: "Pinot Noir Cookie",
      rarity: "SSR",
      role: "Support",
      element: "Dark",
      skill: "Shadow Bind",
      releaseDate: "August 27, 2026 (17:00 GMT +9)",
      synergy: [
        {
        type: "Rapid fire",
        provider: true,
        },
        {
        type: "Chain",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [70, 73.7, 77.6, 81.7, 85.9, 90.4],
        attr2: [65, 65, 65, 80, 80, 80],
        attr3: [45, 50, 55, 60, 65, 70],
        attr4: [1, 1, 1, 2, 2, 2]
      },
    },
    {
      name: "Tea_Knight",
      displayName: "Tea Knight Cookie",
      rarity: "SSR",
      role: "Tank",
      element: "Light",
      skill: "Battlemaster",
      cd: 10,
      releaseDate: "August 27, 2026 (17:00 GMT +9)",
      synergy: [{ type: "Range", recipient: true }],
      skillAttr: {
        attr1: [120.8, 127.2, 133.6, 140.8, 148, 155.2],
        attr2: [10, 20, 30, 40, 50, 60],
        attr3: [45, 50, 55, 60, 65, 70],
        attr4: [8, 8, 8, 10, 10, 10]
      },
    },
    {
      name: "Oven_Wanderer",
      displayName: "Oven Wanderer Cookie",
      rarity: "TSSR",
      role: "Charge",
      element: "Fire",
      skill: "Brave Slash",
      cd: 6,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Chain", recipient: true }],
      skillAttr: {
        attr1: [46.1, 49.4, 53, 56.9, 61, 65.4],
        attr2: [2.1, 2.2, 2.4, 2.5, 2.7, 2.9]
      },
    },
    {
      name: "Wind_Archer",
      displayName: "Wind Archer Cookie",
      rarity: "TSSR",
      role: "Ranged",
      element: "Grass",
      skill: "Last Wind",
      cd: 2,
      releaseDate: "July 30, 2026 (10:00 GMT +9)",
      synergy: [{ type: "Pierce", recipient: true }],
      skillAttr: {
        attr1: [105.2, 110.8, 116.6, 122.7, 129.3, 136.1],
        attr2: [235.6, 248.1, 261.3, 274.9, 289.2, 304.4],
        attr3: [12, 10]
      },
    },
    {
      name: "Brightseeker",
      displayName: "Brightseeker Cookie",
      rarity: "TSSR",
      role: "Ranged",
      element: "Light",
      skill: "Satellite Shock",
      cd: 9,
      releaseDate: "August 27, 2026 (17:00 GMT +9)",
      synergy: [{ type: "Duration", recipient: true }],
      skillAttr: {
        attr1: [2, 2, 2, 3, 3, 3],
        attr2: [60.6, 63.9, 67.4, 71, 74.6, 78.5],
        attr3: [165, 174, 183, 193, 203, 213]
      },
    },
    {
      name: "Cherry_Cola",
      displayName: "Cherry Cola Cookie",
      rarity: "SSR",
      role: "Charge",
      element: "Water",
      releaseDate: "September 10, 2026 (17:00 GMT +9)",
      skill: "Tart Cherry Slash",
      cd: 1,
      synergy: [
        {
        type: "Rapid fire",
        recipient: true,
        },
        {
        type: "Volley",
        recipient: true,
        }
      ],
      skillAttr: {
        attr1: [141, 148, 156, 165, 173, 182],
        attr2: [189, 199, 209, 221, 232, 245],
        attr3: [1.2249999999999999, 1.2249999999999999, 1.2249999999999999, 2.5, 2.5, 2.5]
      },
    },
  ],

  tierlists: [
    {
      name: "Characters",
      features: {
        eidolon: false,
        tags: false,
        elementIcon: false,
        role: false,
      },
      filters: {
        rarity: ["TSSR", "SSR", "SR", "R", "U", "C"],
        role: ["Tank", "Charge", "Ranged", "Support"],
        element: ["Fire", "Grass", "Water", "Light", "Dark"],
        synergy: [
          "Duration",
          "Range",
          "Volley",
          "Rapid fire",
          "Chain",
          "Projectile speed",
          "Pierce",
        ],
      },
      tierlists: [
        {
          name: "General",
          tiers: ["S", "A", "B", "C", "D"],
          entries: [[], [], [], [], []],
        },
      ],
    },
  ],
})
