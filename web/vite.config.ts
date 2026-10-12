import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webDir = import.meta.dirname;
const pocketbaseUrl = process.env.PB_DEV_URL ?? "http://127.0.0.1:8090";

export default defineConfig({
  root: webDir,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.join(webDir, "src") },
  },
  build: {
    outDir: path.join(webDir, "..", "dist"),
    emptyOutDir: true,
  },
  server: {
    // In production PocketBase serves the app, so the API is same-origin.
    // Proxying in dev keeps it that way: no CORS, no API URL to configure.
    proxy: {
      "/api": { target: pocketbaseUrl, changeOrigin: true },
      "/_": { target: pocketbaseUrl, changeOrigin: true },
    },
  },
});
