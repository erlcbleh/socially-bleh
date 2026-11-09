import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    allowedHosts: ["staff.lvh.me", "lvh.me", "localhost"],
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: false,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: false,
        ws: true,
      },
    },
  },
});
