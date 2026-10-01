import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  server: {
    cors: true,
    port: 11207,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        background: resolve(__dirname, "background.html"),
        viewer: resolve(__dirname, "viewer.html"),
        settings: resolve(__dirname, "settings.html"),
        preview: resolve(__dirname, "preview.html"),
      },
    },
  },
});
