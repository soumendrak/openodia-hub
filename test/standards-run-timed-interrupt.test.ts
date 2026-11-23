import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { bunExecutable } from "./standards/run-timed";
import { expect, it } from "vitest";

function listedProcesses(mark: string): string[] {
  const out = spawnSync("ps", ["-eo", "pid,ppid,pgid,args"], { encoding: "utf8" });
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
