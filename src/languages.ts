import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { Config } from "./config";

export type LanguageName = keyof Config["linters"];

export interface Diagnostic {
  file: string;
  line: number;
  rule: string;
  message: string;
}

export interface Skipped {
  language: LanguageName;
  reason: string;
}

interface Run {
  files: string[];
  args: string[];
}

interface Language {
  extensions: RegExp;
  comment: RegExp;
  unit: (root: string, file: string) => string;
  command: (run: Run) => [string, ...string[]];
  parse: (stdout: string) => Diagnostic[];
}

const exec = (cwd: string, [command, ...args]: [string, ...string[]]) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw new Error(`${command} not found on PATH`);
  return result;
};

const jsonLines = (stdout: string): unknown[] =>
  stdout.split("\n").filter((line) => line.startsWith("{")).map((line) => JSON.parse(line));

const atRoot = (root: string) => root;
const inDirectory = (root: string, file: string) => path.dirname(path.join(root, file));

interface ClippyMessage {
  reason: string;
  message?: {
    message: string;
    code: { code: string } | null;
    spans: { file_name: string; line_start: number; is_primary: boolean }[];
  };
}

const clippyRule = (code: string | undefined): string =>
  code?.startsWith("clippy::") ? `clippy/${code.slice("clippy::".length)}` : `rustc/${code ?? "error"}`;

const YAMLLINT = /^(?<file>.+?):(?<line>\d+):\d+: \[\w+\] (?<message>.*) \((?<rule>[\w-]+)\)$/;

export const LANGUAGES: Record<LanguageName, Language> = {
  python: {
    extensions: /\.pyi?$/,
    comment: /^\s*#(.*)$/,
    unit: atRoot,
    command: ({ files, args }) => ["ruff", "check", "--isolated", "--no-fix", "--output-format=json", ...args, ...files],
    parse: (stdout) =>
      (JSON.parse(stdout) as { code: string | null; message: string; filename: string; location: { row: number } }[]).map(
        (item) => ({ file: item.filename, line: item.location.row, rule: `ruff/${item.code ?? "syntax-error"}`, message: item.message }),
      ),
  },
  go: {
    extensions: /\.go$/,
    comment: /^\s*\/\/(.*)$/,
    unit: inDirectory,
    command: ({ args }) => ["staticcheck", "-f", "json", ...args, "."],
    parse: (stdout) =>
      (jsonLines(stdout) as { code: string; message: string; location: { file: string; line: number } }[]).map((item) => ({
        file: item.location.file,
        line: item.location.line,
        rule: `staticcheck/${item.code}`,
        message: item.message,
      })),
  },
  rust: {
    extensions: /\.rs$/,
    comment: /^\s*\/\/(.*)$/,
    unit: (root, file) => {
      const manifest = exec(inDirectory(root, file), ["cargo", "locate-project", "--workspace", "--message-format", "plain"]);
      return path.dirname(manifest.stdout.trim());
    },
    command: ({ args }) => ["cargo", "clippy", "--quiet", "--message-format=json", "--", ...args],
    parse: (stdout) =>
      (jsonLines(stdout) as ClippyMessage[]).flatMap(({ reason, message }) => {
        const span = message?.spans.find((candidate) => candidate.is_primary);
        if (reason !== "compiler-message" || !message || !span) return [];
        return [{ file: span.file_name, line: span.line_start, rule: clippyRule(message.code?.code), message: message.message }];
      }),
  },
  terraform: {
    extensions: /\.tf$/,
    comment: /^\s*(?:#|\/\/)(.*)$/,
    unit: inDirectory,
    command: ({ args }) => ["tflint", "--format", "json", ...args],
    parse: (stdout) => {
      type Issue = { message: string; rule?: { name: string }; range?: { filename: string; start: { line: number } } };
      const { issues = [], errors = [] } = JSON.parse(stdout) as { issues?: Issue[]; errors?: Issue[] };
      return [...issues, ...errors].flatMap(({ message, rule, range }) =>
        range ? [{ file: range.filename, line: range.start.line, rule: `tflint/${rule?.name ?? "error"}`, message }] : [],
      );
    },
  },
  yaml: {
    extensions: /\.ya?ml$/,
    comment: /^\s*#(.*)$/,
    unit: atRoot,
    command: ({ files, args }) => ["yamllint", "-f", "parsable", ...args, ...files],
    parse: (stdout) =>
      stdout.split("\n").flatMap((line) => {
        const { file, line: row, rule, message } = YAMLLINT.exec(line)?.groups ?? {};
        return file && row && rule && message ? [{ file, line: Number(row), rule: `yamllint/${rule}`, message }] : [];
      }),
  },
};

export const languageOf = (file: string): LanguageName | undefined =>
  (Object.keys(LANGUAGES) as LanguageName[]).find((name) => LANGUAGES[name].extensions.test(file));

// ponytail: full-line comments only; a `#` line inside a multi-line string or block scalar is a false positive Jev waives.
export const commentFindings = (root: string, file: string, allow: string[]): Diagnostic[] => {
  const language = languageOf(file);
  if (!language) return [];
  const allowed = new RegExp(`^\\s?(${allow.length ? allow.join("|") : "(?!)"})`);
  return readFileSync(path.join(root, file), "utf8")
    .split("\n")
    .flatMap((text, index) => {
      const body = LANGUAGES[language].comment.exec(text)?.[1];
      return body === undefined || allowed.test(body)
        ? []
        : [{ file, line: index + 1, rule: "mop/no-comments", message: "Comments are forbidden" }];
    });
};

const groupBy = <Item>(items: Item[], key: (item: Item) => string): Map<string, Item[]> => {
  const groups = new Map<string, Item[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
};

// Tools print paths relative to where they ran, or absolute through symlinks like /tmp, so both sides go through realpath.
const fromRoot = (root: string, cwd: string, file: string): string => {
  const absolute = path.resolve(cwd, file);
  try {
    return path.relative(root, realpathSync(absolute));
  } catch {
    return path.relative(root, absolute);
  }
};

export const lintLanguages = (
  root: string,
  files: string[],
  linters: Config["linters"],
): { diagnostics: Diagnostic[]; skipped: Skipped[] } => {
  const realRoot = realpathSync(root);
  const diagnostics: Diagnostic[] = [];
  const skipped: Skipped[] = [];
  for (const [name, group] of groupBy(files, (file) => languageOf(file) ?? "")) {
    const language = LANGUAGES[name as LanguageName];
    const args = linters[name as LanguageName];
    if (!language || args === false) continue;
    try {
      for (const [cwd, unitFiles] of groupBy(group, (file) => language.unit(root, file))) {
        const relative = unitFiles.map((file) => path.relative(cwd, path.join(root, file)));
        const { stdout, stderr } = exec(cwd, language.command({ files: relative, args }));
        try {
          diagnostics.push(...language.parse(stdout).map((item) => ({ ...item, file: fromRoot(realRoot, cwd, item.file) })));
        } catch {
          throw new Error(stderr.trim().split("\n").at(-1) ?? "unreadable output");
        }
      }
    } catch (error) {
      skipped.push({ language: name as LanguageName, reason: (error as Error).message });
    }
  }
  return { diagnostics, skipped };
};
