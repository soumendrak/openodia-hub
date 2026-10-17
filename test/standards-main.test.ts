import { describe, expect, it } from "vitest";
import { main, type Io } from "../scripts/standards";
import { ZIZMOR_VERSION } from "../scripts/standards/zizmor";

type Call = { command: string; args: readonly string[] };

const exceptionsFile = JSON.stringify({ exceptions: [] });
const zizmorFinding = {
  ident: "dangerous-triggers",
  desc: "use of fundamentally insecure workflow trigger",
  determinations: { severity: "High" },
  locations: [
    {
      symbolic: { key: { Local: { verbatim_path: ".github/workflows/x.yml" } }, kind: "Primary" },
      concrete: { location: { start_point: { row: 2 } } },
    },
  ],
  ignored: false,
};

function fakeIo(options: {
  diff?: string;
  names?: string;
  status?: string;
  files?: Record<string, string>;
  staged?: Record<string, string>;
  untracked?: string;
  failing?: string[];
  mergeBase?: number;
  zizmorVersion?: string;
  zizmorOutput?: string;
  exceptions?: string | null;
}) {
  const calls: Call[] = [];
  const lines: string[] = [];
  const files: Record<string, string> = {
    ...options.files,
  };
  if (options.exceptions !== null)
    files["scripts/standards/exceptions.json"] = options.exceptions ?? exceptionsFile;
  const io: Io = {
    run(command, args) {
      calls.push({ command, args });
      const joined = [command, ...args].join(" ");
      const ok = (stdout: string) => ({ status: 0, stdout, stderr: "" });
      if (joined.startsWith("git merge-base"))
        return { status: options.mergeBase ?? 0, stdout: "abc123\n", stderr: "no ref" };
      if (joined.startsWith("git diff") && args.includes("--name-only"))
        return ok(options.names ?? "");
      if (joined.startsWith("git diff")) return ok(options.diff ?? "");
      if (joined.startsWith("git status")) return ok(options.status ?? "");
      if (joined.startsWith("git ls-files")) return ok(options.untracked ?? "");
      if (joined.startsWith("git show :")) {
        const index: Record<string, string> = {
          "scripts/standards/exceptions.json": exceptionsFile,
          ...options.staged,
        };
        const content = index[args[1]?.slice(1) ?? ""];
        return content === undefined ? { status: 128, stdout: "", stderr: "" } : ok(content);
      }
      if (joined === "zizmor --version")
        return ok(options.zizmorVersion ?? `zizmor ${ZIZMOR_VERSION}\n`);
      if (command === "zizmor")
        return { status: 14, stdout: options.zizmorOutput ?? "[]", stderr: "boom" };
      return {
        status: options.failing?.some((name) => joined.includes(name)) ? 1 : 0,
        stdout: "",
        stderr: "",
      };
    },
    read: (path) => files[path],
    today: () => "2026-10-17",
    log: (line) => lines.push(line),
  };
  return { io, calls, lines };
}

const diffFor = (file: string, start: number, count: number) =>
  `diff --git a/${file} b/${file}\n+++ b/${file}\n@@ -0,0 +${start},${count} @@\n`;

