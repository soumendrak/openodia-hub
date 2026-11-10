import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it, vi } from "vitest";
const workflow = parse(readFileSync(".github/workflows/ci.yml", "utf8"));
const script = workflow.jobs.standards.steps.find(
  (step: { name?: string }) => step.name === "Update sticky PR coverage report",
).with.script;
async function run(heads: string[], existing = true) {
  const updateComment = vi.fn();
  const createComment = vi.fn();
  const get = vi.fn(async () => ({ data: { head: { sha: heads.shift() } } }));
  const github = {
    rest: { pulls: { get }, issues: { listComments: vi.fn(), updateComment, createComment } },
    paginate: vi.fn(async () =>
      existing ? [{ id: 7, user: { type: "Bot" }, body: "<!-- openodia-coverage -->" }] : [],
    ),
  };
  const context = {
    repo: { owner: "owner", repo: "hub" },
    issue: { number: 9 },
    payload: { pull_request: { head: { sha: "current" } } },
  };
  const coverage = {
    one: {
      s: { 0: 1, 1: 0 },
      f: { 0: 1 },
      b: { 0: [1, 0] },
      statementMap: { 0: { start: { line: 1 } }, 1: { start: { line: 2 } } },
    },
  };
  const execute = Object.getPrototypeOf(async function () {}).constructor;
  await new execute("github", "context", "core", "require", script)(
    github,
    context,
    { info: vi.fn() },
    () => ({ readFileSync: () => JSON.stringify(coverage) }),
  );
  return { updateComment, createComment };
}
describe("coverage comment freshness", () => {
  it("updates or creates a current-head report using actual covered totals", async () => {
    const update = await run(["current", "current"]);
    expect(update.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        comment_id: 7,
        body: expect.stringContaining("| Statements | 1 / 2 | 50.00% |"),
      }),
    );
    expect(update.createComment).not.toHaveBeenCalled();
    const created = await run(["current", "current"], false);
    expect(created.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 9,
        body: expect.stringContaining("Coverage at current"),
      }),
    );
  });
  it("does not write an old report, including when the head changes during comment lookup", async () => {
    for (const heads of [["new"], ["current", "new"]]) {
      const result = await run(heads);
      expect(result.updateComment).not.toHaveBeenCalled();
      expect(result.createComment).not.toHaveBeenCalled();
    }
    expect(workflow.concurrency["cancel-in-progress"]).toBe(true);
  });
});
