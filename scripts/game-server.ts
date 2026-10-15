import {createServer} from "vite";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../apps/game/",import.meta.url));
const publicDir=fileURLToPath(new URL("../public/",import.meta.url));
const server=await createServer({configFile:false,root,publicDir,server:{host:"127.0.0.1",port:5174,strictPort:true}});
await server.listen();server.printUrls();
