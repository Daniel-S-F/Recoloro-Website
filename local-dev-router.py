"""Loopback-only router for the local Recoloro website and backoffice."""

from __future__ import annotations

import argparse
import http.client
import socket
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ROUTES = {
    "recoloro.local": ("127.0.0.1", 4173),
    "bo.recoloro.local": ("127.0.0.1", 8000),
}
HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


class LocalRouter(BaseHTTPRequestHandler):
    server_version = "RecoloroLocalRouter/1.0"

    def route(self) -> tuple[str, int] | None:
        host = self.headers.get("Host", "").split(":", 1)[0].lower()
        return ROUTES.get(host)

    def forward(self) -> None:
        if self.client_address[0] not in {"127.0.0.1", "::1"}:
            self.send_error(HTTPStatus.FORBIDDEN, "Nur lokaler Zugriff ist erlaubt.")
            return

        destination = self.route()
        if destination is None:
            self.send_error(HTTPStatus.NOT_FOUND, "Lokale Recoloro-Adresse unbekannt.")
            return

        length = int(self.headers.get("Content-Length", "0") or 0)
        body = self.rfile.read(length) if length else None
        headers = {
            name: value
            for name, value in self.headers.items()
            if name.lower() not in HOP_BY_HOP_HEADERS
        }
        headers["Host"] = self.headers.get("Host", "")
        headers["X-Forwarded-For"] = self.client_address[0]
        headers["X-Forwarded-Proto"] = "http"

        try:
            connection = http.client.HTTPConnection(*destination, timeout=30)
            connection.request(self.command, self.path, body=body, headers=headers)
            response = connection.getresponse()
            self.send_response(response.status, response.reason)
            for name, value in response.getheaders():
                if name.lower() not in HOP_BY_HOP_HEADERS:
                    self.send_header(name, value)
            self.end_headers()
            while chunk := response.read(64 * 1024):
                self.wfile.write(chunk)
            connection.close()
        except OSError as error:
            self.send_error(HTTPStatus.BAD_GATEWAY, f"Lokaler Dienst nicht erreichbar: {error}")

    do_GET = forward
    do_POST = forward
    do_PUT = forward
    do_PATCH = forward
    do_DELETE = forward
    do_HEAD = forward
    do_OPTIONS = forward


class IPv6ThreadingHTTPServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=80)
    arguments = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", arguments.port), LocalRouter)
    ipv6_server = IPv6ThreadingHTTPServer(("::1", arguments.port), LocalRouter)
    threading.Thread(target=ipv6_server.serve_forever, daemon=True).start()
    print(f"Recoloro Local Router: http://recoloro.local/ und http://bo.recoloro.local/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
