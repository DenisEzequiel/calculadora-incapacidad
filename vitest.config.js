import { defineConfig } from "vitest/config";

// Los tests se escriben en CommonJS, igual que el resto del repo (no hay
// bundler ni `type: module`). Con `globals` se usan describe/it/expect sin
// importarlos, que es lo que permite mantener los archivos en CJS.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
