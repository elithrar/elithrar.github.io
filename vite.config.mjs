import { defineConfig } from "vite"
// Serve the real Jekyll build during visual review, including canonical routes.
export default defineConfig({
  root: "_site",
  server: { host: "0.0.0.0", port: 4173, strictPort: true, allowedHosts: ["terminal.local"] },
})
