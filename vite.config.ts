import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "images/*",
        "fonts/*",
        "manuals/*",
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
      ],
      manifest: {
        name: "My Garage",
        short_name: "My Garage",
        description: "Your personal Mazda companion",
        theme_color: "#090b0e",
        background_color: "#090b0e",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpeg,ttf,pdf,woff2,mjs}"],
        maximumFileSizeToCacheInBytes: 8000000,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173 },
  build: { target: "es2022", chunkSizeWarningLimit: 1100 },
});
