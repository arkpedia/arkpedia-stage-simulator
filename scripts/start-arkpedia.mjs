// SPDX-License-Identifier: GPL-3.0-or-later
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticHandler } from "../server/index.js";
import { readFile } from 'node:fs/promises';
import { createLocalAssets } from './arkpedia-local-assets.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serve = createStaticHandler({
  publicDir: path.join(root, "public"),
  dataDir: path.join(root, "data"),
  sharedDir: path.join(root, "shared"),
});
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3182);
const localAssets = ['127.0.0.1', 'localhost', '::1'].includes(host)
  ? createLocalAssets(path.resolve(root, '../arkpedia-sd-assets')) : null;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/") {
    res.writeHead(302, { Location: "/arkpedia/" });
    res.end();
    return;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  try {
    if (localAssets && url.pathname === '/data/arkpedia-mvp.json' && ['GET', 'HEAD'].includes(req.method)) {
      const source = JSON.parse(await readFile(path.join(root, 'data/arkpedia-mvp.json'), 'utf8'));
      let data = source;
      try { data = await localAssets.snapshot(source); } catch { /* No sibling checkout: retain published URLs. */ }
      const bytes = JSON.stringify(data);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
      return;
    }
    if (localAssets && await localAssets.handle(req, res, url)) return;
  } catch (error) {
    console.error('Local asset unavailable', error.message);
    res.writeHead(500); res.end('Pinned local asset unavailable'); return;
  }
  serve(req, res, url.pathname, url.search.slice(1)).catch((e) => {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end("Could not serve simulator");
  });
});
server.listen(port, host, () =>
  console.log(`Arkpedia stage MVP: http://${host}:${port}/arkpedia/`),
);
