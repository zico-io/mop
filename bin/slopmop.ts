#!/usr/bin/env node
import process from "node:process";

const USAGE = `Usage: slopmop <command> [options]

Commands:
  init     Inspect the repo and write a mop.config.json, asking before each choice
  lint     Lint the lines a branch added and sort findings into fix, leave and review
  judge    Ask Jev whether each finding should be fixed`;

// Each command parses process.argv itself, so drop the command name before loading it.
const [command] = process.argv.splice(2, 1);

if (command === "init") await import("./init");
else if (command === "lint") await import("./lint");
else if (command === "judge") await import("./judge");
else if (command === undefined || command === "--help" || command === "-h") console.log(USAGE);
else {
  console.error(`Unknown command: ${command}\n\n${USAGE}`);
  process.exitCode = 2;
}
