import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    proxy: {
      "/mail-api": {
        target: "http://127.0.0.1:4190",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mail-api/, ""),
      },
    },
  },
});
