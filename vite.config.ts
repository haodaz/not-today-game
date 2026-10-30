/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// Aliases: @content -> content/, @state -> src/state/
const contentDir = fileURLToPath(new URL("./content", import.meta.url));
const stateDir = fileURLToPath(new URL("./src/state", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@content": contentDir,
      "@state": stateDir,
    },
  },
  test: {
    // world-state is pure logic; no DOM needed for these specs.
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts", "src/**/*.{test,spec}.ts"],
    passWithNoTests: true,
  },
});
