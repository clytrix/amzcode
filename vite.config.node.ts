import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    importProtection: {
      client: {
        excludeFiles: ["**/src/server/**"],
      },
    },
  },
});
