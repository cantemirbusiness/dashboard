// Supabase-like gateway: /auth/v1 -> GoTrue, /rest/v1 -> PostgREST, with the
// permissive CORS headers Supabase's API gateway sends.
const http = require("http");
const route = (p) => p.startsWith("/auth/v1") ? { port: 9999, path: p.slice(8) || "/" } : p.startsWith("/rest/v1") ? { port: 3001, path: p.slice(8) || "/" } : null;
const cors = (req) => ({
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": req.headers["access-control-request-headers"] || "*",
  "access-control-max-age": "3600",
});
http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors(req)); return res.end(); }
  const r = route(req.url);
  if (!r) { res.writeHead(404); return res.end("no route"); }
  const up = http.request({ host: "127.0.0.1", port: r.port, path: r.path, method: req.method, headers: { ...req.headers, host: "127.0.0.1:" + r.port } }, (u) => {
    res.writeHead(u.statusCode, { ...u.headers, ...cors(req) }); u.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(54321, "127.0.0.1");
