from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import socket
import os

os.chdir(Path(__file__).resolve().parent)
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

port = int(os.environ.get('PORT', '5173'))
server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
print(f'桃溪小院: http://127.0.0.1:{port}', flush=True)
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(('192.0.2.1', 80))
    print(f'同一 Wi-Fi 手机访问: http://{s.getsockname()[0]}:{port}', flush=True)
    s.close()
except OSError:
    pass
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
