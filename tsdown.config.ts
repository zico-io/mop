import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", slopmop: "bin/slopmop.ts" },
  platform: "node",
  dts: true,
  define: {
    __SLOPMOP_OTLP__: JSON.stringify({
      endpoint: process.env.SLOPMOP_OTLP_ENDPOINT ?? "",
      headers: process.env.SLOPMOP_OTLP_HEADERS ?? "",
      protocol: process.env.SLOPMOP_OTLP_PROTOCOL ?? "",
    }),
  },
});
