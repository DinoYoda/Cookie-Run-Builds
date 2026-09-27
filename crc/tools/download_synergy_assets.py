"""Download synergy badge assets from cookieruncrumbles.com (reference layout)."""
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://www.cookieruncrumbles.com/images"
SYN_DIR = os.path.join(ROOT, "pictures", "synergies")
BADGE_DIR = os.path.join(ROOT, "pictures", "synergy-badges")

SYNERGY_FILES = [
    "area-of-effect.webp",
    "chain.webp",
    "duration.webp",
    "multishot.webp",
    "multistrike.webp",
    "pierce.webp",
    "projectile-speed.webp",
]
BADGE_FILES = ["receive-arrow.webp", "send-arrow.webp"]


def fetch(url: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=30).read()
    with open(dest, "wb") as f:
        f.write(data)
    print("saved", dest, len(data), "bytes")


def main() -> None:
    for name in SYNERGY_FILES:
        fetch(f"{BASE}/synergies/{name}", os.path.join(SYN_DIR, name))
    for name in BADGE_FILES:
        fetch(f"{BASE}/synergy-badges/{name}", os.path.join(BADGE_DIR, name))


if __name__ == "__main__":
    main()
