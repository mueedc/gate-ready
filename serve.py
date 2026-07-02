#!/usr/bin/env python3
"""Static dev server that disables HTTP caching.

The stock `python3 -m http.server` sends no Cache-Control headers, so browsers
heuristically cache JS/CSS and can run a stale app against fresh HTML.
"""
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8123


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    print(f"Serving {ROOT} at http://localhost:{PORT} (caching disabled)")
    HTTPServer(("", PORT), NoCacheHandler).serve_forever()
