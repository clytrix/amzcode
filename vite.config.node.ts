import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineConfig({
  nitro: false,
  plugins: [nitro()],
  tanstackStart: {
    importProtection: {
      client: {
        excludeFiles: ["**/src/server/**"],
      },
    },
  },
});
