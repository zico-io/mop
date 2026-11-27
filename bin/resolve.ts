import { parseArgs } from "node:util";
import { record, runContext, type Resolution } from "../src/telemetry";

const USAGE = "Usage: slopmop resolve --run <id> [--mop <name>] [--by human|mop] <finding-id>=<fixed|left> ...";
const RESOLUTIONS = new Set<string>(["fixed", "left"]);
const BY = new Set(["human", "mop"]);
const ID = /^[\da-f]{16}$/;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { run: { type: "string" }, mop: { type: "string" }, by: { type: "string", default: "human" } },
});

if (!values.run || positionals.length === 0) {
  console.error(USAGE);
  process.exit(2);
}

const parse = (pair: string): { id: string; resolution: Resolution } | undefined => {
  const [id = "", resolution = "", ...rest] = pair.split("=");
  return ID.test(id) && RESOLUTIONS.has(resolution) && rest.length === 0 ? { id, resolution: resolution as Resolution } : undefined;
};
if (!BY.has(values.by)) {
  console.error(`--by must be human or mop, not ${values.by}`);
  process.exit(2);
}
const invalid = positionals.find((pair) => !parse(pair));
if (invalid) {
  console.error(`expected <finding-id>=fixed or <finding-id>=left, with a 16-character id from lint or judge, not ${invalid}`);
  process.exit(2);
}

const resolutions = positionals.flatMap((pair) => parse(pair) ?? []);
const file = record({ event: "resolve", ...runContext(process.cwd(), values.run), mop: values.mop, by: values.by, resolutions });
console.log(file ? `recorded ${resolutions.length} resolutions in ${file}` : "telemetry is off");
