from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

from grid_backend import health_payload, model_benchmark, optimize_fuel_dispatch


class Handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict) -> None:
        body = json.dumps(payload, indent=2).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/health":
            self.send_json(health_payload())
        elif path == "/model-benchmark":
            self.send_json(model_benchmark())
        elif path == "/fuel-optimization":
            self.send_json(optimize_fuel_dispatch(7000, 2500, 600))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt: str, *args) -> None:
        print(f"[backend] {fmt % args}")


if __name__ == "__main__":
    print("Grid Sentinel backend verification server")
    print("GET /health | /model-benchmark | /fuel-optimization")
    HTTPServer(("0.0.0.0", 8010), Handler).serve_forever()
