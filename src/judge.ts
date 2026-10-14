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

type QuestionId = keyof typeof QUESTIONS;
const QUESTION_IDS = Object.keys(QUESTIONS) as QuestionId[];

type Answers = Record<QuestionId, { noul: number }>;

export interface Finding {
  rule: string;
  message: string;
  file?: string;
  line?: number;
  mop?: string;
  snippet?: string;
}

export interface JevRow {
  id: number;
  state: { mop: string; rule: string; finding: string; file?: string; snippet: string };
}

export interface JevResult {
  id: number;
  answers?: Partial<Record<string, { noul?: unknown }>>;
  error?: string;
}

export type Ruling = { verdict: "enforce" | "waive" | "human"; why: string };

export type Judged<Input extends Finding> = Input &
  (
    | { verdict: "unjudged"; why: string }
    | (Ruling & { probabilities: Record<QuestionId, number> })
  );

const certainty = (answer: { noul: number }): number => Math.max(answer.noul, 1 - answer.noul);

export const verdictOf = (answers: Answers): Ruling => {
  const yes = (id: QuestionId) => answers[id].noul >= 0.5;
  const sure = (id: QuestionId) => certainty(answers[id]) >= AUTO;
  if (!sure("slop")) return { verdict: "human", why: "Jev is unsure whether this is slop" };
  if (!yes("slop")) return { verdict: "waive", why: "not slop on this line" };
  if (!sure("deliberate")) return { verdict: "human", why: "Jev is unsure whether the pattern is deliberate here" };
  if (yes("deliberate")) return { verdict: "waive", why: "the code around it follows this pattern on purpose" };
  if (!sure("risky") || yes("risky")) return { verdict: "human", why: "the fix could change behaviour, copy, an API or a test" };
  return { verdict: "enforce", why: "real slop with a mechanical fix" };
};

export const snippetOf = async (
  root: string,
  { file, line }: Pick<Finding, "file" | "line">,
  radius = 4,
): Promise<string> => {
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

// Both jev CLIs print a failure as one JSON line, `{"ok": false, "error": ...}`, on stderr.
const errorOf = (line = ""): string => {
  try {
    return String(JSON.parse(line).error ?? line);
  } catch {
    return line;
  }
};

const exec = (args: string[], input?: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = execFile("jev", args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) return resolve(stdout);
      reject(new Error(errorOf(stderr.trim().split("\n").at(-1)) || error.message));
    });
    child.stdin?.end(input);
  });

// jev-cli (PyPI) takes a full request through `run -`; the other `jev` CLI takes it through `ask -f -`.
const requestArgs = async (): Promise<string[]> => {
  const commands = (await exec(["--help"])).match(/\{([\w,-]+)\}/)?.[1]?.split(",") ?? [];
  if (commands.includes("run")) return ["run", "-"];
  if (commands.includes("ask")) return ["ask", "-f", "-", "--json", "--compact"];
  throw new Error("this jev CLI has neither `run` nor `ask`; install jev-cli 0.7+ with `uv tool install jev-cli`");
};

export const jevRun = async (rows: JevRow[], concurrency = 8): Promise<JevResult[]> => {
  const args = await requestArgs();
  const results: JevResult[] = [];
  const queue = rows.values();
  const worker = async (): Promise<void> => {
    for (const { id, state } of queue) {
      try {
        const { answers } = JSON.parse(await exec(args, JSON.stringify({ state, questions: QUESTIONS })));
        results.push({ id, answers });
      } catch (error) {
        results.push({ id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
  return results;
};

const isAnswered = (answers: JevResult["answers"]): answers is Answers =>
  QUESTION_IDS.every((key) => typeof answers?.[key]?.noul === "number");

const unjudged = <Input extends Finding>(finding: Input, why: string): Judged<Input> => ({
  ...finding,
  verdict: "unjudged",
  why,
});

export const judge = async <Input extends Finding>(
  findings: Input[],
  { root = process.cwd(), run = jevRun }: { root?: string; run?: (rows: JevRow[]) => Promise<JevResult[]> } = {},
): Promise<Judged<Input>[]> => {
  const rows = await Promise.all(
    findings.map(async (finding, id): Promise<JevRow> => ({
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
  let results: JevResult[];
  try {
    results = await run(rows);
  } catch (error) {
    return findings.map((finding) => unjudged(finding, `jev failed: ${error instanceof Error ? error.message : String(error)}`));
  }
  const byId = new Map(results.map((result) => [result.id, result]));
  return findings.map((finding, id) => {
    const { answers, error } = byId.get(id) ?? {};
    if (!isAnswered(answers)) return unjudged(finding, error ?? "jev returned no answer");
    const probabilities = Object.fromEntries(
      QUESTION_IDS.map((key) => [key, Math.round(answers[key].noul * 100) / 100]),
    ) as Record<QuestionId, number>;
    return { ...finding, ...verdictOf(answers), probabilities };
  });
};
