"""RECOLORO local pilot server: static files plus a loopback-only save endpoint."""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import os
import re
import tempfile
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
MAX_REQUEST_BYTES = 24 * 1024 * 1024
CONFIG_PATHS = {"image-config.js", "image-editor-config.js"}
IMAGE_PATH = re.compile(
    r"assets/images/bildpaare/[a-z0-9-]+-hero-(?:desktop|mobile)-(?:vor|nach)\.webp"
)
ALLOWED_ORIGINS = {
    "http://127.0.0.1:4173",
    "http://localhost:4173",
}


def json_bytes(payload: object) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def validated_target(relative_path: str) -> Path:
    normalized = relative_path.replace("\\", "/")
    if normalized not in CONFIG_PATHS and not IMAGE_PATH.fullmatch(normalized):
        raise ValueError(f"Pfad ist für die lokale Übernahme nicht freigegeben: {relative_path}")
    target = (ROOT / normalized).resolve()
    target.relative_to(ROOT)
    if not target.parent.is_dir():
        raise ValueError(f"Zielordner fehlt: {target.parent.name}")
    return target


def decoded_file(entry: dict) -> tuple[Path, bytes]:
    relative_path = str(entry.get("path", ""))
    target = validated_target(relative_path)
    encoding = entry.get("encoding")
    content = entry.get("content")
    if encoding == "base64":
        try:
            data = base64.b64decode(str(content), validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError(f"Ungültige Binärdaten für {relative_path}") from error
        if not data.startswith(b"RIFF") or data[8:12] != b"WEBP":
            raise ValueError(f"{relative_path} ist keine gültige WebP-Datei")
    elif encoding == "utf8":
        data = str(content).encode("utf-8")
        required_name = (
            "RECOLORO_IMAGE_EDITOR_CONFIG"
            if relative_path == "image-editor-config.js"
            else "RECOLORO_IMAGE_CONFIG"
        )
        if required_name not in str(content):
            raise ValueError(f"{relative_path} enthält nicht die erwartete Konfiguration")
    else:
        raise ValueError(f"Unbekannte Kodierung für {relative_path}")
    if not data or len(data) > 12 * 1024 * 1024:
        raise ValueError(f"Unzulässige Dateigrösse für {relative_path}")
    return target, data


def atomic_write(target: Path, data: bytes) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        dir=target.parent, prefix=".recoloro-save-", suffix=".tmp"
    )
    try:
        with os.fdopen(descriptor, "wb") as temporary:
            temporary.write(data)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_name, target)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


class RecoloroHandler(SimpleHTTPRequestHandler):
    server_version = "RecoloroPilot/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        if self.path.endswith((".html", ".js")) or self.path.startswith("/__recoloro/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status: HTTPStatus, payload: object) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if urlparse(self.path).path == "/__recoloro/health":
            self.send_json(
                HTTPStatus.OK,
                {"ok": True, "directSave": True, "root": ROOT.name},
            )
            return
        super().do_GET()

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/__recoloro/save":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if self.client_address[0] not in {"127.0.0.1", "::1"}:
            self.send_json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Nur lokaler Zugriff ist erlaubt."})
            return
        origin = self.headers.get("Origin")
        if origin and origin not in ALLOWED_ORIGINS:
            self.send_json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Unzulässiger Ursprung."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_REQUEST_BYTES:
            self.send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"ok": False, "error": "Unzulässige Übertragungsgrösse."})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            entries = payload.get("files")
            if not isinstance(entries, list) or not 1 <= len(entries) <= 10:
                raise ValueError("Dateiliste fehlt oder ist zu gross")
            decoded = [decoded_file(entry) for entry in entries]
            targets = [target for target, _ in decoded]
            if len(set(targets)) != len(targets):
                raise ValueError("Ein Zielpfad wurde mehrfach übermittelt")
            if not CONFIG_PATHS.issubset({target.relative_to(ROOT).as_posix() for target in targets}):
                raise ValueError("Öffentliche und interne Konfiguration müssen gemeinsam gespeichert werden")

            backups = {target: target.read_bytes() if target.exists() else None for target in targets}
            committed: list[Path] = []
            order = sorted(
                decoded,
                key=lambda item: (
                    item[0].name == "image-config.js",
                    item[0].name == "image-editor-config.js",
                ),
            )
            try:
                for target, data in order:
                    atomic_write(target, data)
                    committed.append(target)
            except Exception:
                for target in reversed(committed):
                    original = backups[target]
                    if original is None:
                        target.unlink(missing_ok=True)
                    else:
                        atomic_write(target, original)
                raise

            self.send_json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "saved": [target.relative_to(ROOT).as_posix() for target in targets],
                },
            )
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(error)})
        except Exception as error:  # pragma: no cover - last-resort server response
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": f"Speichern fehlgeschlagen: {error}"})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4173)
    arguments = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", arguments.port), RecoloroHandler)
    print(f"RECOLORO Pilotserver: http://127.0.0.1:{arguments.port}/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
