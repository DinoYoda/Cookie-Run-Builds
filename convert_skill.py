import re
import sys

# -------- STATUS CONVERSION --------
def convert_statuses(text):

    statuses = [
        "Max HP Up","ATK Up","DEF Up","CRIT Chance Up","Cooldown Down","ATK SPD Up",
        "DMG Down","Regular DMG Up","CRIT DMG Up","CRIT Resist Up","Stun DMG Up",
        "DMG Focus","HP Shield","Invulnerable","Immortality","Amplify Buff",
        "Debuff Resist","Periodic DMG Duration Up","Current Charge","Tailwind",
        "Earth's Protection","Blessing of Light","Stun Resistance","Stun Immunity",
        "Freeze Resistance","Healing Up","Revive","Taunt","Curse Protection",
        "Buff Protection","Immune to Interrupts","Shackle Immunity",
        "Cooldown Recovery Up","Injury","Fatal Wound","ATK Down","DEF Down",
        "CRIT Chance Down","CRIT DMG Down","Cooldown Up","ATK SPD Down",
        "Frost","Slow","Shock","Weakness","Damage Link","Thorn Cage",
        "Shields Blocked","Debuff Resist Bypass","Healing Down",
        "Healing Prevention","Consuming Darkness","Poison","Burn","Corruption",
        "Zap","Vampiric Bite","Sea Foam","Overcurrent","Explosive Burn",
        "Endless Flow","Stun","Shackles","Charm","Silence","Freeze",
        "Fear","Sleep","Paralysis","Glitch","Apathy", "Puppet Show", "Taint", "DMG Dealt Down", "Healing",
        "MOV SPD Down", "Seeds", "Dawn Lily Restoration", "Petals of Restoration", "Incapacitation Immunity",
        "Incapacitation Status Protection", "DMG Dampening", "Seed of Life", "Berry of Life", "DMG Debuff Resist",
        "Steelbound Passion", "Shield of Conviction", "Shards of Light", "Light of Truth", "Spear of Immortality",
        "Immortal's Punishment", "Immortal's Return", "Curse", "Gloom", "Darkness Absorption", "Delightful Temptation", 
        "Guilt", "Enchantment", "Laxness", "DMG Dealt Up", "Berserker", "Enrage", "Revelry of Flames", 
        "The Destroyer's Gaze", "Taunted", "Pale Plague", "Touch of Meaninglessness", "Light Cage", "Chilled", "Drowsy",
        "Terror of the Abyss", "Water Cage", "Lividness", "Supercharge", "Ultracharge", "CRIT Chance Down Resist", "Cyclone",
        "Trace of the Wind", "Pursuer", "Mighty Gale", "Mysterious Melody", "Howling Gust", "Sheltering Branches",
        "Blessing of the World Tree", "Elemental Force", "Equilibrium", "Pitaya Dragon Cookie's Scale"
    ]

    elements = [
        "Fire","Water","Ice","Electricity","Earth","Wind","Light","Darkness","Steel","Poison","Grass","Chaos"
    ]

    def normalize_status(name):
    # Replace apostrophes FIRST (important)
        name = name.replace("'", "")

    # Replace spaces with underscores
        name = name.replace(" ", "_")

    # Remove anything that isn't alphanumeric or underscore
        name = re.sub(r"[^A-Za-z0-9_]", "", name)

        return name.strip("_")

    statuses.sort(key=len, reverse=True)

    for status in statuses:

        tag = normalize_status(status)

        for el in elements:
            el_tag = el.lower()

            # Status + Undispellable + Element (FULL case)
            pattern = rf"Status {re.escape(status)}Status Undispellable BuffElement {el}"
            text = re.sub(pattern, f"status{{{tag}|und_buff|{el_tag}}}", text)

            pattern = rf"Status {re.escape(status)}Status Undispellable DebuffElement {el}"
            text = re.sub(pattern, f"status{{{tag}|und_debuff|{el_tag}}}", text)

            # Status + Element ONLY
            pattern = rf"Status {re.escape(status)}Element {el}"
            text = re.sub(pattern, f"status{{{tag}|0|{el_tag}}}", text)

        # Status + Undispellable ONLY
        pattern = rf"Status {re.escape(status)}Status Undispellable Buff"
        text = re.sub(pattern, f"status{{{tag}|und_buff}}", text)

        pattern = rf"Status {re.escape(status)}Status Undispellable Debuff"
        text = re.sub(pattern, f"status{{{tag}|und_debuff}}", text)

        # Plain Status
        pattern = rf"Status {re.escape(status)}"
        text = re.sub(pattern, f"status{{{tag}}}", text)

    return text
# -------- ELEMENTS --------

def convert_elements(text):

    elements = {
        "Steel Element":"steel",
        "Darkness Element":"darkness",
        "Fire Element":"fire",
        "Water Element":"water",
        "Electricity Element":"electricity",
        "Earth Element":"earth",
        "Wind Element":"wind",
        "Poison Element":"poison",
        "Grass Element":"grass",
        "Light Element":"light",
        "Chaos Element":"chaos",
        "Ice Element":"ice",
    }

    for k,v in elements.items():

        text = re.sub(
            rf"{k}\s*([0-9.,]+%)",
            rf"{v}{{\1}}",
            text
        )

    return text


# -------- LINEBREAKS --------

def convert_linebreaks(text):

    lines = [l.strip() for l in text.splitlines() if l.strip()]

    return "<br>".join(lines)


# -------- MAIN --------

def convert(text):

    text = convert_elements(text) 
    text = convert_statuses(text)
    text = convert_linebreaks(text)

    return text


if __name__ == "__main__":

    with open(sys.argv[1], "r", encoding="utf8") as f:
        data = f.read()

    result = convert(data)

    with open("output.txt", "w", encoding="utf8") as f:
        f.write(result)