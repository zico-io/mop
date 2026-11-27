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
  id?: string;
  rule: string;
  message: string;
  file?: string;
  line?: number;
  mop?: string;
  snippet?: string;
}

export interface DecisionRow {
  id: number;
  state: { mop: string; rule: string; finding: string; file?: string; snippet: string };
}

export interface DecisionResult {
  id: number;
  answers?: unknown;
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
  if (!sure("slop")) return { verdict: "human", why: "the judge is unsure whether this is slop" };
  if (!yes("slop")) return { verdict: "waive", why: "not slop on this line" };
  if (!sure("deliberate")) return { verdict: "human", why: "the judge is unsure whether the pattern is deliberate here" };
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

interface Provider {
  model?: string;
  apiKeyVariable: string;
  endpoint?: (model: string, environment: Environment) => string | undefined;
  request?: (body: { state: DecisionRow["state"]; model: string; questions: typeof QUESTIONS }) => {
    body: object;
    headers: Record<string, string>;
  };
  answers?: (response: Record<string, unknown>) => unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const PROVIDERS = {
  typesafe: {
    model: "jev-latest",
    apiKeyVariable: "TYPESAFE_API_KEY",
    endpoint: () => "https://api.typesafe.ai/v1/systemone",
  },
  openrouter: {
    model: "typesafe/jev-1.13",
    apiKeyVariable: "OPENROUTER_API_KEY",
    endpoint: () => "https://openrouter.ai/api/alpha/decisions",
  },
  vercel: {
    model: "typesafe-ai/jev",
    apiKeyVariable: "AI_GATEWAY_API_KEY",
    endpoint: () => "https://ai-gateway.vercel.sh/v4/ai/evaluation-model",
    request: ({ model, questions, ...body }) => ({
      body: {
        ...body,
        questions: Object.fromEntries(
          Object.entries(questions).map(([id, question]) => [id, { ...question, type: "boolean" }]),
        ),
      },
      headers: {
        "ai-gateway-protocol-version": "0.0.1",
        "ai-gateway-auth-method": "api-key",
        "ai-evaluation-model-specification-version": "4",
        "ai-model-id": model,
      },
    }),
    answers: ({ answers }) =>
      isRecord(answers)
        ? Object.fromEntries(
            Object.entries(answers).map(([id, answer]) => [id, { noul: isRecord(answer) ? answer.probability : undefined }]),
          )
        : undefined,
  },
  cloudflare: {
    model: "clef-flash",
    apiKeyVariable: "CLOUDFLARE_API_TOKEN",
    endpoint: (model, { CLOUDFLARE_ACCOUNT_ID: account }) => {
      return account && `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/cloudflare/${model}`;
    },
    answers: ({ success, result }) => {
      if (success !== true) throw new Error("Cloudflare Workers AI reported a failed request");
      return isRecord(result) && isRecord(result.answers) ? result.answers : undefined;
    },
  },
  custom: {
    apiKeyVariable: "MOP_JUDGE_API_KEY",
  },
} satisfies Record<string, Provider>;

export interface JudgeConfig {
  provider: keyof typeof PROVIDERS;
  endpoint?: string;
  model?: string;
  apiKeyVariable?: string;
}

type Environment = Record<string, string | undefined>;

const CONCURRENCY = 8;
const TIMEOUT_MS = 60_000;

export const modelOf = (config: JudgeConfig): string | undefined =>
  config.model ?? (PROVIDERS[config.provider] as Provider | undefined)?.model;

const decider = (config: JudgeConfig, environment: Environment) => {
  const provider: Provider = PROVIDERS[config.provider];
  if (!provider) throw new Error(`unknown judge provider "${config.provider}"; use one of ${Object.keys(PROVIDERS).join(", ")}`);
  const model = config.model ?? provider.model;
  if (!model) throw new Error(`the ${config.provider} provider needs judge.model in mop.config`);
  const endpoint = config.endpoint ?? provider.endpoint?.(model, environment);
  if (!endpoint) {
    throw new Error(
      config.provider === "cloudflare"
        ? "the cloudflare provider needs CLOUDFLARE_ACCOUNT_ID"
        : `the ${config.provider} provider needs judge.endpoint in mop.config`,
    );
  }
  const apiKeyVariable = config.apiKeyVariable ?? provider.apiKeyVariable;
  const key = environment[apiKeyVariable];
  if (!key) throw new Error(`${apiKeyVariable} is not set; export the ${config.provider} API key`);
  return async (state: DecisionRow["state"]): Promise<unknown> => {
    const { body, headers } = provider.request?.({ state, model, questions: QUESTIONS }) ?? {
      body: { state, model, questions: QUESTIONS },
      headers: {},
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    const result: unknown = await response.json();
    if (!isRecord(result)) throw new Error("the decisions API returned a non-object response");
    return provider.answers ? provider.answers(result) : result.answers;
  };
};

export const decisionsRun =
  (config: JudgeConfig, environment: Environment) =>
  async (rows: DecisionRow[]): Promise<DecisionResult[]> => {
    const decide = decider(config, environment);
    const results: DecisionResult[] = [];
    const queue = rows.values();
    const worker = async (): Promise<void> => {
      for (const { id, state } of queue) {
        try {
          results.push({ id, answers: await decide(state) });
        } catch (error) {
          results.push({ id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
    return results;
  };

const isAnswered = (answers: unknown): answers is Answers =>
  isRecord(answers) && QUESTION_IDS.every((key) => isRecord(answers[key]) && typeof answers[key].noul === "number");

const unjudged = <Input extends Finding>(finding: Input, why: string): Judged<Input> => ({
  ...finding,
  verdict: "unjudged",
  why,
});

export const judge = async <Input extends Finding>(
  findings: Input[],
  { root = process.cwd(), run }: { root?: string; run: (rows: DecisionRow[]) => Promise<DecisionResult[]> },
): Promise<Judged<Input>[]> => {
  const rows = await Promise.all(
    findings.map(async (finding, id): Promise<DecisionRow> => ({
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
  let results: DecisionResult[];
  try {
    results = await run(rows);
  } catch (error) {
    return findings.map((finding) => unjudged(finding, `judging failed: ${error instanceof Error ? error.message : String(error)}`));
  }
  const byId = new Map(results.map((result) => [result.id, result]));
  return findings.map((finding, id) => {
    const { answers, error } = byId.get(id) ?? {};
    if (!isAnswered(answers)) return unjudged(finding, error ?? "the decisions API returned no answer");
    const probabilities = Object.fromEntries(
      QUESTION_IDS.map((key) => [key, answers[key].noul]),
    ) as Record<QuestionId, number>;
    return { ...finding, ...verdictOf(answers), probabilities };
  });
};
