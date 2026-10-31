/// <reference types="vitest/config" />
import { existsSync } from "node:fs";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// backend FR4: supabase-js is a dependency (package.json). Until `npm install` has fetched it, the
// game (and the tests) resolve it to a stand-in that throws, which the client treats as offline.
const supabaseInstalled = existsSync(fileURLToPath(new URL("./node_modules/@supabase/supabase-js/package.json", import.meta.url)));
const supabaseMissing = fileURLToPath(new URL("./src/net/supabase-missing.ts", import.meta.url));

// Aliases: @content -> content/, @state -> src/state/, @world -> src/world/
const contentDir = fileURLToPath(new URL("./content", import.meta.url));
const stateDir = fileURLToPath(new URL("./src/state", import.meta.url));
const worldDir = fileURLToPath(new URL("./src/world", import.meta.url));
// @kuro -> the function's pure shared modules (backend/kuro-chat specs), also used by the client.
const kuroDir = fileURLToPath(new URL("./supabase/functions/_shared/kuro", import.meta.url));
const netDir = fileURLToPath(new URL("./src/net", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@content": contentDir,
      "@state": stateDir,
      "@world": worldDir,
      "@kuro": kuroDir,
      "@net": netDir,
      ...(supabaseInstalled ? {} : { "@supabase/supabase-js": supabaseMissing }),
    },
  },
  test: {
    // world-state is pure logic; no DOM needed for these specs.
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.ts", "src/**/*.{test,spec}.ts"],
    passWithNoTests: true,
  },
});
