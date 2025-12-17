import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Pointage RH",
        short_name: "Pointage",
        start_url: "/",
        display: "standalone",
        theme_color: "#4f46e5",
        background_color: "#ffffff"
      }
    })
  ]
});
