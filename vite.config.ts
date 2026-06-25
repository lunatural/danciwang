import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api/translate": {
        target: "https://fanyi.baidu.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/translate/, "/sug"),
        headers: {
          "Referer": "https://fanyi.baidu.com/",
        },
      },
    },
  },
});
