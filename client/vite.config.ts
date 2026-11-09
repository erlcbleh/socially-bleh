import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,woff2}"],
        globIgnores: ["**/logo-*.png", "**/wordmark-*.png", "**/og-image.png", "**/favicon.png"],
      },
      manifest: {
        name: "Socially",
        short_name: "Socially",
        description:
          "Socially is a community-first social platform - share posts, stories and messages inside the communities you belong to.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#000000",
        theme_color: "#1A4DFF",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  esbuild: {
    drop: ["console", "debugger"],
  },
  build: {
    target: "es2020",
    minify: "esbuild",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("react-icons")) return "vendor-icons";
            if (id.includes("@tanstack") || id.includes("react-query")) return "vendor-query";
            if (id.includes("cropper") || id.includes("canvas-confetti")) return "vendor-media";
            return "vendor-core";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ["lvh.me", "localhost"],
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
      "/auth": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
