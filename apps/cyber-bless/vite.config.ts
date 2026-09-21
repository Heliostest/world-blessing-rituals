import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prepareAppAssets } from "../../scripts/prepare-app-assets.mjs";
import {
  publishSceneContent,
  contentOutput,
} from "../../scripts/publish-scene-content.mjs";

await prepareAppAssets();

export default defineConfig({
  publicDir: "public",
  define: { "process.env.EXPO_BASE_URL": JSON.stringify("/") },
  plugins: [
    react(),
    {
      name: "local-scene-content",
      async configureServer(server) {
        await publishSceneContent();
        server.middlewares.use("/scene-content", async (req, res, next) => {
          const name = req.url?.split("?")[0]?.replace(/^\//, "");
          if (
            !name ||
            !/^(woodfish\.json|[a-f0-9]{64}\.(glb|wav|mp3|ogg))$/.test(name)
          )
            return next();
          try {
            const bytes = await readFile(path.join(contentOutput, name));
            res.setHeader(
              "Content-Type",
              name.endsWith(".json")
                ? "application/json"
                : "application/octet-stream",
            );
            res.setHeader(
              "Cache-Control",
              name.endsWith(".json")
                ? "no-cache"
                : "public, max-age=31536000, immutable",
            );
            res.end(bytes);
          } catch {
            res.statusCode = 404;
            res.end();
          }
        });
      },
    },
  ],
  server: {
    host: true,
  },
});
