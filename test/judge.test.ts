import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { decisionsRun, judge, type DecisionResult, type DecisionRow } from "../src/judge";

const answer = (slop: number, deliberate: number, risky: number) => ({
  slop: { type: "noul", noul: slop },
  deliberate: { type: "noul", noul: deliberate },
  risky: { type: "noul", noul: risky },
});

test("sorts findings into enforce, waive and human, and never guesses when judging fails", async () => {
  const replies: Record<string, Omit<DecisionResult, "id">> = {
    enforce: { answers: answer(0.97, 0.03, 0.04) },
    idiom: { answers: answer(0.04, 0.5, 0.5) },
    convention: { answers: answer(0.96, 0.95, 0.6) },
    risky: { answers: answer(0.98, 0.04, 0.95) },
    unsure: { answers: answer(0.6, 0.2, 0.1) },
  };
  const rules = [...Object.keys(replies), "down"];
  const run = async (rows: DecisionRow[]): Promise<DecisionResult[]> =>
    rows.map(({ id, state }) =>
      state.rule === "down" ? { id, error: "question failed" } : { id, ...replies[state.rule] },
    );
  const findings = rules.map((rule) => ({ rule, message: rule, snippet: "x" }));
  const judged = await judge(findings, { run });
  const outage = await judge(findings.slice(0, 1), { run: async () => { throw new Error("connection refused"); } });
  assert.deepEqual(outage.map(({ verdict }) => verdict), ["unjudged"]);
  assert.deepEqual(
    judged.map(({ rule, verdict }) => [rule, verdict]),
    [
      ["enforce", "enforce"],
      ["idiom", "waive"],
      ["convention", "waive"],
      ["risky", "human"],
      ["unsure", "human"],
      ["down", "unjudged"],
    ],
  );
});

const decisionsApi = async (reply: (body: any, headers: IncomingHttpHeaders) => unknown) => {
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk)).on("end", () => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(reply(JSON.parse(body), request.headers)));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
};

test("judge reads snippets from the git root and calls the provider set in mop.config", async (context) => {
  const seen: { snippet?: string; model?: string; authorization?: string } = {};
  const { server, endpoint } = await decisionsApi((body, headers) => {
    Object.assign(seen, { snippet: body.state.snippet, model: body.model, authorization: headers.authorization });
    return { answers: answer(0.97, 0.03, 0.04) };
  });
  context.after(() => server.close());
  const repo = await mkdtemp(path.join(os.tmpdir(), "mop-judge-"));
  await mkdir(path.join(repo, "pkg"));
  await writeFile(path.join(repo, "pkg", "cart.ts"), "one\ntwo\nthree\n");
  await writeFile(path.join(repo, "mop.config.json"), JSON.stringify({ judge: { provider: "custom", endpoint, model: "clef", apiKeyVariable: "FAKE_KEY" } }));
  await writeFile(path.join(repo, "findings.json"), JSON.stringify([{ file: "pkg/cart.ts", line: 2, rule: "r", message: "m" }]));
  execFileSync("git", ["init", "-q"], { cwd: repo });

  const { stdout } = await promisify(execFile)(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), path.resolve("bin/slopmop.ts"), "judge", "--json", "../findings.json"],
    { cwd: path.join(repo, "pkg"), env: { ...process.env, FAKE_KEY: "sekret", XDG_CONFIG_HOME: repo, MOP_TELEMETRY: "0" } },
  );

  assert.equal(JSON.parse(stdout).findings[0].verdict, "enforce");
  assert.deepEqual(seen, { snippet: "  1 one\n> 2 two\n  3 three\n  4 ", model: "clef", authorization: "Bearer sekret" });
});

test("the vercel provider asks boolean questions and reads probabilities", async (context) => {
  const seen: { types?: unknown[]; model?: unknown } = {};
  const { server, endpoint } = await decisionsApi((body, headers) => {
    Object.assign(seen, { types: Object.values(body.questions).map(({ type }: any) => type), model: headers["ai-model-id"] });
    return { answers: { slop: { probability: 0.02 }, deliberate: { probability: 0.5 }, risky: { probability: 0.5 } } };
  });
  context.after(() => server.close());

  const [judged] = await judge([{ rule: "r", message: "m", snippet: "x" }], {
    run: decisionsRun({ provider: "vercel", endpoint }, { AI_GATEWAY_API_KEY: "sekret" }),
  });

  assert.deepEqual(judged && [judged.verdict, judged.why], ["waive", "not slop on this line"]);
  assert.deepEqual(seen, { types: ["boolean", "boolean", "boolean"], model: "typesafe-ai/jev" });
});

test("a missing API key leaves every finding unjudged with the variable to set", async () => {
  const judged = await judge([{ rule: "r", message: "m", snippet: "x" }], {
    run: decisionsRun({ provider: "openrouter" }, {}),
  });

  assert.deepEqual(judged.map(({ verdict, why }) => [verdict, why]), [
    ["unjudged", "judging failed: OPENROUTER_API_KEY is not set; export the openrouter API key"],
  ]);
});
