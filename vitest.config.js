import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", // le moteur de cotation est pur : pas besoin de DOM
    include: ["tests/**/*.test.js"]
  }
});
