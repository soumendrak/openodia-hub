import { spawnSync } from "node:child_process";
import { join } from "node:path";

export const HANG_TIMEOUT_MS = 1_000;
export const HANG_CHILD_DEADLINE_MS = 5_000;
export const HANG_AWAIT_BOUND_MS = 4_000;

export function listedProcesses(mark: string, psCommand = "ps"): string[] {
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

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killMarked(mark: string): void {
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

export function hungChildArgs(mark: string, parentPid: number, deadlineMs: number): string[] {
  return [
    join(import.meta.dirname, "run-timed-hang-child.ts"),
    mark,
    String(parentPid),
    String(deadlineMs),
  ];
}
