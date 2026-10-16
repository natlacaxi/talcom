#!/usr/bin/env python3
"""Back-end minimal : sert le front et relaie l'API PRIM (Île-de-France Mobilités).

La clé reste côté serveur (variable d'environnement), jamais dans le navigateur.
Lancement :  PRIM_API_KEY=xxxxx python3 server.py   puis  http://localhost:8000
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PRIM_BASE = "https://prim.iledefrance-mobilites.fr/marketplace"
PRIM_KEY = os.environ.get("PRIM_API_KEY", "")
PORT = int(os.environ.get("PORT", "8000"))


class Handler(SimpleHTTPRequestHandler):
    # Le manifeste de l'appli installable doit être servi avec le bon type MIME
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".js": "text/javascript",
    }

    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)

        if url.path == "/api/health":
            return self._json(200, {"ok": True, "prim_key": bool(PRIM_KEY)})

        if url.path == "/api/prochains":
            stop = urllib.parse.parse_qs(url.query).get("stop", [""])[0]
            if not stop:
                return self._json(400, {"error": "paramètre 'stop' manquant"})
            if not PRIM_KEY:
                return self._json(500, {"error": "PRIM_API_KEY non définie"})

            query = urllib.parse.urlencode({"MonitoringRef": stop})
            req = urllib.request.Request(
                f"{PRIM_BASE}/stop-monitoring?{query}",
                headers={"apikey": PRIM_KEY, "Accept": "application/json"},
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    return self._json(200, json.load(resp))
            except urllib.error.HTTPError as err:
                # 401 = clé refusée : vérifier la clé et l'en-tête « apikey »
                return self._json(err.code, {"error": f"PRIM HTTP {err.code}"})
            except Exception as err:  # réseau, timeout, JSON invalide
                return self._json(502, {"error": str(err)})

        return super().do_GET()  # fichiers statiques (index.html...)


if __name__ == "__main__":
    print(f"Serveur sur http://localhost:{PORT}  (clé PRIM : {'oui' if PRIM_KEY else 'non'})")
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
