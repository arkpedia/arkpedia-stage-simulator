// SPDX-License-Identifier: GPL-3.0-or-later
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticHandler } from "../server/index.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serve = createStaticHandler({
  publicDir: path.join(root, "public"),
  dataDir: path.join(root, "data"),
  sharedDir: path.join(root, "shared"),
});
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3182);
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/") {
    res.writeHead(302, { Location: "/arkpedia/" });
    res.end();
    return;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  serve(req, res, url.pathname, url.search.slice(1)).catch((e) => {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end("Could not serve simulator");
  });
});
server.listen(port, host, () =>
  console.log(`Arkpedia stage MVP: http://${host}:${port}/arkpedia/`),
);