describe("standards entry point", () => {
  it("prints the pinned zizmor version", () => {
    const { io, lines } = fakeIo({});
    expect(main(["zizmor-version"], io)).toBe(0);
    expect(lines).toEqual([ZIZMOR_VERSION]);
  });

  it("rejects unknown arguments", () => {
    const { io, lines } = fakeIo({});
    expect(main(["--nope"], io)).toBe(2);
    expect(lines).toEqual(["standards: usage: bun scripts/standards.ts [--staged | --base <rev>]"]);
    expect(main(["--base"], io)).toBe(2);
  });

  it("runs every step against the merge base by default and passes", () => {
    const { io, calls, lines } = fakeIo({});
    expect(main([], io)).toBe(0);
    expect(calls.map((call) => [call.command, ...call.args].join(" "))).toEqual([
      "git merge-base origin/main HEAD",
      "git diff abc123 --unified=0 --diff-filter=ACMR",
      "git ls-files --others --exclude-standard",
      "git diff abc123 --name-only --diff-filter=ACMR",
      "bun run check:locales",
      "bun run lint",
      "bun run typecheck",
      "bun run test:coverage:diff -- --base abc123",
    ]);
    expect(lines.at(-1)).toBe("STANDARDS OK");
    expect(lines).toContain("zizmor: skipped, no workflow or standards changes");
  });

  it("fails when the merge base cannot be found", () => {
    const { io, lines } = fakeIo({ mergeBase: 1 });
    expect(main([], io)).toBe(2);
    expect(lines).toEqual([
      "standards: cannot find the merge base of origin/main and HEAD: no ref",
    ]);
  });

  it("reports each failing tool and keeps running the rest", () => {
    const { io, lines } = fakeIo({ failing: ["lint", "test:coverage:diff"] });
    expect(main(["--base", "main"], io)).toBe(1);
    expect(lines).toEqual(
      expect.arrayContaining([
        "FAIL lint",
        "PASS typecheck",
        "FAIL tests and 100% changed-line coverage",
        "STANDARDS FAIL",
      ]),
    );
  });

  it("blocks a comment added to a tracked file, replaying PR #156's trailing-comment case", () => {
    const { io, lines } = fakeIo({
      diff: diffFor("src/a.ts", 1, 1),
      files: { "src/a.ts": "export const a = 1; // narration\n" },
    });
    expect(main(["--base", "main"], io)).toBe(1);
    expect(lines).toEqual(
      expect.arrayContaining([
        "src/a.ts:1 no-new-comments new comment on line 1",
        "FAIL no new comments",
      ]),
    );
  });

  it("scans untracked files in full and skips deleted ones", () => {
    const { io, lines } = fakeIo({
      untracked: "src/new.ts\nsrc/gone.ts\nREADME.md\n",
      files: { "src/new.ts": "export {};\n// added\n" },
    });
    expect(main(["--base", "main"], io)).toBe(1);
    expect(lines).toContain("src/new.ts:2 no-new-comments new comment on line 2");
  });

  it("reads staged content in staged mode", () => {
    const { io, calls, lines } = fakeIo({
      diff: diffFor("src/a.ts", 1, 1) + diffFor("src/b.ts", 1, 1),
      staged: { "src/a.ts": "export const a = 1;\n" },
      files: { "src/a.ts": "export const a = 1; // unstaged\n" },
    });
    expect(main(["--staged"], io)).toBe(0);
    expect(calls.map((call) => call.args.join(" "))).toContain(
      "diff --cached --unified=0 --diff-filter=ACMR",
    );
    expect(calls.map((call) => call.args.join(" "))).toContain(
      "run test:coverage:diff -- --staged",
    );
    expect(lines).toContain("PASS no new comments");
  });

  it("allows a comment listed in the exceptions file", () => {
    const exceptions = JSON.stringify({
      exceptions: [
        {
          rule: "no-new-comments",
          file: "src/a.ts",
          limit: 1,
          reason: "License header.",
          expires: "2027-01-17",
          approvedBy: "soumendrak",
        },
      ],
    });
    const { io } = fakeIo({
      exceptions,
      diff: diffFor("src/a.ts", 1, 1),
      files: { "src/a.ts": "// MIT\nexport {};\n" },
    });
    expect(main(["--base", "main"], io)).toBe(0);
  });

  it("fails on an expired exception", () => {
    const exceptions = JSON.stringify({
      exceptions: [
        {
          rule: "no-new-comments",
          file: "src/a.ts",
          limit: 1,
          reason: "License header.",
          expires: "2026-01-01",
          approvedBy: "soumendrak",
        },
      ],
    });
    const { io, lines } = fakeIo({ exceptions });
    expect(main(["--base", "main"], io)).toBe(1);
    expect(lines).toContain("no-new-comments in src/a.ts: exception expired on 2026-01-01");
  });

  it("fails on a malformed or missing exceptions file", () => {
    expect(main(["--base", "main"], fakeIo({ exceptions: "{" }).io)).toBe(1);
    expect(main(["--base", "main"], fakeIo({ exceptions: null }).io)).toBe(1);
    const { io, lines } = fakeIo({ exceptions: JSON.stringify({ exceptions: [{ rule: "x" }] }) });
    expect(main(["--base", "main"], io)).toBe(1);
    expect(lines).toContain("FAIL exceptions file");
  });

  it("runs zizmor when a workflow changes and blocks new findings, replaying PR #134's trigger", () => {
    const { io, calls, lines } = fakeIo({
      names: ".github/workflows/x.yml\n",
      zizmorOutput: JSON.stringify([zizmorFinding]),
    });
    expect(main(["--base", "main"], io)).toBe(1);
    expect(calls.map((call) => [call.command, ...call.args].join(" "))).toContain(
      "zizmor --offline --no-ignores --no-config --collect=all --strict-collection --format json .github",
    );
    expect(lines).toEqual(
      expect.arrayContaining([
        ".github/workflows/x.yml:3 zizmor/dangerous-triggers High: use of fundamentally insecure workflow trigger",
        "FAIL zizmor",
      ]),
    );
  });

  it("fails when zizmor is missing, the wrong version, or prints no JSON", () => {
    const names = "scripts/standards/zizmor.ts\n";
    const wrong = fakeIo({ names, zizmorVersion: `zizmor ${ZIZMOR_VERSION}0` });
    expect(main(["--base", "main"], wrong.io)).toBe(1);
    expect(wrong.lines).toContain(
      `zizmor ${ZIZMOR_VERSION} is required: pipx install zizmor==${ZIZMOR_VERSION}`,
    );
    const broken = fakeIo({ names, zizmorOutput: "not json" });
    expect(main(["--base", "main"], broken.io)).toBe(1);
    expect(broken.lines).toContain("zizmor: boom");
  });

  it("runs zizmor for a workflow that only moved untracked into place", () => {
    const { io, calls } = fakeIo({
      untracked: ".github/workflows/new.yml\n",
      files: { ".github/workflows/new.yml": "on: push\n" },
    });
    expect(main(["--base", "main"], io)).toBe(0);
    expect(calls.some((call) => call.command === "zizmor" && call.args.includes(".github"))).toBe(
      true,
    );
  });

  it("refuses staged mode while the worktree differs from the index", () => {
    const { io, calls, lines } = fakeIo({
      status: "MM .github/workflows/x.yml\n?? eslint.local.js\nM  src/ok.ts\n",
    });
    expect(main(["--staged"], io)).toBe(1);
    expect(calls.map((call) => [call.command, ...call.args].join(" "))).toEqual([
      "git status --porcelain --untracked-files=all",
    ]);
    expect(lines).toEqual([
      "standards: stage or stash these changes first: .github/workflows/x.yml, eslint.local.js",
    ]);
  });

  it("audits staged .github when the worktree matches the index", () => {
    const { io, lines } = fakeIo({
      names: ".github/workflows/x.yml\n",
      status: "M  .github/workflows/x.yml\n",
    });
    expect(main(["--staged"], io)).toBe(0);
    expect(lines).toContain("PASS zizmor");
  });

  it("applies the staged exceptions file in staged mode", () => {
    const { io, lines } = fakeIo({
      staged: { "scripts/standards/exceptions.json": "{" },
    });
    expect(main(["--staged"], io)).toBe(1);
    expect(lines).toContain("FAIL exceptions file");
  });
});
