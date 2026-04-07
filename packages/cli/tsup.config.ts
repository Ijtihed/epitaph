import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ["src/bin/epitaph.ts"],
    format: ["esm"],
    sourcemap: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
