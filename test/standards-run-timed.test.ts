import { spawnSync } from "node:child_process";
import { ChildTimeoutError, processAlive, runTimed } from "./standards/run-timed";
import { expect, it } from "vitest";

const MARK = "OWNED_TYPES_TIMED_CHILD_MARK";

function markedProcesses(): string[] {
  const out = spawnSync("ps", ["-eo", "pid,ppid,pgid,args"], { encoding: "utf8" });
  return (out.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(MARK) && !line.includes("standards-run-timed"));
}

it("kills a hung child process group and reports the timeout", async () => {
  const timeoutMs = 1_000;
  const error = await runTimed(
    "bun",
    [
      "-e",
      `process.on("SIGTERM", () => {}); process.on("SIGINT", () => {}); var ${MARK} = 1; while (true) {}`,
    ],
    {
      timeoutMs,
      label: "hung lint child",
    },
  ).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ChildTimeoutError);
  expect((error as Error).message).toBe(
    `hung lint child timed out after ${timeoutMs} ms and was killed`,
  );
  if (error instanceof ChildTimeoutError && error.pid !== undefined) {
    expect(processAlive(error.pid)).toBe(false);
  }
  expect(markedProcesses()).toEqual([]);
});

it("reports a missing binary", async () => {
  const error = await runTimed("/this/binary/does-not-exist-owned-types-timeout", [], {
    timeoutMs: 1_000,
  }).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toMatchObject({ code: "ENOENT" });
});

it("returns stdout from a child that finishes in time", async () => {
  const run = await runTimed("bun", ["-e", 'process.stdout.write("ok\\n")'], {
    timeoutMs: 5_000,
  });
  expect(run.status).toBe(0);
  expect(run.signal).toBeNull();
  expect(run.stdout).toBe("ok\n");
});
