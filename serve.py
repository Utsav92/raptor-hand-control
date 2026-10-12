from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm':'application/wasm', '.mjs':'text/javascript', '.task':'application/octet-stream'}
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def do_GET(self):
        if self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()
    def end_headers(self):
        self.send_header('Permissions-Policy', 'camera=(self), microphone=()')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 54821), Handler)
print('Raptor hand control: http://localhost:54821/', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
