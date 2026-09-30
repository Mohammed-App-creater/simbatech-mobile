/*
 * Browser preview of the app (react-native-web) with a working session.
 *
 * The API keeps the session in a cookie, which a browser only sends to its own origin. This small
 * proxy puts the Expo dev server and the API behind one origin:
 *
 *   npx expo start            (in another terminal; Metro on :8081)
 *   node scripts/web-preview.mjs
 *   open http://localhost:8100
 *
 * API=<url> chooses the backend (default: the live site, which proxies /api to the Django API).
 * For a local API:  API=http://localhost:8000 node scripts/web-preview.mjs
 */
import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.PORT || 8100);
const METRO = new URL(process.env.METRO || "http://localhost:8081");
const API = new URL(process.env.API || "https://simbatech-e-commerce.vercel.app");

http
  .createServer((req, res) => {
    const toApi = req.url.startsWith("/api/");
    const target = toApi ? API : METRO;
    const lib = target.protocol === "https:" ? https : http;
    const headers = { ...req.headers, host: target.host };
    if (toApi) {
      // look like a same-site request to Django's CSRF check
      headers.origin = API.origin;
      headers.referer = API.origin + "/";
    }
    const upstream = lib.request({ protocol: target.protocol, hostname: target.hostname, port: target.port || (target.protocol === "https:" ? 443 : 80), method: req.method, path: req.url, headers }, (up) => {
      const out = { ...up.headers };
      if (out["set-cookie"]) {
        // cookies must be accepted on http://localhost
        out["set-cookie"] = out["set-cookie"].map((c) => c.replace(/;\s*Secure/gi, "").replace(/;\s*Domain=[^;]+/gi, ""));
      }
      res.writeHead(up.statusCode || 502, out);
      up.pipe(res);
    });
    upstream.on("error", (e) => {
      if (res.headersSent) return res.destroy();
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Preview proxy could not reach " + target.origin + ": " + e.message }));
    });
    req.on("error", () => upstream.destroy());
    res.on("error", () => upstream.destroy());
    req.pipe(upstream);
  })
  .on("clientError", (_e, socket) => socket.destroy())
  .listen(PORT, () => console.log(`Simbatech preview on http://localhost:${PORT}  (app: ${METRO.origin}, api: ${API.origin})`));

// keep serving if one connection misbehaves
process.on("uncaughtException", (e) => console.error("preview proxy:", e.message));
