import assert from "node:assert/strict";
import { test } from "node:test";
import { judge, type JevResult, type JevRow } from "../src/judge";

const answer = (slop: number, deliberate: number, risky: number) => ({
  slop: { type: "noul", noul: slop },
  deliberate: { type: "noul", noul: deliberate },
  risky: { type: "noul", noul: risky },
});

test("sorts findings into enforce, waive and human, and never guesses when Jev fails", async () => {
  const replies: Record<string, Omit<JevResult, "id">> = {
    enforce: { answers: answer(0.97, 0.03, 0.04) },
    idiom: { answers: answer(0.04, 0.5, 0.5) },
    convention: { answers: answer(0.96, 0.95, 0.6) },
    risky: { answers: answer(0.98, 0.04, 0.95) },
    unsure: { answers: answer(0.6, 0.2, 0.1) },
  };
  const rules = [...Object.keys(replies), "down"];
  const run = async (rows: JevRow[]): Promise<JevResult[]> =>
    rows.map(({ id, state }) =>
      state.rule === "down" ? { id, error: "question failed" } : { id, ...replies[state.rule] },
    );
  const findings = rules.map((rule) => ({ rule, message: rule, snippet: "x" }));
  const judged = await judge(findings, { run });
  const outage = await judge(findings.slice(0, 1), { run: async () => { throw new Error("jev: not found"); } });
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
