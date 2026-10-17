import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("standards CLI entry", () => {
  const argv = process.argv;
  afterEach(() => {
    process.argv = argv;
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it("runs main with the real process when invoked as a script", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    process.argv = [argv[0] ?? "bun", resolve("scripts", "standards.ts"), "--nope"];
    await import("../scripts/standards");
    expect(log).toHaveBeenCalledWith(
      "standards: usage: bun scripts/standards.ts [--staged | --base <rev>]",
    );
    expect(process.exitCode).toBe(2);
  });

  it("wires real process, file and clock access", async () => {
    const { realIo } = await import("../scripts/standards");
    expect(realIo.run("git", ["--version"], true).stdout).toMatch(/^git version/);
    expect(realIo.run("git", ["--no-such-flag"], true).status).not.toBe(0);
    expect(realIo.run("git", ["--version"], false)).toEqual({ status: 0, stdout: "", stderr: "" });
    expect(realIo.run("sh", ["-c", "kill -9 $$"], true).status).toBe(1);
    expect(realIo.read("package.json")).toContain('"name"');
    expect(realIo.read("does-not-exist.json")).toBeUndefined();
    expect(realIo.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    realIo.log("hello");
    expect(log).toHaveBeenCalledWith("hello");
  });
});

describe("standards CLI entry guard", () => {
  it("does not run main for a same-suffix path or a missing script path", async () => {
    const argv = process.argv;
    process.argv = [argv[0] ?? "bun", "/elsewhere/scripts/standards.ts", "--nope"];
    vi.resetModules();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await import("../scripts/standards");
    process.argv = [argv[0] ?? "bun"];
    vi.resetModules();
    await import("../scripts/standards");
    expect(log).not.toHaveBeenCalled();
    process.argv = argv;
    vi.restoreAllMocks();
  });
});
