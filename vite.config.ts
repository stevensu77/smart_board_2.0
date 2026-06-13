import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/smart_board_2.0/",
  plugins: [react()],
});
