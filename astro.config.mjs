// @ts-check
import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";

// Static site (no adapter): `astro build` emits to dist/, which Netlify publishes.
// Tailwind v4 is wired CSS-first through its Vite plugin — no tailwind.config.js.
// Preact is the interactive island framework (epic decision, #19).
export default defineConfig({
  site: "https://obs-layouts.netlify.app",
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
  },
});
