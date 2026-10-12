import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.join(import.meta.dirname, "web", "src") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
  },
});
