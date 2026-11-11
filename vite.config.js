import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        licenses: fileURLToPath(new URL("./licenses.html", import.meta.url)),
      },
    },
  },
});
