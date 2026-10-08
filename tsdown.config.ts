import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", "mop-lint": "bin/mop-lint.ts", "mop-judge": "bin/mop-judge.ts" },
  platform: "node",
  dts: true,
});
