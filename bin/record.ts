import { parseArgs } from "node:util";
import { record, runContext } from "../src/telemetry";

const OUTCOMES = new Set(["done", "failed"]);

const { values } = parseArgs({
  options: {
    mop: { type: "string" },
    run: { type: "string" },
    outcome: { type: "string", default: "done" },
    fixed: { type: "string", default: "0" },
    left: { type: "string", default: "0" },
    human: { type: "string", default: "0" },
  },
});

const counts = { fixed: Number(values.fixed), left: Number(values.left), human: Number(values.human) };
const invalid = Object.entries(counts).find(([, count]) => !Number.isInteger(count) || count < 0);

if (!values.mop) {
  console.error("Usage: slopmop record --mop <name> [--run <id>] [--outcome done|failed] [--fixed N] [--left N] [--human N]");
  process.exit(2);
}
if (!OUTCOMES.has(values.outcome)) {
  console.error(`--outcome must be done or failed, not ${values.outcome}`);
  process.exit(2);
}
if (invalid) {
  console.error(`--${invalid[0]} must be a whole number`);
  process.exit(2);
}

const file = record({ event: "record", ...runContext(process.cwd(), values.run), mop: values.mop, outcome: values.outcome, ...counts });
console.log(file ? `recorded in ${file}` : "telemetry is off");
