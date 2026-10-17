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
      concrete: { location: { start_point: { row: 2 } }, feature: "pull_request_target" },
    },
  ],
  ignored: false,
};

function fakeIo(options: {
  diff?: string;
  names?: string;
  audited?: string;
  status?: string;
  files?: Record<string, string>;
  staged?: Record<string, string>;
  before?: Record<string, string>;
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
      const plain = args[0] === "-c" ? args.slice(2) : args;
      const joined = [command, ...plain].join(" ");
      const ok = (stdout: string) => ({ status: 0, stdout, stderr: "" });
      if (joined.startsWith("git merge-base"))
        return { status: options.mergeBase ?? 0, stdout: "abc123\n", stderr: "no ref" };
      if (joined.startsWith("git diff") && plain.includes("--name-only"))
        return ok(options.names ?? "");
      if (joined.startsWith("git diff")) return ok(options.diff ?? "");
      if (joined.startsWith("git status")) return ok(options.status ?? "");
      if (joined.startsWith("git ls-files"))
        return ok(options.audited ?? ".github/workflows/x.yml\0");
      if (joined.startsWith("git show") && !joined.startsWith("git show :")) {
        const content = options.before?.[plain[1]?.split(":")[1] ?? ""];
        return content === undefined ? { status: 128, stdout: "", stderr: "" } : ok(content);
      }
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
      "git status --porcelain --untracked-files=all",
      "git -c core.quotePath=false diff abc123 --unified=0 -M --diff-filter=ACMR",
      "git -c core.quotePath=false diff abc123 --name-only -z --diff-filter=ACMRD",
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

  it("refuses untracked files in base mode so every check can see them", () => {
    const { io, lines } = fakeIo({ status: "?? src/new.ts\n M src/edited.ts\n" });
    expect(main(["--base", "main"], io)).toBe(1);
    expect(lines).toEqual(["standards: stage or stash these changes first: src/new.ts"]);
  });

  it("keeps an existing trailing comment when only the code beside it changes", () => {
    const { io, calls, lines } = fakeIo({
      diff: diffFor("src/a.ts", 1, 1) + diffFor("README.md", 1, 1),
      files: { "src/a.ts": "export const a = 2; // default\n" },
      before: { "src/a.ts": "export const a = 1; // default\n" },
    });
    expect(main(["--base", "main"], io)).toBe(0);
    expect(calls.map((call) => call.args.join(" "))).toContain("show main:src/a.ts");
    expect(calls.map((call) => call.args.join(" "))).not.toContain("show main:README.md");
    expect(lines).toContain("PASS no new comments");
  });

  it("compares staged edits against HEAD", () => {
    const { io, calls } = fakeIo({
      diff: diffFor("src/a.ts", 1, 1),
      staged: { "src/a.ts": "export const a = 2; // default\n" },
      before: { "src/a.ts": "export const a = 1; // default\n" },
    });
    expect(main(["--staged"], io)).toBe(0);
    expect(calls.map((call) => call.args.join(" "))).toContain("show HEAD:src/a.ts");
  });

  it("runs zizmor for a workflow whose name git would quote", () => {
    const { io, calls } = fakeIo({ names: "src/a.ts\0.github/workflows/ପରୀକ୍ଷା.yml\0" });
    expect(main(["--base", "main"], io)).toBe(0);
    expect(calls.some((call) => call.command === "zizmor" && call.args.includes("json"))).toBe(
      true,
    );
  });

  it("refuses paths that git quotes even with core.quotePath off", () => {
    const { io, lines } = fakeIo({ names: 'src/a"b.ts\0src/ok.ts\0src/tab\there.ts\0' });
    expect(main(["--base", "main"], io)).toBe(1);
    expect(lines).toEqual([
      'standards: rename paths that git quotes: src/a"b.ts, src/tab\there.ts',
    ]);
  });

  it("reads staged content in staged mode", () => {
    const { io, calls, lines } = fakeIo({
      diff: diffFor("src/a.ts", 1, 1) + diffFor("src/b.ts", 1, 1),
      staged: { "src/a.ts": "export const a = 1;\n" },
      files: { "src/a.ts": "export const a = 1; // unstaged\n" },
    });
    expect(main(["--staged"], io)).toBe(0);
    expect(calls.map((call) => call.args.join(" "))).toContain(
      "-c core.quotePath=false diff --cached --unified=0 -M --diff-filter=ACMR",
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
          findings: ["// MIT"],
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
          findings: ["// MIT"],
          reason: "License header.",
          expires: "2026-01-01",
          approvedBy: "soumendrak",
        },
      ],
    });
    const { io, lines } = fakeIo({ exceptions });
    expect(main(["--base", "main"], io)).toBe(1);
    expect(lines).toContain("no-new-comments in src/a.ts: exception expired on 2026-01-01");
    expect(lines).toContain("FAIL exceptions file");
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
      names: ".github/workflows/x.yml\0",
      zizmorOutput: JSON.stringify([zizmorFinding]),
    });
    expect(main(["--base", "main"], io)).toBe(1);
    expect(calls.map((call) => [call.command, ...call.args].join(" "))).toContain(
      "zizmor --offline --no-ignores --no-config --strict-collection --format json .github/workflows/x.yml",
    );
    expect(lines).toEqual(
      expect.arrayContaining([
        ".github/workflows/x.yml:3 zizmor/dangerous-triggers High: use of fundamentally insecure workflow trigger",
        "FAIL zizmor",
      ]),
    );
  });

  it("fails when zizmor is missing, the wrong version, or prints no JSON", () => {
    const names = "scripts/standards/zizmor.ts\0";
    const wrong = fakeIo({ names, zizmorVersion: `zizmor ${ZIZMOR_VERSION}0` });
    expect(main(["--base", "main"], wrong.io)).toBe(1);
    expect(wrong.lines).toContain(
      `zizmor ${ZIZMOR_VERSION} is required: pipx install zizmor==${ZIZMOR_VERSION}`,
    );
    const broken = fakeIo({ names, zizmorOutput: "not json" });
    expect(main(["--base", "main"], broken.io)).toBe(1);
    expect(broken.lines).toContain("zizmor: boom");
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
      names: ".github/workflows/x.yml\0",
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

  it("compares a renamed file against its old path", () => {
    const { io, calls, lines } = fakeIo({
      diff:
        "diff --git a/src/old.ts b/src/a.ts\nrename from src/old.ts\nrename to src/a.ts\n" +
        diffFor("src/a.ts", 1, 1),
      files: { "src/a.ts": "export const a = 2; // default\n" },
      before: { "src/old.ts": "export const a = 1; // default\n" },
    });
    expect(main(["--base", "main"], io)).toBe(0);
    expect(calls.map((call) => call.args.join(" "))).toContain("show main:src/old.ts");
    expect(lines).toContain("PASS no new comments");
  });

  it("audits local composite actions alongside the workflows", () => {
    const { io, calls } = fakeIo({
      names: "actions/release/action.yml\0",
      audited: ".github/workflows/x.yml\0actions/release/action.yml\0",
    });
    expect(main(["--base", "main"], io)).toBe(0);
    const joined = calls.map((call) => [call.command, ...call.args].join(" "));
    expect(joined).toContain(
      "git ls-files -z -- .github/workflows/*.yml .github/workflows/*.yaml .github/dependabot.yml :(glob)**/action.yml :(glob)**/action.yaml",
    );
    expect(joined.find((call) => call.startsWith("zizmor --offline"))).toMatch(
      / \.github\/workflows\/x\.yml actions\/release\/action\.yml$/,
    );
  });

  it("fails on zizmor exceptions that no longer match and ignores other rules' entries", () => {
    const base = { reason: "Baseline.", expires: "2027-01-17", approvedBy: "soumendrak" };
    const comment = { ...base, rule: "no-new-comments", file: "src/a.ts", findings: ["// MIT"] };
    const trigger = { ...base, rule: "zizmor/dangerous-triggers", file: ".github/workflows/x.yml" };
    const matching = fakeIo({
      names: ".github/workflows/x.yml\0",
      zizmorOutput: JSON.stringify([zizmorFinding]),
      exceptions: JSON.stringify({
        exceptions: [comment, { ...trigger, findings: ["pull_request_target"] }],
      }),
    });
    expect(main(["--base", "main"], matching.io)).toBe(0);
    const stale = fakeIo({
      names: ".github/workflows/x.yml\0",
      exceptions: JSON.stringify({ exceptions: [{ ...trigger, findings: ["workflow_run"] }] }),
    });
    expect(main(["--base", "main"], stale.io)).toBe(1);
    expect(stale.lines).toEqual(
      expect.arrayContaining([
        "zizmor/dangerous-triggers in .github/workflows/x.yml: no longer found, remove from scripts/standards/exceptions.json: workflow_run",
        "FAIL zizmor",
      ]),
    );
  });
});
