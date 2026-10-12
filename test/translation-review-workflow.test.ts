import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it, vi } from "vitest";

const workflow = parse(
  readFileSync(`${process.cwd()}/.github/workflows/translation-review.yml`, "utf8"),
);
const script = workflow.jobs["native-review"].steps[0].with.script;
async function runGate({
  files = ["src/locales/or.ts"],
  reviewers = "odia-reviewer",
  reviews = [],
  comments = [],
  commentEvent = false,
  createError,
  removeError,
}: {
  files?: string[];
  reviewers?: string;
  reviews?: object[];
  comments?: object[];
  commentEvent?: boolean;
  createError?: object;
  removeError?: object;
} = {}) {
  const issues = {
    createLabel: vi.fn(async () => {
      if (createError) throw createError;
    }),
    addLabels: vi.fn(),
    removeLabel: vi.fn(async () => {
      if (removeError) throw removeError;
    }),
  };
  const commentsApi = vi.fn();
  Object.assign(issues, { listComments: commentsApi });
  const pr = { number: 7, head: { sha: "current" }, user: { login: "author" } };
  const filesApi = vi.fn();
  const reviewsApi = vi.fn();
  const github = {
    rest: {
      pulls: {
        listFiles: filesApi,
        listReviews: reviewsApi,
        get: vi.fn(async () => ({ data: pr })),
      },
      issues,
    },
    paginate: vi.fn(async (api) =>
      api === filesApi
        ? files.map((filename) => ({ filename }))
        : api === commentsApi
          ? comments
          : reviews,
    ),
  };
  const core = { setFailed: vi.fn() };
  const context = {
    repo: { owner: "owner", repo: "hub" },
    payload: commentEvent ? { issue: { number: 7 } } : { pull_request: pr },
  };
  const execute = Object.getPrototypeOf(async function () {}).constructor;
  await new execute("github", "context", "core", "process", script)(github, context, core, {
    env: { ODIA_NATIVE_REVIEWERS: reviewers },
  });
  return { issues, core };
}
const review = (state: string, commit_id = "current", login = "odia-reviewer") => ({
  state,
  commit_id,
  user: { login },
});

describe("native Odia review policy", () => {
  it("labels draft translations and requires actual configured reviewers", async () => {
    const missing = await runGate({ reviewers: "" });
    expect(missing.issues.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["needs-native-speaker-review"] }),
    );
    expect(missing.core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("Configure ODIA_NATIVE_REVIEWERS"),
    );
    const pending = await runGate();
    expect(pending.core.setFailed).toHaveBeenCalledWith(expect.stringContaining("exact commit"));
  });
  it("accepts only an allowed current-commit non-author approval, including after a comment", async () => {
    const approved = await runGate({ reviews: [review("APPROVED"), review("COMMENTED")] });
    expect(approved.core.setFailed).not.toHaveBeenCalled();
    expect(approved.issues.removeLabel).toHaveBeenCalled();
    for (const reviews of [
      [review("APPROVED", "old")],
      [review("APPROVED", "current", "outsider")],
      [review("APPROVED", "current", "author")],
      [review("APPROVED"), review("DISMISSED")],
      [review("APPROVED"), review("CHANGES_REQUESTED")],
    ]) {
      const result = await runGate({ reviewers: "odia-reviewer,author", reviews });
      expect(result.core.setFailed).toHaveBeenCalled();
    }
  });
  it("accepts explicit current-SHA comments from configured native reviewers and supports revocation", async () => {
    const comment = (body: string, login = "author") => ({ body, user: { login } });
    const approved = await runGate({
      reviewers: "author",
      commentEvent: true,
      comments: [comment("odia-review-approved current")],
    });
    expect(approved.core.setFailed).not.toHaveBeenCalled();
    for (const comments of [
      [comment("odia-review-approved old")],
      [comment("odia-review-approved current", "outsider")],
      [comment("odia-review-approved current"), comment("odia-review-revoke current")],
      [{ body: "odia-review-approved current", user: null }],
    ])
      expect((await runGate({ reviewers: "author", comments })).core.setFailed).toHaveBeenCalled();
  });
  it("skips unrelated PRs and handles only expected label races", async () => {
    const unchanged = await runGate({ files: ["src/routes/tools.tsx"] });
    expect(unchanged.issues.createLabel).not.toHaveBeenCalled();
    expect((await runGate({ createError: { status: 422 } })).core.setFailed).toHaveBeenCalled();
    await expect(runGate({ createError: { status: 403 } })).rejects.toEqual({ status: 403 });
    await expect(
      runGate({ reviews: [review("APPROVED")], removeError: { status: 403 } }),
    ).rejects.toEqual({ status: 403 });
    expect(
      (await runGate({ reviews: [review("APPROVED")], removeError: { status: 404 } })).core
        .setFailed,
    ).not.toHaveBeenCalled();
  });
  it("does not check out or execute pull-request code with write permissions", () => {
    expect(workflow.jobs["native-review"].steps).toHaveLength(1);
    expect(workflow.jobs["native-review"].steps[0].uses).toBe("actions/github-script@v7");
    expect(script).not.toMatch(/checkout|exec\(|fetch\(|eval\(/);
    expect(workflow.permissions).toEqual({
      contents: "read",
      issues: "write",
      "pull-requests": "write",
    });
  });
});
