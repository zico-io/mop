import assert from "node:assert/strict";
import { test } from "node:test";
import { judge } from "../src/judge.mjs";

const answer = (slop, deliberate, risky) => ({
  slop: { type: "boolean", probability: slop },
  deliberate: { type: "boolean", probability: deliberate },
  risky: { type: "boolean", probability: risky },
});

test("sorts findings into enforce, waive and human, and never guesses when Jev fails", async () => {
  const replies = {
    enforce: { answers: answer(0.97, 0.03, 0.04) },
    idiom: { answers: answer(0.04, 0.5, 0.5) },
    convention: { answers: answer(0.96, 0.95, 0.6) },
    risky: { answers: answer(0.98, 0.04, 0.95) },
    unsure: { answers: answer(0.6, 0.2, 0.1) },
  };
  const evaluate = async ({ state }) => {
    if (state.rule === "down") throw new Error("gateway 503");
    return replies[state.rule];
  };
  const findings = [...Object.keys(replies), "down"].map((rule) => ({ rule, message: rule, snippet: "x" }));
  const judged = await judge(findings, { evaluate });
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
