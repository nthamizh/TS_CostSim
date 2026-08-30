import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "costsim",
      filename: "remoteEntry.js",
      exposes: {
        "./App":    "./src/bootstrap.tsx",
        "./routes": "./src/routes.ts",
      },
      shared: {
        react:          { singleton: true, requiredVersion: "^19.0.0" },
        "react-dom":    { singleton: true, requiredVersion: "^19.0.0" },
        "react-router": { singleton: true, requiredVersion: "^7.1.1" },
      },
    }),
  ],
  build: {
    modulePreload: false,
    target:        "esnext",
    minify:        false,
    cssCodeSplit:  false,
    outDir:        "dist",
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  server: { port: 5175, strictPort: true },
});
