export interface IstanbulLocation {
  start: { line: number };
}

export interface IstanbulFileCoverage {
  path: string;
  statementMap: Record<string, IstanbulLocation>;
  s: Record<string, number>;
}

export type IstanbulCoverage = Record<string, IstanbulFileCoverage>;

export interface DiffCoverageResult {
  checked: Array<{ file: string; line: number }>;
  uncovered: Array<{ file: string; line: number }>;
  missingFiles: string[];
}

const measuredSource = /^(?:src|scripts)\/.*\.(?:[cm]?[jt]sx?)$/;
const generatedOrInfrastructure = new Set([
  "src/routeTree.gen.ts",
  "scripts/check-diff-coverage.mjs",
]);

function normalizePath(file: string): string {
  return file.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isMeasuredSource(file: string): boolean {
  const normalized = normalizePath(file);
  return measuredSource.test(normalized) && !generatedOrInfrastructure.has(normalized);
}

export function parseChangedLines(diff: string): Map<string, Set<number>> {
  const changed = new Map<string, Set<number>>();
  let currentFile: string | undefined;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4);
      currentFile = target === "/dev/null" ? undefined : normalizePath(target.replace(/^b\//, ""));
      continue;
    }

    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!currentFile || !hunk) continue;

    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const lines = changed.get(currentFile) ?? new Set<number>();
    for (let offset = 0; offset < count; offset += 1) lines.add(start + offset);
    changed.set(currentFile, lines);
  }

  return changed;
}

export function assessDiffCoverage(
  changed: Map<string, Set<number>>,
  coverage: IstanbulCoverage,
  cwd: string,
): DiffCoverageResult {
  const byFile = new Map<string, IstanbulFileCoverage>();
  const cwdPrefix = `${normalizePath(cwd).replace(/\/$/, "")}/`;

  for (const fileCoverage of Object.values(coverage)) {
    const absoluteOrRelative = normalizePath(fileCoverage.path);
    const relative = absoluteOrRelative.startsWith(cwdPrefix)
      ? absoluteOrRelative.slice(cwdPrefix.length)
      : absoluteOrRelative;
    byFile.set(relative, fileCoverage);
  }

  const checked: DiffCoverageResult["checked"] = [];
  const uncovered: DiffCoverageResult["uncovered"] = [];
  const missingFiles: string[] = [];

  for (const [file, lines] of [...changed].sort(([left], [right]) => left.localeCompare(right))) {
    if (!isMeasuredSource(file)) continue;
    const fileCoverage = byFile.get(file);
    if (!fileCoverage) {
      missingFiles.push(file);
      continue;
    }

    const hitsByLine = new Map<number, number>();
    for (const [statementId, location] of Object.entries(fileCoverage.statementMap)) {
      const line = location.start.line;
      hitsByLine.set(line, (hitsByLine.get(line) ?? 0) + (fileCoverage.s[statementId] ?? 0));
    }

    for (const line of [...lines].sort((left, right) => left - right)) {
      const hits = hitsByLine.get(line);
      if (hits === undefined) continue;
      const item = { file, line };
      checked.push(item);
      if (hits === 0) uncovered.push(item);
    }
  }

  return { checked, uncovered, missingFiles };
}

export function isCoverageInput(file: string): boolean {
  const normalized = normalizePath(file);
  return (
    isMeasuredSource(normalized) ||
    /^(?:test\/.*\.(?:[cm]?[jt]sx?)|(?:vite|vitest)\.config\.ts|tsconfig\.json|package\.json|bun\.lock)$/.test(
      normalized,
    )
  );
}
