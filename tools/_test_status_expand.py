import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from import_wiki_skill_details import (  # noqa: E402
    expand_wiki_skill_fragment,
    _load_treasure_map,
    _load_kch_map,
)
from wiki_expand_status import expand_wiki_status_templates  # noqa: E402

tmap, kmap = _load_treasure_map(), _load_kch_map()
samples = [
    "{{Status|Berserker's Fury}}",
    "{{Status | Berserker's Fury}}",
    "{{status|Berserker's Fury}}",
    "{{Status|Weakness|link=true}}",
    "{{Status|Weakness|element=all}}",
    "{{Status|ATK Up|element=Fire}}",
    "{{Status|Immunity|nodispel=buff}}",
    "{{Status|DMG Down|width=30|icononly=true}}",
    "{{Status|Custom Name|Shown label|link=true}}",
]
for s in samples:
    print("raw:", repr(s))
    print(" expand_wiki_status_templates:", repr(expand_wiki_status_templates(s)))
    print(" full fragment:", repr(expand_wiki_skill_fragment(s, "purple_yam", tmap, kmap)))
    print()
