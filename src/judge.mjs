import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const AUTO = 0.9;

export const QUESTIONS = {
  slop: {
    type: "noul",
    instructions:
      "Is `finding` real slop or a real defect on the `>` line of `snippet`, something a careful senior reviewer of this codebase would ask to change, rather than a false positive?",
    criteria: {
      true: "The flagged code really has the problem the finding names, and changing it makes the code, docs or UI better.",
      false: "The finding misreads the line, flags an idiom, a directive, generated text, or a file the rule was not written for.",
    },
  },
  deliberate: {
    type: "noul",
    instructions:
      "Does the surrounding code in `snippet` deliberately follow the pattern the finding flags, as a convention of this codebase or file type?",
    criteria: {
      true: "The flagged pattern is the house style here, or the file's format requires it.",
      false: "The flagged pattern is an outlier the branch introduced.",
    },
  },
  risky: {
    type: "noul",
    instructions:
      "Could fixing this finding change runtime behaviour, user-facing copy or layout, a public API, a file format another tool reads, or weaken a test's assertions?",
    criteria: {
      true: "The fix is more than a mechanical rewrite and someone could notice the difference.",
      false: "The fix is mechanical and nobody outside the diff could notice it.",
    },
  },
};

const certainty = (answer) => Math.max(answer.noul, 1 - answer.noul);

export const verdictOf = (answers) => {
  const yes = (id) => answers[id].noul >= 0.5;
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

export const jevBatch = (rows) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      "jev",
      ["batch", "--input", "-", "--state-key", "state", "--questions-json", JSON.stringify(QUESTIONS), "--concurrency", "8", "--compact"],
      { maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => {
        if (error) return reject(error);
        resolve(stdout.split("\n").filter((line) => line.startsWith("{")).map((line) => JSON.parse(line)));
      },
    );
    child.stdin.end(rows.map((row) => JSON.stringify(row)).join("\n"));
  });

const unjudged = (finding, why) => ({ ...finding, verdict: "unjudged", why });

export const judge = async (findings, { root = process.cwd(), run = jevBatch } = {}) => {
  const rows = await Promise.all(
    findings.map(async (finding, id) => ({
      id,
      state: {
        mop: finding.mop ?? "code",
        rule: finding.rule,
        finding: finding.message,
        file: finding.file,
        snippet: finding.snippet ?? (await snippetOf(root, finding)),
      },
    })),
  );
  let results;
  try {
    results = await run(rows);
  } catch (error) {
    return findings.map((finding) => unjudged(finding, `jev failed: ${error instanceof Error ? error.message : String(error)}`));
  }
  const byId = new Map(results.map((result) => [result.id, result]));
  return findings.map((finding, id) => {
    const { answers, error } = byId.get(id) ?? {};
    if (Object.keys(QUESTIONS).some((key) => typeof answers?.[key]?.noul !== "number"))
      return unjudged(finding, error ?? "jev returned no answer");
    const probabilities = Object.fromEntries(Object.entries(answers).map(([key, answer]) => [key, Math.round(answer.noul * 100) / 100]));
    return { ...finding, ...verdictOf(answers), probabilities };
  });
};
