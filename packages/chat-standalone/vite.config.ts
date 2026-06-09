import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@agent-chat-platform\/chat-ui$/u,
        replacement: fileURLToPath(new URL("../chat-ui/src/index.tsx", import.meta.url))
      },
      {
        find: /^@agent-chat-platform\/chat-ui\/styles\.css$/u,
        replacement: fileURLToPath(new URL("../chat-ui/src/styles.css", import.meta.url))
      }
    ]
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
