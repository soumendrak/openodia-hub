import { readFileSync, existsSync } from "node:fs";
import { bunExecutable, ChildTimeoutError, runTimed } from "./standards/run-timed";
import {
  HANG_AWAIT_BOUND_MS,
  HANG_CHILD_DEADLINE_MS,
  HANG_TIMEOUT_MS,
  hungChildArgs,
  killMarked,
  listedProcesses,
  processAlive,
} from "./standards/run-timed-test-util";
import { expect, it } from "vitest";

function uniqueMark(): string {
  return `OWNED_TYPES_TIMED_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function settleOrBound(
  promise: Promise<unknown>,
  boundMs: number,
  label: string,
): Promise<unknown> {
  const timers: ReturnType<typeof setTimeout>[] = [];
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timers.push(
          setTimeout(() => {
            reject(new Error(`${label} did not settle within ${boundMs} ms`));
          }, boundMs),
        );
      }),
    ]);
  } finally {
    for (const timer of timers) clearTimeout(timer);
  }
}

it("resolves bun to the real binary, not a shell wrapper", () => {
  const bun = bunExecutable();
  expect(existsSync(bun)).toBe(true);
  expect(readFileSync(bun).subarray(0, 2).toString()).not.toBe("#!");
});

it("kills a hung child and reports the timeout", async () => {
  const timeoutMs = HANG_TIMEOUT_MS;
  const mark = uniqueMark();
  const started = Date.now();
  let error: unknown;
  try {
    error = await settleOrBound(
      runTimed("bun", hungChildArgs(mark, process.pid, HANG_CHILD_DEADLINE_MS), {
        timeoutMs,
        label: "hung lint child",
      }).then(
        () => undefined,
        (reason: unknown) => reason,
      ),
      HANG_AWAIT_BOUND_MS,
      "hung lint child",
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
    killMarked(mark);
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
