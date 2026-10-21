import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const DRIVE = ".agents/skills/verify-openodia-hub/scripts/drive.mjs";
const folders: string[] = [];

const drive = (...steps: string[]) => {
  const evidence = mkdtempSync(join(tmpdir(), "drive-steps-"));
  folders.push(evidence);
  const result = spawnSync("node", [DRIVE, "/", ...steps], {
    encoding: "utf8",
    env: { ...process.env, VERIFY_PORT: "1", VERIFY_EVIDENCE: evidence },
  });
  return { status: result.status, summary: JSON.parse(result.stdout) };
};

describe("drive.mjs step arguments", () => {
  afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });

  it.each(["expect:", "expect:   ", "click:", "link:", "press:"])(
    "rejects %j before opening a browser",
    (step) => {
      const { status, summary } = drive("expect:Sua", step);
      expect(status).toBe(1);
      expect(summary.ok).toBe(false);
      expect(summary.failed).toEqual({ step, error: `${step.split(":")[0]}: needs text` });
      expect(summary.url).toBeNull();
    },
  );
});
