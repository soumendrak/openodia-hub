#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  assessDiffCoverage,
  isCoverageInput,
  parseChangedLines,
} from "../src/lib/diff-coverage.ts";

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    if (options.capture) process.stderr.write(result.stderr || "");
    process.exit(result.status ?? 1);
  }
  return result.stdout || "";
}

function gitDiff(extraArgs) {
  return run("git", ["diff", ...extraArgs], { capture: true });
}

export async function main(args = process.argv.slice(2)) {
  const baseIndex = args.indexOf("--base");
  const base = baseIndex >= 0 ? args[baseIndex + 1] : undefined;
  const staged = args.includes("--staged") || !base;

  if (baseIndex >= 0 && !base) {
    console.error("coverage diff: --base requires a Git revision");
    process.exit(2);
  }

  if (staged) {
    const unstaged = new Set(
      [
        ...gitDiff(["--name-only"]).split("\n"),
        ...run("git", ["ls-files", "--others", "--exclude-standard"], { capture: true }).split(
          "\n",
        ),
      ].filter(Boolean),
    );
    const conflicting = [...unstaged].filter(isCoverageInput).sort();
    if (conflicting.length > 0) {
      console.error(
        `coverage diff: stage or stash coverage-affecting files before committing:\n${conflicting
          .map((file) => `  ${file}`)
          .join("\n")}`,
      );
      process.exit(1);
    }
  }

  const diffArgs = staged
    ? ["--cached", "--unified=0", "--diff-filter=ACMR"]
    : [base, "--unified=0", "--diff-filter=ACMR"];
  const changed = parseChangedLines(gitDiff(diffArgs));

  run("bun", [
    "x",
    "vitest",
    "run",
    "--coverage",
    "--coverage.reporter=json",
    "--coverage.reporter=text-summary",
  ]);

  const report = JSON.parse(await readFile("coverage/coverage-final.json", "utf8"));
  const result = assessDiffCoverage(changed, report, process.cwd());

  if (result.missingFiles.length > 0) {
    console.error(
      `coverage diff: changed source files are missing from the coverage report:\n${result.missingFiles
        .map((file) => `  ${file}`)
        .join("\n")}`,
    );
    process.exit(1);
  }

  if (result.uncovered.length > 0) {
    console.error(
      `coverage diff: ${result.uncovered.length} changed executable line(s) are not covered:\n${result.uncovered
        .map(({ file, line }) => `  ${file}:${line}`)
        .join("\n")}`,
    );
    process.exit(1);
  }

  console.log(
    result.checked.length === 0
      ? "coverage diff: no changed executable lines"
      : `coverage diff: 100% (${result.checked.length}/${result.checked.length} changed executable lines)`,
  );
}

if (process.argv[1]?.endsWith("check-diff-coverage.mjs")) {
  await main();
}
