#!/usr/bin/env python3
"""
Local dev server for the tierlist site.

Serves the repo root and appends feedback POSTs to tools/tier-feedback-submissions.json.

Usage (from repo root):
    python tools/tier_feedback_server.py

Then open http://127.0.0.1:8765/tierlist.html
"""
from __future__ import annotations

import json
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
SUBMISSIONS_PATH = ROOT / "tools" / "tier-feedback-submissions.json"
API_PATH = "/api/tier-feedback"
HOST = "127.0.0.1"
PORT = 8765


def load_submissions() -> list:
    if not SUBMISSIONS_PATH.is_file():
        return []
    try:
        data = json.loads(SUBMISSIONS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def save_submissions(items: list) -> None:
    SUBMISSIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SUBMISSIONS_PATH.write_text(
        json.dumps(items, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


class TierFeedbackHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print(f"[tier-feedback-server] {self.address_string()} - {fmt % args}")

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        if urlparse(self.path).path == API_PATH:
            self.send_response(204)
            self.end_headers()
            return
        self.send_error(404)

    def do_GET(self):
        if urlparse(self.path).path == API_PATH:
            body = json.dumps({"submissions": load_submissions()}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != API_PATH:
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        if not isinstance(payload, dict):
            self.send_error(400, "Expected JSON object")
            return

        payload = dict(payload)
        payload.setdefault("id", str(uuid.uuid4()))

        items = load_submissions()
        items.append(payload)
        save_submissions(items)

        body = json.dumps({"ok": True, "id": payload["id"]}, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    server = ThreadingHTTPServer((HOST, PORT), TierFeedbackHandler)
    print(f"Serving {ROOT}")
    print(f"Tierlist:  http://{HOST}:{PORT}/tierlist.html")
    print(f"Review:    http://{HOST}:{PORT}/crk/tier-feedback-review.html")
    print(f"Storage:   {SUBMISSIONS_PATH}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


if __name__ == "__main__":
    main()
