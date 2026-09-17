#!/usr/bin/env node
/* serve.mjs — the dashboard opens fine by double-clicking index.html, but serving
 * it over http keeps devtools and hard-refresh behaving normally.
 *
 *   node serve.mjs          -> http://localhost:8066
 *   node serve.mjs 9000
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const PORT = Number(process.argv[2]) || 8066;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, rel === "/" ? "index.html" : rel);

  /* stay inside the repo */
  if (!path.resolve(file).startsWith(path.resolve(ROOT))) {
    res.writeHead(403).end("forbidden");
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-store"
    }).end(buf);
  });
}).listen(PORT, () => {
  console.log(`\n  Series 66 dashboard -> http://localhost:${PORT}\n  Ctrl-C to stop.\n`);
});
