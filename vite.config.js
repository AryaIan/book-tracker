import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // If you deploy to GitHub Pages at https://<user>.github.io/reading-ledger/,
  // uncomment the line below (must match your repo name):
  // base: "/reading-ledger/",
});
