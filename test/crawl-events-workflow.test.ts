import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("crawl-events workflow", () => {
  it("publishes changes before propagating a crawler failure", async () => {
    const workflow = await readFile(
      join(process.cwd(), ".github/workflows/crawl-events.yml"),
      "utf8",
    );
    const stepStart = workflow.indexOf("      - name: Crawl events");
    const stepEnd = workflow.indexOf("      - name:", stepStart + 1);
    const step = workflow.slice(stepStart, stepEnd);
    const runMarker = "        run: |\n";
    const script = step
      .slice(step.indexOf(runMarker) + runMarker.length)
      .split("\n")
      .map((line) => line.replace(/^ {10}/, ""))
      .join("\n");

    const directory = await mkdtemp(join(tmpdir(), "crawl-events-workflow-"));
    temporaryDirectories.push(directory);
    const binDirectory = join(directory, "bin");
    const crawlOutput = join(directory, "crawl-output.txt");
    const githubOutput = join(directory, "github-output.txt");
    const fakeBun = join(binDirectory, "bun");
    await mkdir(binDirectory);
    await writeFile(fakeBun, "#!/usr/bin/env bash\nprintf 'NEW_EVENTS_FOUND\\n'\nexit 23\n");
    await chmod(fakeBun, 0o755);

    const result = spawnSync(
      "bash",
      ["-e", "-o", "pipefail", "-c", script.replaceAll("/tmp/crawl-output.txt", crawlOutput)],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_OUTPUT: githubOutput,
          PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
        },
      },
    );

    expect(result.status).toBe(23);
    await expect(readFile(githubOutput, "utf8")).resolves.toBe("has_changes=1\n");
  });
});
