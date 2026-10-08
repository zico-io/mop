import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", lint: "bin/lint.ts", judge: "bin/judge.ts" },
  platform: "node",
  dts: true,
});
