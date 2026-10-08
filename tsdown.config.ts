import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", slopmop: "bin/slopmop.ts" },
  platform: "node",
  dts: true,
});
