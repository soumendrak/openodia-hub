import { spawn } from "node:child_process";

export class ChildTimeoutError extends Error {
  readonly pid: number | undefined;
  constructor(message: string, pid?: number) {
    super(message);
    this.name = "ChildTimeoutError";
    this.pid = pid;
  }
}

export type TimedRun = {
  stdout: string;
  stderr: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  pid: number | undefined;
};

export const LINT_FILE_TIMEOUT_MS = 60_000;

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killProcessGroup(pid: number) {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      return;
    }
  }
}

export function runTimed(
  command: string,
  args: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs: number; label?: string },
): Promise<TimedRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const pid = child.pid;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const name = options.label ?? `${command} ${args.join(" ")}`;
    const onExit = () => {
      if (pid !== undefined) killProcessGroup(pid);
    };
    process.once("exit", onExit);
    let followUp: ReturnType<typeof setTimeout> | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (followUp !== undefined) clearTimeout(followUp);
      process.removeListener("exit", onExit);
      fn();
    };
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      timedOut = true;
      if (pid !== undefined) killProcessGroup(pid);
      followUp = setTimeout(() => {
        if (pid !== undefined) killProcessGroup(pid);
        finish(() =>
          reject(
            new ChildTimeoutError(
              `${name} timed out after ${options.timeoutMs} ms and was killed`,
              pid,
            ),
          ),
        );
      }, 1_000);
    }, options.timeoutMs);
    child.on("error", (error) => {
      finish(() => reject(error));
    });
    child.on("close", (status, signal) => {
      finish(() => {
        if (timedOut) {
          reject(
            new ChildTimeoutError(
              `${name} timed out after ${options.timeoutMs} ms and was killed`,
              pid,
            ),
          );
          return;
        }
        resolve({ stdout, stderr, status, signal, pid });
      });
    });
  });
}
