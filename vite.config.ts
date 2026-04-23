import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const optionsEntry = fileURLToPath(new URL("./options.html", import.meta.url));
const sidePanelEntry = fileURLToPath(new URL("./sidepanel.html", import.meta.url));

export default defineConfig({
  appType: "mpa",
  plugins: [react()],
  publicDir: "public",
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        options: optionsEntry,
        sidepanel: sidePanelEntry,
      },
    },
  },
});
