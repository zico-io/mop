import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ESLint, Rule } from "eslint";
import type { CallExpression } from "estree";

const MODULE_MOCKS = new Set(["mock", "doMock"]);
const TEST_SUFFIX = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const EXTENSION = /\.[cm]?[jt]sx?$/;
const INDEX = /[/\\]index$/;
const DEFAULT_INTERNAL = [String.raw`^\.{1,2}/`, "^[@~#]/", "^src/"];

interface Manifest {
  name?: string;
  workspaces?: string[] | { packages?: string[] };
}

const readManifest = (file: string): Manifest => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
};

const escapeRegExp = (text: string): string => text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);

const workspacePatterns = (root: string): string[] => {
  const { workspaces = [] } = readManifest(path.join(root, "package.json"));
  const globs = Array.isArray(workspaces) ? workspaces : (workspaces.packages ?? []);
  return globs
    .flatMap((glob) => globSync(`${glob}/package.json`, { cwd: root }))
    .map((file) => readManifest(path.join(root, file)).name)
    .filter((name) => name !== undefined)
    .map((name) => `^${escapeRegExp(name)}(?:/|$)`);
};

const firstParty = new Map<string, string[]>();
const firstPartyPatterns = (root: string): string[] => {
  const cached = firstParty.get(root);
  if (cached) return cached;
  const patterns = [...DEFAULT_INTERNAL, ...workspacePatterns(root)];
  firstParty.set(root, patterns);
  return patterns;
};

const viMethod = ({ callee }: CallExpression): string | undefined => {
  if (callee.type !== "MemberExpression" || callee.computed) return undefined;
  const { object, property } = callee;
  const isVi = object.type === "Identifier" && object.name === "vi" && property.type === "Identifier";
  return isVi ? property.name : undefined;
};

const mockedPath = ({ arguments: [first] }: CallExpression): string | undefined => {
  if (first?.type === "Literal" && typeof first.value === "string") return first.value;
  if (first?.type === "TemplateLiteral" && first.expressions.length === 0) {
    return first.quasis[0]?.value.cooked ?? undefined;
  }
  if (first?.type !== "ImportExpression" || first.source.type !== "Literal") return undefined;
  return String(first.source.value);
};

const moduleMock = (node: CallExpression): string | undefined =>
  MODULE_MOCKS.has(viMethod(node) ?? "") ? mockedPath(node) : undefined;
const withoutExtension = (file: string): string => file.replace(EXTENSION, "").replace(INDEX, "");
const budgetSchema = { type: "integer", minimum: 0 };

interface Budgets {
  moduleMocks: number;
  spies: number;
  globals: number;
}

const maxMocksPerFile: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: { moduleMocks: budgetSchema, spies: budgetSchema, globals: budgetSchema },
        additionalProperties: false,
      },
    ],
    messages: {
      moduleMocks:
        "Module mock {{count}} of at most {{max}}. A test that needs this many mocked modules tests wiring, not behavior: move up a level and use the real collaborators with one fake at the process boundary.",
      spies:
        "Spy {{count}} of at most {{max}}. Assert on returned values and observable state instead of internal calls.",
      globals:
        "Stubbed global {{count}} of at most {{max}}. Pass the dependency in (fetch, storage, config) instead of patching globals.",
    },
  },
  create(context) {
    const { moduleMocks = 3, spies = 5, globals = 2 }: Partial<Budgets> = context.options[0] ?? {};
    const tallies = [
      { messageId: "moduleMocks", methods: MODULE_MOCKS, max: moduleMocks },
      { messageId: "spies", methods: new Set(["spyOn"]), max: spies },
      { messageId: "globals", methods: new Set(["stubGlobal"]), max: globals },
    ].map((budget) => ({ ...budget, count: 0 }));
    return {
      CallExpression(node) {
        const method = viMethod(node);
        for (const tally of tallies) {
          if (!method || !tally.methods.has(method)) continue;
          tally.count += 1;
          if (tally.count <= tally.max) continue;
          context.report({
            node,
            messageId: tally.messageId,
            data: { count: String(tally.count), max: String(tally.max) },
          });
        }
      },
    };
  },
};

const patternList = { type: "array", items: { type: "string" } };

const noInternalModuleMock: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: { internal: patternList, allow: patternList },
        additionalProperties: false,
      },
    ],
    messages: {
      internal:
        "Mocking first-party module '{{path}}'. Run the real module and mock only the process boundary it reaches (network, database, clock, third-party SDK). If '{{path}}' is itself that boundary, add it to tests.allowMocks in mop.config.",
    },
  },
  create(context) {
    const options: { internal?: string[]; allow?: string[] } = context.options[0] ?? {};
    const toRegExps = (patterns: string[]) => patterns.map((pattern) => new RegExp(pattern, "u"));
    const internal = toRegExps(options.internal ?? firstPartyPatterns(context.cwd));
    const allow = toRegExps(options.allow ?? []);
    return {
      CallExpression(node) {
        const mocked = moduleMock(node);
        const isAllowed =
          !mocked ||
          internal.every((pattern) => !pattern.test(mocked)) ||
          allow.some((pattern) => pattern.test(mocked));
        if (isAllowed) return;
        context.report({ node: node.arguments[0] ?? node, messageId: "internal", data: { path: mocked } });
      },
    };
  },
};

const noMockSubjectUnderTest: Rule.RuleModule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      subject:
        "'{{path}}' is the module this file is named after. Mocking it means the test only checks the mock: remove this vi.mock and run the real implementation.",
    },
  },
  create(context) {
    if (!TEST_SUFFIX.test(context.filename)) return {};
    const directory = path.dirname(context.filename);
    const base = path.basename(context.filename).replace(TEST_SUFFIX, "");
    const subjects = new Set([
      withoutExtension(path.join(directory, base)),
      withoutExtension(path.join(directory, "..", base)),
    ]);
    return {
      CallExpression(node) {
        const mocked = moduleMock(node);
        if (!mocked?.startsWith(".")) return;
        if (!subjects.has(withoutExtension(path.resolve(directory, mocked)))) return;
        context.report({ node: node.arguments[0] ?? node, messageId: "subject", data: { path: mocked } });
      },
    };
  },
};

const requireTimerRestore: Rule.RuleModule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      missing:
        "vi.useFakeTimers() without vi.useRealTimers() in this file leaks fake timers into the next test. Add afterEach(() => { vi.useRealTimers(); }).",
    },
  },
  create(context) {
    const fakes: CallExpression[] = [];
    let isRestored = false;
    return {
      CallExpression(node) {
        const method = viMethod(node);
        if (method === "useFakeTimers") fakes.push(node);
        else if (method === "useRealTimers") isRestored = true;
      },
      "Program:exit"() {
        if (isRestored) return;
        for (const node of fakes) context.report({ node, messageId: "missing" });
      },
    };
  },
};

const testGuardrails: ESLint.Plugin = {
  rules: {
    "max-mocks-per-file": maxMocksPerFile,
    "no-internal-module-mock": noInternalModuleMock,
    "no-mock-subject-under-test": noMockSubjectUnderTest,
    "require-timer-restore": requireTimerRestore,
  },
};

export default testGuardrails;
