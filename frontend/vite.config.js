import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the API runs separately on :8000. In production the built
// files are served by the same origin as the API, so relative /api URLs work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.VITE_API_PROXY || "http://localhost:8000",
    },
  },
});
