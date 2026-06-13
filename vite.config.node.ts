import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    importProtection: {
      exclude: ["**/src/server/**"],
    },
  },
});
