#!/usr/bin/env python3
"""
Run all Cookie Run: Kingdom (CRK) wiki importers in dependency order.

Order matches a full Kingdom site refresh:
  status_auto → cookie_data → skill_details → illustrations →
  heads → cards → skill_icons → status_icons → candy → toppings → treasures

(Cookie Run: OvenBreak / CRC importers live under crc/tools/ — not included here.)

Usage:
  python crk/tools/import_wiki_all.py
  python crk/tools/import_wiki_all.py --dry-run
  python crk/tools/import_wiki_all.py --name Wind_archer
  python crk/tools/import_wiki_all.py --log crk/tools/import_run_custom.log
  python crk/tools/import_wiki_all.py --only cookie_data skill_details illustrations

When --name is set, global asset importers without per-cookie support are skipped
(status_icons, toppings, treasures). status_auto still runs (feeds skill tag expansion).

Requires: Node.js, Python 3.9+
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Sequence

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOLS = os.path.join(ROOT, "crk", "tools")


@dataclass(frozen=True)
class ImportStep:
    key: str
    script: str
    supports_name: bool = True
    supports_dry_run: bool = True
    skip_when_named: bool = False


STEPS: tuple[ImportStep, ...] = (
    ImportStep("status_auto", os.path.join(TOOLS, "import_wiki_status_auto.py"), supports_name=False),
    ImportStep("cookie_data", os.path.join(TOOLS, "import_wiki_cookie_data.py")),
    ImportStep("skill_details", os.path.join(TOOLS, "import_wiki_skill_details.py")),
    ImportStep("illustrations", os.path.join(TOOLS, "import_wiki_illustrations.py")),
    ImportStep("heads", os.path.join(TOOLS, "import_wiki_heads.py")),
    ImportStep("cards", os.path.join(TOOLS, "import_wiki_cards.py")),
    ImportStep("skill_icons", os.path.join(TOOLS, "import_wiki_skill_icons.py")),
    ImportStep(
        "status_icons",
        os.path.join(TOOLS, "import_wiki_status_icons.py"),
        supports_name=False,
        skip_when_named=True,
    ),
    ImportStep("candy", os.path.join(TOOLS, "import_wiki_candy.py")),
    ImportStep(
        "toppings",
        os.path.join(TOOLS, "import_wiki_toppings.py"),
        supports_name=False,
        skip_when_named=True,
    ),
    ImportStep(
        "treasures",
        os.path.join(TOOLS, "import_wiki_treasures.py"),
        supports_name=False,
        skip_when_named=True,
    ),
)


def _default_log_path() -> str:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return os.path.join(TOOLS, f"import_run_{stamp}.log")


def _build_argv(step: ImportStep, *, dry_run: bool, name: str | None) -> list[str]:
    argv = [sys.executable, step.script]
    if dry_run and step.supports_dry_run:
        argv.append("--dry-run")
    if name and step.supports_name:
        argv.extend(["--name", name])
    return argv


def _write_log(log_fp, text: str) -> None:
    log_fp.write(text)
    if not text.endswith("\n"):
        log_fp.write("\n")
    log_fp.flush()


def _run_step(step: ImportStep, *, dry_run: bool, name: str | None, log_fp) -> int:
    started = datetime.now().astimezone().isoformat()
    header = f"\n===== {step.key} ===== {started}\n"
    print(header, end="")
    _write_log(log_fp, header.rstrip("\n"))

    argv = _build_argv(step, dry_run=dry_run, name=name)
    print(" ".join(argv))
    _write_log(log_fp, " ".join(argv))

    proc = subprocess.run(
        argv,
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    out = proc.stdout or ""
    err = proc.stderr or ""
    if out:
        print(out, end="" if out.endswith("\n") else "\n")
        _write_log(log_fp, out.rstrip("\n"))
    if err:
        print(err, end="" if err.endswith("\n") else "\n", file=sys.stderr)
        _write_log(log_fp, err.rstrip("\n"))

    if proc.returncode == 0:
        ok = f"OK {step.key}\n"
        print(ok, end="")
        _write_log(log_fp, ok.rstrip("\n"))
    else:
        fail = f"FAILED {step.key} (exit {proc.returncode})\n"
        print(fail, end="", file=sys.stderr)
        _write_log(log_fp, fail.rstrip("\n"))
    return proc.returncode


def _select_steps(
    *,
    only: Sequence[str] | None,
    name: str | None,
) -> list[ImportStep]:
    selected = list(STEPS)
    if only:
        allowed = {k.strip().lower() for k in only if k.strip()}
        known = {s.key for s in STEPS}
        unknown = sorted(allowed - known)
        if unknown:
            raise SystemExit(f"Unknown --only step(s): {', '.join(unknown)}\nKnown: {', '.join(sorted(known))}")
        selected = [s for s in selected if s.key in allowed]
    if name:
        selected = [s for s in selected if not s.skip_when_named]
    return selected


def main() -> int:
    ap = argparse.ArgumentParser(description="Run all Cookie Run: Kingdom wiki importers")
    ap.add_argument("--dry-run", action="store_true", help="Pass --dry-run to each supported importer")
    ap.add_argument("--name", help="Only this crk/cookie-data.js cookie name")
    ap.add_argument("--log", help=f"Log file path (default: crk/tools/import_run_<timestamp>.log)")
    ap.add_argument(
        "--only",
        nargs="+",
        metavar="STEP",
        help="Run only these steps (e.g. cookie_data skill_details). Keys: "
        + ", ".join(s.key for s in STEPS),
    )
    ap.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Keep running later steps after a failure (default: stop on first failure)",
    )
    args = ap.parse_args()

    try:
        steps = _select_steps(only=args.only, name=args.name)
    except SystemExit as exc:
        print(exc, file=sys.stderr)
        return 2

    log_path = os.path.abspath(args.log or _default_log_path())
    os.makedirs(os.path.dirname(log_path), exist_ok=True)

    started = datetime.now().astimezone().isoformat()
    banner = f"Import run started {started}\n"
    print(banner, end="")
    print(f"Log: {log_path}")
    if args.name:
        print(f"Cookie: {args.name}")
    if args.dry_run:
        print("Mode: dry-run")

    failures: list[str] = []
    with open(log_path, "w", encoding="utf-8", newline="\n") as log_fp:
        _write_log(log_fp, banner.rstrip("\n"))
        for step in steps:
            code = _run_step(step, dry_run=args.dry_run, name=args.name, log_fp=log_fp)
            if code != 0:
                failures.append(step.key)
                if not args.continue_on_error:
                    break

    finished = datetime.now().astimezone().isoformat()
    summary = f"\nImport run finished {finished}"
    if failures:
        summary += f"\nFailed: {', '.join(failures)}"
        print(summary, file=sys.stderr)
    else:
        summary += "\nAll steps OK"
        print(summary)
    with open(log_path, "a", encoding="utf-8", newline="\n") as log_fp:
        _write_log(log_fp, summary)

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
