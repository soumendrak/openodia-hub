import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { bunExecutable, ChildTimeoutError, runTimed } from "./standards/run-timed";
import { expect, it } from "vitest";

function uniqueMark(): string {
  return `OWNED_TYPES_TIMED_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function listedProcesses(mark: string, psCommand = "ps"): string[] {
  const out = spawnSync(psCommand, ["-eo", "pid,ppid,pgid,args"], { encoding: "utf8" });
  if (out.error || out.status !== 0) {
    throw new Error(
      `ps failed: ${(out.error?.message ?? out.stderr.trim()) || `status ${out.status}`}`,
    );
  }
  return out.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(mark));
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

it("resolves bun to the real binary, not a shell wrapper", () => {
  const bun = bunExecutable();
  expect(existsSync(bun)).toBe(true);
  expect(readFileSync(bun).subarray(0, 2).toString()).not.toBe("#!");
});

it("kills a hung child and reports the timeout", async () => {
  const timeoutMs = 1_000;
  const mark = uniqueMark();
  const started = Date.now();
  let error: unknown;
  try {
    error = await runTimed(
      "bun",
      [
        "-e",
        `process.on("SIGTERM", () => {}); process.on("SIGINT", () => {}); void ${JSON.stringify(mark)}; while (true) {}`,
      ],
      {
        timeoutMs,
        label: "hung lint child",
      },
    ).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const elapsed = Date.now() - started;
    expect(error).toBeInstanceOf(ChildTimeoutError);
    expect((error as Error).message).toBe(
      `hung lint child timed out after ${timeoutMs} ms and was killed`,
    );
    const pid = (error as ChildTimeoutError).pid;
    if (typeof pid !== "number") throw new Error("expected a numeric pid");
    expect(processAlive(pid)).toBe(false);
    expect(listedProcesses(mark)).toEqual([]);
    expect(elapsed).toBeGreaterThan(timeoutMs * 0.5);
    expect(elapsed).toBeLessThan(timeoutMs * 3);
  } finally {
    for (const line of listedProcesses(mark)) {
      const childPid = Number(line.split(/\s+/)[0]);
      if (childPid) {
        try {
          process.kill(childPid, "SIGKILL");
        } catch {
          continue;
        }
      }
    }
  }
});

it("fails when it cannot list processes", () => {
  expect(() => listedProcesses("OWNED_TYPES_TIMED_unused", "ps-not-installed")).toThrow(
    /ps failed/,
  );
});

it("reports a missing binary", async () => {
  const error = await runTimed("/this/binary/does-not-exist-owned-types-timeout", [], {
    timeoutMs: 1_000,
    label: "missing binary",
  }).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toMatchObject({ code: "ENOENT" });
});

it("returns stdout from a child that finishes in time", async () => {
  const run = await runTimed("bun", ["-e", 'process.stdout.write("ok\\n")'], {
    timeoutMs: 5_000,
    label: "timely child",
  });
  expect(run.status).toBe(0);
  expect(run.signal).toBeNull();
  expect(run.stdout).toBe("ok\n");
});
