"""Client for the installed Blender MCP add-on's local command bridge.

Use when the desktop's already-started tool registry has not refreshed.
python scripts/blender/bridge.py script.py [script arguments...]
"""
import json
from pathlib import Path
import socket
import sys

if len(sys.argv) > 1:
    script = Path(sys.argv[1]).resolve()
    namespace = {"__name__": "__main__", "__file__": str(script)}
    code = f"import sys\nsys.argv = {sys.argv[1:]!r}\nexec(compile({script.read_text(encoding='utf-8')!r}, {str(script)!r}, 'exec'), {namespace!r})"
    request = {"type": "execute_code", "params": {"code": code}}
else:
    request = {"type": "ping", "params": {}}
with socket.create_connection(("127.0.0.1", 9876), timeout=15) as client:
    client.settimeout(1800)
    client.sendall(json.dumps(request).encode())
    response = b""
    while True:
        chunk = client.recv(65536)
        if not chunk:
            raise RuntimeError("Blender closed the connection before replying")
        response += chunk
        try:
            result = json.loads(response)
            break
        except json.JSONDecodeError:
            continue
    print(json.dumps(result, ensure_ascii=True))
    if result.get("status") != "success":
        sys.exit(1)
