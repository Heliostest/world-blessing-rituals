import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  publicDir: "../../assets",
  define: { "process.env.EXPO_BASE_URL": JSON.stringify("/") },
  plugins: [react()],
  server: {
    host: true,
  },
});
