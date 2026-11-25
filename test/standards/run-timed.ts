import { spawn, spawnSync } from "node:child_process";

export class ChildTimeoutError extends Error {
  readonly pid: number | undefined;
  constructor(message: string, pid: number | undefined) {
    super(message);
    this.name = "ChildTimeoutError";
    this.pid = pid;
  }
}

export type TimedRun = {
  stdout: string;
  status: number | null;
  signal: NodeJS.Signals | null;
};

export const LINT_FILE_TIMEOUT_MS = 60_000;

export function bunExecutable(): string {
  if (process.versions["bun"]) return process.execPath;
  const out = spawnSync("bun", ["-e", "process.stdout.write(process.execPath)"], {
    encoding: "utf8",
  });
  if (out.error || out.status !== 0 || !out.stdout.trim()) {
    throw new Error(
      `could not resolve bun executable: ${(out.error?.message ?? out.stderr) || out.status}`,
    );
  }
  return out.stdout.trim();
}

function commandToSpawn(command: string): string {
  return command === "bun" ? bunExecutable() : command;
}

export function runTimed(
  command: string,
  args: readonly string[],
  options: { cwd?: string; timeoutMs: number; label: string },
): Promise<TimedRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(commandToSpawn(command), [...args], {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    child.on("error", (error) => {
      finish(() => reject(error));
    });
    const pid = child.pid;
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.on("close", (status, signal) => {
      finish(() => {
        if (timedOut) {
          reject(
            new ChildTimeoutError(
              `${options.label} timed out after ${options.timeoutMs} ms and was killed`,
              pid,
            ),
          );
          return;
        }
        resolve({ stdout, status, signal });
      });
    });
  });
}
