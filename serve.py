#!/usr/bin/env python3
"""Dev server that honours Range requests.

`python -m http.server` does not: it answers every Range with a plain 200 and
the whole file. Chrome reads that as "not seekable", so the scroll-scrubbed
disassembly in section 2 sits frozen on frame 0 and the page silently falls
back to the PNG crossfade. Nothing logs, nothing 404s -- it just does not move.

ponytail: ~20 lines of stdlib beats a dependency, and the one byte-range case
the <video> actually asks for is "bytes=N-" or "bytes=N-M". Multipart ranges
are not implemented; no browser asks a static host for one.
"""
import http.server, os, re, sys

class H(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        rng = self.headers.get("Range")
        m = rng and re.fullmatch(r"bytes=(\d*)-(\d*)", rng.strip())
        if not m:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404)
            return None

        size = os.fstat(f.fileno()).st_size
        start, end = m.group(1), m.group(2)
        if start == "":                      # suffix range: last N bytes
            start, end = max(0, size - int(end)), size - 1
        else:
            start = int(start)
            end = int(end) if end else size - 1
        end = min(end, size - 1)
        if start > end or start >= size:
            f.close()
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return None

        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        return _Slice(f, end - start + 1)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")   # dev: always fresh
        super().end_headers()

class _Slice:
    """File-like that stops after n bytes, so copyfile sends just the range."""
    def __init__(self, f, n): self.f, self.n = f, n
    def read(self, size=-1):
        if self.n <= 0: return b""
        if size is None or size < 0: size = self.n
        d = self.f.read(min(size, self.n)); self.n -= len(d); return d
    def close(self): self.f.close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    print("serving %s on http://127.0.0.1:%d/" % (os.getcwd(), port))
    http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
