// Vercel SPA Deployment Configuration
// This configuration builds the TanStack Start app as a static SPA (single-page app)
// Perfect for Vercel deployment with Firebase backend only (no server-side rendering needed)
//
// The @lovable.dev/vite-tanstack-config includes:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// Cloudflare and server-side rendering are explicitly disabled for Vercel SPA mode.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Disable SSR and server entry for Vercel static deployment
  // This builds the app as a pure SPA with all routing handled client-side
  tanstackStart: {
    preloadClientEntry: true,
    isServer: false,
  },
  // Vite configuration for SPA mode
  vite: {
    build: {
      // Generate a single HTML file for SPA
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name].[ext]",
        },
      },
    },
    // Disable SSR mode
    ssr: undefined,
  },
});
