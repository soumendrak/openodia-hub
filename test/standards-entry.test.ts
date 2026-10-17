import { afterEach, describe, expect, it, vi } from "vitest";
import { ZIZMOR_VERSION } from "../scripts/standards/zizmor";

describe("standards CLI entry", () => {
  const argv = process.argv;
  afterEach(() => {
    process.argv = argv;
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it("runs main with the real process when invoked as a script", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    process.argv = [argv[0] ?? "bun", "/repo/scripts/standards.ts", "zizmor-version"];
    await import("../scripts/standards");
    expect(log).toHaveBeenCalledWith(ZIZMOR_VERSION);
    expect(process.exitCode).toBe(0);
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
