import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { git } from "../src/changes";
import { strict, type UserConfig } from "../src";
import { inspect } from "../src/init";

const { values } = parseArgs({
  options: { yes: { type: "boolean", short: "y" }, force: { type: "boolean" } },
});

const root = git(process.cwd(), "rev-parse", "--show-toplevel");
const existing = ["mop.config.mjs", "mop.config.js", "mop.config.json"].find((name) => existsSync(path.join(root, name)));
if (existing && !(values.force && existing.endsWith(".json"))) {
  console.error(`${existing} already exists.${existing.endsWith(".json") ? " Pass --force to replace it." : ""}`);
  process.exit(1);
}

const detected = inspect(root);
const prompt = values.yes ? undefined : createInterface({ input: process.stdin });
// rl.question drops lines that arrive before it asks, so piped answers read from the line iterator instead.
const answers = prompt?.[Symbol.asyncIterator]();

const ask = async (question: string, fallback: string): Promise<string> => {
  if (!answers) return fallback;
  process.stdout.write(`${question} [${fallback}] `);
  const { value } = await answers.next();
  if (!process.stdin.isTTY) process.stdout.write("\n");
  return value?.trim() || fallback;
};
const confirm = async (question: string, fallback: boolean): Promise<boolean> =>
  /^y/i.test(await ask(`${question} (y/n)`, fallback ? "y" : "n"));

const config: UserConfig = {};

if (await confirm(`Lint Tailwind classes?${detected.tailwind ? " (tailwindcss found)" : ""}`, Boolean(detected.tailwind))) {
  const entryPoint = await ask("Tailwind CSS entry point (blank for none)", detected.tailwind?.entryPoint ?? "");
  config.tailwind = entryPoint ? { entryPoint } : {};
}

if (await confirm(`Lint Playwright specs?${detected.playwright ? " (@playwright/test found)" : ""}`, Boolean(detected.playwright))) {
  config.playwright = { dir: await ask("Playwright test directory", detected.playwright?.dir ?? "e2e") };
}

const envHint = detected.envModule ? ` (${detected.envModule} found)` : "";
if (await confirm(`Ban direct process.env reads?${envHint}`, Boolean(detected.envModule))) {
  if (detected.envModule) config.env = { message: `Direct process.env access forbidden. Read config through ${detected.envModule}` };
} else {
  config.env = false;
}

if (await confirm("Allow eslint-disable comments?", strict.inlineConfig)) config.inlineConfig = true;

const params = Number(await ask("Max function params", String(strict.limits.params)));
if (Number.isSafeInteger(params) && params > 0 && params !== strict.limits.params) config.limits = { params };

prompt?.close();

const file = path.join(root, "mop.config.json");
await writeFile(file, `${JSON.stringify(config, undefined, 2)}\n`);
console.log(`Wrote ${path.relative(process.cwd(), file) || file}. Check it with: npx -y slopmop lint --print-config`);
