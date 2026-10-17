import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseChangedLines } from "../src/lib/diff-coverage";
import { isCommentScanned, newComments } from "./standards/comments";
import {
  applyExceptions,
  EXCEPTIONS_PATH,
  parseExceptions,
  type Finding,
  type StandardsException,
} from "./standards/exceptions";
import { parseZizmor, ZIZMOR_VERSION } from "./standards/zizmor";

export type RunResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type Io = {
  run(command: string, args: readonly string[], capture: boolean): RunResult;
  read(path: string): string | undefined;
  today(): string;
  log(line: string): void;
};

type Mode = { readonly staged: boolean; readonly base: string };

const USAGE = "standards: usage: bun scripts/standards.ts [--staged | --base <rev>]";
const DIFF_FLAGS = ["--unified=0", "--diff-filter=ACMR"];
const ZIZMOR_FLAGS = "--offline --no-ignores --no-config --collect=all --strict-collection".split(
  " ",
);

function resolveMode(args: readonly string[], io: Io): Mode | string {
  if (args.length === 1 && args[0] === "--staged") return { staged: true, base: "" };
  if (args.length === 2 && args[0] === "--base" && args[1]) return { staged: false, base: args[1] };
  if (args.length > 0) return USAGE;
  const found = io.run("git", ["merge-base", "origin/main", "HEAD"], true);
  if (found.status !== 0)
    return `standards: cannot find the merge base of origin/main and HEAD: ${found.stderr.trim()}`;
  return { staged: false, base: found.stdout.trim() };
}

function diff(io: Io, mode: Mode, ...flags: string[]) {
  const target = mode.staged ? "--cached" : mode.base;
  return io.run("git", ["-c", "core.quotePath=false", "diff", target, ...flags], true).stdout;
}

function report(io: Io, findings: readonly Finding[], exceptions: readonly StandardsException[]) {
  const { blocking, problems } = applyExceptions(findings, exceptions, io.today());
  for (const finding of blocking)
    io.log(`${finding.file}:${finding.line} ${finding.rule} ${finding.message}`);
  for (const problem of problems) io.log(problem);
  return blocking.length === 0 && problems.length === 0;
}

function unstagedChanges(io: Io, staged: boolean) {
  const status = io.run("git", ["status", "--porcelain", "--untracked-files=all"], true);
  return status.stdout
    .split("\n")
    .filter((line) => line.startsWith("??") || (staged && line.length > 3 && line[1] !== " "))
    .map((line) => line.slice(3));
}

function zizmor(io: Io, files: readonly string[], exceptions: readonly StandardsException[]) {
  if (!files.some((file) => file.startsWith(".github/") || file.startsWith("scripts/standards"))) {
    io.log("zizmor: skipped, no workflow or standards changes");
    return true;
  }
  const version = io.run("zizmor", ["--version"], true);
  if (version.status !== 0 || version.stdout.trim() !== `zizmor ${ZIZMOR_VERSION}`) {
    io.log(`zizmor ${ZIZMOR_VERSION} is required: pipx install zizmor==${ZIZMOR_VERSION}`);
    return false;
  }
  const result = io.run("zizmor", [...ZIZMOR_FLAGS, "--format", "json", ".github"], true);
  try {
    return report(io, parseZizmor(JSON.parse(result.stdout)), exceptions);
  } catch {
    io.log(`zizmor: ${result.stderr.trim()}`);
    return false;
  }
}

function loadExceptions(io: Io, content: (file: string) => string | undefined) {
  try {
    return parseExceptions(JSON.parse(content(EXCEPTIONS_PATH) ?? ""));
  } catch (error) {
    io.log(`${EXCEPTIONS_PATH}: ${String(error)}`);
    return undefined;
  }
}

export function main(args: readonly string[], io: Io): number {
  if (args.length === 1 && args[0] === "zizmor-version") {
    io.log(ZIZMOR_VERSION);
    return 0;
  }
  const mode = resolveMode(args, io);
  if (typeof mode === "string") {
    io.log(mode);
    return 2;
  }
  const show = (spec: string) => {
    const shown = io.run("git", ["show", spec], true);
    return shown.status === 0 ? shown.stdout : undefined;
  };
  const content = (file: string) => (mode.staged ? show(`:${file}`) : io.read(file));
  const dirty = unstagedChanges(io, mode.staged);
  if (dirty.length > 0) {
    io.log(`standards: stage or stash these changes first: ${dirty.join(", ")}`);
    return 1;
  }
  const changed = parseChangedLines(diff(io, mode, ...DIFF_FLAGS));
  const paths = diff(io, mode, "--name-only", "-z", "--diff-filter=ACMR").split("\0");
  const quoted = paths.filter((path) => /["\\\p{Cc}]/u.test(path));
  if (quoted.length > 0) {
    io.log(`standards: rename paths that git quotes: ${quoted.join(", ")}`);
    return 1;
  }
  const results: [string, boolean][] = [];
  const tool = (name: string, args: string[]) =>
    results.push([name, io.run("bun", ["run", ...args], false).status === 0]);
  tool("locales", ["check:locales"]);
  tool("lint", ["lint"]);
  tool("typecheck", ["typecheck"]);
  const exceptions = loadExceptions(io, content);
  results.push(["exceptions file", exceptions !== undefined]);
  const comments = [...changed]
    .filter(([file]) => isCommentScanned(file))
    .flatMap(([file, lines]) => {
      const text = content(file);
      const before = show(`${mode.staged ? "HEAD" : mode.base}:${file}`);
      return text === undefined ? [] : newComments(file, text, lines, before);
    });
  results.push(["no new comments", report(io, comments, exceptions ?? [])]);
  results.push(["zizmor", zizmor(io, paths, exceptions ?? [])]);
  tool("tests and 100% changed-line coverage", [
    "test:coverage:diff",
    "--",
    ...(mode.staged ? ["--staged"] : ["--base", mode.base]),
  ]);
  for (const [name, ok] of results) io.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  const passed = results.every(([, ok]) => ok);
  io.log(passed ? "STANDARDS OK" : "STANDARDS FAIL");
  return passed ? 0 : 1;
}

export const realIo: Io = {
  run(command, args, capture) {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      stdio: capture ? "pipe" : "inherit",
    });
    return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  },
  read: (path) => (existsSync(path) ? readFileSync(path, "utf8") : undefined),
  today: () => new Date().toISOString().slice(0, 10),
  log: (line) => console.log(line),
};

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url))
  process.exitCode = main(process.argv.slice(2), realIo);
