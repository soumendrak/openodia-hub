import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

const stepScript = (workflow: string, name: string) => {
  const stepStart = workflow.indexOf(`      - name: ${name}\n`);
  const stepEnd = workflow.indexOf("      - name:", stepStart + 1);
  const step = workflow.slice(stepStart, stepEnd);
  const runMarker = step.includes("        run: |\n") ? "        run: |\n" : "        run: ";
  return step
    .slice(step.indexOf(runMarker) + runMarker.length)
    .split("\n")
    .map((line) => line.replace(/^ {10}/, ""))
    .join("\n");
};

const readWorkflow = () =>
  readFile(join(process.cwd(), ".github/workflows/crawl-events.yml"), "utf8");

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

  it("titles the crawl PR with a date computed by a shell step", async () => {
    const workflow = await readWorkflow();
    const directory = await mkdtemp(join(tmpdir(), "crawl-events-title-"));
    temporaryDirectories.push(directory);
    const githubOutput = join(directory, "github-output.txt");

    const result = spawnSync("bash", ["-e", "-c", stepScript(workflow, "Date for the PR title")], {
      encoding: "utf8",
      env: { ...process.env, GITHUB_OUTPUT: githubOutput, LC_ALL: "C", TZ: "UTC" },
    });

    expect(result.status).toBe(0);
    await expect(readFile(githubOutput, "utf8")).resolves.toMatch(/^today=[A-Z][a-z]{2} \d{2}\n$/);
    const titles = workflow.split("\n").filter((line) => line.trim().startsWith("title:"));
    expect(titles).toEqual([
      '          title: "Odia AI event data updated — ${{ steps.date.outputs.today }}"',
    ]);
  });

  it("formats crawled event data with prettier before the PR commit", async () => {
    const workflow = await readWorkflow();
    expect(workflow.indexOf("      - name: Format crawled event data")).toBeGreaterThan(
      workflow.indexOf("      - name: Crawl events"),
    );
    expect(workflow.indexOf("      - name: Format crawled event data")).toBeLessThan(
      workflow.indexOf("      - name: Create PR if event data changed"),
    );

    const directory = await mkdtemp(join(tmpdir(), "crawl-events-format-"));
    temporaryDirectories.push(directory);
    await mkdir(join(directory, "src/data/events"), { recursive: true });
    await symlink(join(process.cwd(), "node_modules"), join(directory, "node_modules"));
    await writeFile(
      join(directory, ".prettierrc"),
      await readFile(join(process.cwd(), ".prettierrc"), "utf8"),
    );
    const eventFile = join(directory, "src/data/events/sample.ts");
    await writeFile(
      eventFile,
      `export const events = [\n  {\n    description: "${"word ".repeat(30).trim()}",\n  },\n];\n`,
    );

    const result = spawnSync(
      "bash",
      ["-e", "-c", stepScript(workflow, "Format crawled event data")],
      {
        cwd: directory,
        encoding: "utf8",
      },
    );

    expect(result.status, result.stderr).toBe(0);
    await expect(readFile(eventFile, "utf8")).resolves.toBe(
      `export const events = [\n  {\n    description:\n      "${"word ".repeat(30).trim()}",\n  },\n];\n`,
    );
  });
});
