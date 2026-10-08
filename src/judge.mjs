import { readFile } from "node:fs/promises";
import path from "node:path";

export const JEV = "typesafe-ai/jev";
export const AUTO = 0.9;

export const QUESTIONS = {
  slop: {
    type: "boolean",
    instructions:
      "Is `finding` real slop or a real defect on the `>` line of `snippet`, something a careful senior reviewer of this codebase would ask to change, rather than a false positive?",
    criteria: {
      true: "The flagged code really has the problem the finding names, and changing it makes the code, docs or UI better.",
      false: "The finding misreads the line, flags an idiom, a directive, generated text, or a file the rule was not written for.",
    },
  },
  deliberate: {
    type: "boolean",
    instructions:
      "Does the surrounding code in `snippet` deliberately follow the pattern the finding flags, as a convention of this codebase or file type?",
    criteria: {
      true: "The flagged pattern is the house style here, or the file's format requires it.",
      false: "The flagged pattern is an outlier the branch introduced.",
    },
  },
  risky: {
    type: "boolean",
    instructions:
      "Could fixing this finding change runtime behaviour, user-facing copy or layout, a public API, a file format another tool reads, or weaken a test's assertions?",
    criteria: {
      true: "The fix is more than a mechanical rewrite and someone could notice the difference.",
      false: "The fix is mechanical and nobody outside the diff could notice it.",
    },
  },
};

const certainty = (answer) => Math.max(answer.probability, 1 - answer.probability);

export const verdictOf = (answers) => {
  const yes = (id) => answers[id].probability >= 0.5;
  const sure = (id) => certainty(answers[id]) >= AUTO;
  if (!sure("slop")) return { verdict: "human", why: "Jev is unsure whether this is slop" };
  if (!yes("slop")) return { verdict: "waive", why: "not slop on this line" };
  if (!sure("deliberate")) return { verdict: "human", why: "Jev is unsure whether the pattern is deliberate here" };
  if (yes("deliberate")) return { verdict: "waive", why: "the code around it follows this pattern on purpose" };
  if (!sure("risky") || yes("risky")) return { verdict: "human", why: "the fix could change behaviour, copy, an API or a test" };
  return { verdict: "enforce", why: "real slop with a mechanical fix" };
};

export const snippetOf = async (root, { file, line }, radius = 4) => {
  if (!file || !line) return "";
  try {
    const lines = (await readFile(path.resolve(root, file), "utf8")).split("\n");
    const start = Math.max(0, line - 1 - radius);
    return lines
      .slice(start, line + radius)
      .map((text, index) => `${start + index + 1 === line ? ">" : " "} ${start + index + 1} ${text}`)
      .join("\n");
  } catch {
    return "";
  }
};

const judgeOne = async (finding, { root, evaluate }) => {
  const state = {
    mop: finding.mop ?? "code",
    rule: finding.rule,
    finding: finding.message,
    file: finding.file,
    snippet: finding.snippet ?? (await snippetOf(root, finding)),
  };
  try {
    const result = await evaluate({ model: JEV, state, questions: QUESTIONS, maxRetries: 1 });
    if (Object.keys(QUESTIONS).some((id) => typeof result.answers[id]?.probability !== "number"))
      return { ...finding, verdict: "unjudged", why: "Jev returned no answer" };
    const probabilities = Object.fromEntries(
      Object.entries(result.answers).map(([id, answer]) => [id, Math.round(answer.probability * 100) / 100]),
    );
    return { ...finding, ...verdictOf(result.answers), probabilities };
  } catch (error) {
    return { ...finding, verdict: "unjudged", why: error instanceof Error ? error.message : String(error) };
  }
};

export const judge = async (findings, { root = process.cwd(), evaluate, concurrency = 8 }) => {
  const judged = Array.from({ length: findings.length });
  let next = 0;
  const worker = async () => {
    while (next < findings.length) {
      const index = next;
      next += 1;
      judged[index] = await judgeOne(findings[index], { root, evaluate });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, findings.length) }, worker));
  return judged;
};
