import { afterEach, describe, expect, it, vi } from "vitest";

const diffScriptHarness = vi.hoisted(() => ({
  unstaged: "",
  untracked: "",
  diff: "",
  diffStatus: 0 as number | undefined,
  diffStderr: "",
  commandStatus: 0,
  report: {} as Record<string, unknown>,
}));

vi.mock("node:child_process", () => {
  const spawnSync = (command: string, args: string[], options: { stdio: string }) => {
    if (command === "bun")
      return { status: diffScriptHarness.commandStatus, stdout: "", stderr: "" };
    if (args.includes("--name-only"))
      return { status: 0, stdout: diffScriptHarness.unstaged, stderr: "" };
    if (args.includes("ls-files"))
      return { status: 0, stdout: diffScriptHarness.untracked, stderr: "" };
    if (args.includes("--unified=0")) {
      return {
        status: diffScriptHarness.diffStatus,
        stdout: diffScriptHarness.diff,
        stderr: diffScriptHarness.diffStderr,
      };
    }
    return { status: 0, stdout: options.stdio === "pipe" ? "" : undefined, stderr: "" };
  };
  return { default: { spawnSync }, spawnSync };
});
vi.mock("node:fs/promises", () => {
  const readFile = async () => JSON.stringify(diffScriptHarness.report);
  return { default: { readFile }, readFile };
});

describe("changed-line coverage CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    diffScriptHarness.unstaged = "";
    diffScriptHarness.untracked = "";
    diffScriptHarness.diff = "";
    diffScriptHarness.diffStatus = 0;
    diffScriptHarness.diffStderr = "";
    diffScriptHarness.commandStatus = 0;
    diffScriptHarness.report = {};
  });

  const mockExit = () =>
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

  it("validates base arguments and rejects unstaged coverage inputs", async () => {
    const { main } = await import("../scripts/check-diff-coverage.mjs");
    mockExit();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(main(["--base"])).rejects.toThrow("exit:2");

    diffScriptHarness.unstaged = "src/value.ts\nREADME.md\n";
    diffScriptHarness.untracked = "test/value.test.ts\n";
    await expect(main(["--staged"])).rejects.toThrow("exit:1");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("src/value.ts"));
  });

  it("propagates failed coverage commands", async () => {
    const { main } = await import("../scripts/check-diff-coverage.mjs");
    mockExit();
    diffScriptHarness.commandStatus = 7;
    await expect(main(["--base", "main"])).rejects.toThrow("exit:7");
  });

  it("writes captured stderr and exits when a captured git command fails", async () => {
    const { main } = await import("../scripts/check-diff-coverage.mjs");
    mockExit();
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    diffScriptHarness.diffStatus = 128;
    diffScriptHarness.diffStderr = "fatal: bad revision 'main'";
    await expect(main(["--base", "main"])).rejects.toThrow("exit:128");
    expect(stderrWrite).toHaveBeenCalledWith("fatal: bad revision 'main'");
  });

  it("falls back to a default exit code and blank stderr when the failing command omits them", async () => {
    const { main } = await import("../scripts/check-diff-coverage.mjs");
    mockExit();
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    diffScriptHarness.diffStatus = undefined;
    diffScriptHarness.diffStderr = "";
    await expect(main(["--base", "main"])).rejects.toThrow("exit:1");
    expect(stderrWrite).toHaveBeenCalledWith("");
  });

  it("computes the staged diff args and skips the conflict check when nothing is staged", async () => {
    const { main } = await import("../scripts/check-diff-coverage.mjs");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await expect(main(["--staged"])).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("coverage diff: no changed executable lines");
  });

  it("reports missing files and uncovered executable lines", async () => {
    const { main } = await import("../scripts/check-diff-coverage.mjs");
    mockExit();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    diffScriptHarness.diff = "+++ b/src/missing.ts\n@@ -0,0 +1 @@\n+export const x = 1";
    await expect(main(["--base", "main"])).rejects.toThrow("exit:1");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("missing from"));

    diffScriptHarness.diff = "+++ b/src/value.ts\n@@ -0,0 +1 @@\n+export const x = 1";
    diffScriptHarness.report = {
      value: {
        path: "src/value.ts",
        statementMap: { "0": { start: { line: 1 }, end: { line: 1 } } },
        s: { "0": 0 },
      },
    };
    await expect(main(["--base", "main"])).rejects.toThrow("exit:1");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("src/value.ts:1"));
  });

  it("prints both empty and fully covered success summaries", async () => {
    const { main } = await import("../scripts/check-diff-coverage.mjs");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await expect(main(["--base", "main"])).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("coverage diff: no changed executable lines");

    diffScriptHarness.diff = "+++ b/src/value.ts\n@@ -0,0 +1 @@\n+export const x = 1";
    diffScriptHarness.report = {
      value: {
        path: "src/value.ts",
        statementMap: { "0": { start: { line: 1 }, end: { line: 1 } } },
        s: { "0": 1 },
      },
    };
    await expect(main(["--base", "main"])).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("coverage diff: 100% (1/1 changed executable lines)");
  });

  it("runs main() automatically when executed as the entry script", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const previousArgv1 = process.argv[1];
    process.argv[1] = "/path/to/scripts/check-diff-coverage.mjs";
    vi.resetModules();
    try {
      await import("../scripts/check-diff-coverage.mjs");
      expect(log).toHaveBeenCalledWith("coverage diff: no changed executable lines");
    } finally {
      process.argv[1] = previousArgv1;
    }
  });
});
