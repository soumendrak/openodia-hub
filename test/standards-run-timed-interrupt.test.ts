import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { bunExecutable } from "./standards/run-timed";
import { killMarked, listedProcesses, processAlive } from "./standards/run-timed-test-util";
import { expect, it } from "vitest";

function killGroup(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      return;
    }
  }
}

async function waitFor(predicate: () => boolean, timeoutMs: number, what: string) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${what}`);
}

it.each(["SIGTERM", "SIGINT"] as const)(
  "leaves no child when the runner is interrupted by %s",
  async (signal) => {
    const mark = `OWNED_TYPES_INTR_${signal}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const runner: ChildProcess = spawn(
      bunExecutable(),
      [join(import.meta.dirname, "standards/run-timed-interrupt-runner.ts")],
      {
        cwd: join(import.meta.dirname, ".."),
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
        env: { ...process.env, OWNED_TYPES_INTR_MARK: mark },
      },
    );
    const pid = runner.pid;
    if (pid === undefined) throw new Error("runner spawned with no pid");
    const childRunning = () => listedProcesses(mark).some((line) => line.includes("while (true)"));
    try {
      await waitFor(childRunning, 5_000, `${mark} child to start`);
      killGroup(pid, signal);
      await waitFor(() => !processAlive(pid), 5_000, `runner ${pid} to exit`);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(listedProcesses(mark)).toEqual([]);
    } finally {
      killMarked(mark);
      killGroup(pid, "SIGKILL");
      await new Promise<void>((resolve) => {
        if (!processAlive(pid)) {
          resolve();
          return;
        }
        runner.once("close", () => resolve());
        setTimeout(() => resolve(), 1_000);
      });
    }
  },
  20_000,
);

it("leaves no child when a hang-test runner is interrupted by SIGINT mid-hang", async () => {
  const mark = `OWNED_TYPES_TIMED_SIGINT_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const runner: ChildProcess = spawn(
    bunExecutable(),
    [join(import.meta.dirname, "standards/run-timed-hang-runner.ts")],
    {
      cwd: join(import.meta.dirname, ".."),
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
      env: { ...process.env, OWNED_TYPES_HANG_MARK: mark },
    },
  );
  const pid = runner.pid;
  if (pid === undefined) throw new Error("runner spawned with no pid");
  const childRunning = () => listedProcesses(mark).length > 0;
  try {
    await waitFor(childRunning, 5_000, `${mark} child to start`);
    killGroup(pid, "SIGINT");
    await waitFor(() => !processAlive(pid), 5_000, `runner ${pid} to exit`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(listedProcesses(mark)).toEqual([]);
  } finally {
    killMarked(mark);
    killGroup(pid, "SIGKILL");
    await new Promise<void>((resolve) => {
      if (!processAlive(pid)) {
        resolve();
        return;
      }
      runner.once("close", () => resolve());
      setTimeout(() => resolve(), 1_000);
    });
  }
}, 20_000);
