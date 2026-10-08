import { readFileSync, writeFileSync } from "node:fs";

// The plugin and the npm package release together, so the plugin manifests carry the package version.
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
for (const file of ["plugins/mop/.claude-plugin/plugin.json", ".claude-plugin/marketplace.json"]) {
  const text = readFileSync(file, "utf8");
  writeFileSync(file, text.replace(/"version": "[^"]*"/, `"version": "${version}"`));
}
