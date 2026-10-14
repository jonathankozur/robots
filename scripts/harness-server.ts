import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { logMiddleware } from "../tests/browser/log-server.ts";
const root = fileURLToPath(new URL("../tests/browser/", import.meta.url));
const logs = fileURLToPath(new URL("../debug-logs/", import.meta.url));
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const server = await createServer({ configFile: false, root, publicDir, server: { host: "127.0.0.1", port: 5173, strictPort: true },
  plugins: [{ name: "robots-development-log", configureServer(server) { server.middlewares.use(logMiddleware(logs)); } }] });
await server.listen(); server.printUrls();
console.log("Debug JSONL directory: " + logs);
