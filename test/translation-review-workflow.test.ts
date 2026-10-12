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
  timeline = [],
  commentEvent = false,
  reviewEvent = false,
  fork = false,
  payloadSha = "current",
  activeSha = "current",
  changedSha,
  createError,
  removeError,
}: {
  files?: (string | { filename: string; previous_filename?: string })[];
  reviewers?: string;
  reviews?: object[];
  comments?: object[];
  timeline?: object[];
  commentEvent?: boolean;
  reviewEvent?: boolean;
  fork?: boolean;
  payloadSha?: string;
  activeSha?: string;
  changedSha?: string;
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
  const timelineApi = vi.fn();
  Object.assign(issues, { listComments: commentsApi, listEventsForTimeline: timelineApi });
  const head = { sha: activeSha, repo: { full_name: fork ? "contributor/hub" : "owner/hub" } };
  const pr = { number: 7, head, user: { login: "author" } };
  let readCount = 0;
  const filesApi = vi.fn();
  const reviewsApi = vi.fn();
  const github = {
    rest: {
      pulls: {
        listFiles: filesApi,
        listReviews: reviewsApi,
        get: vi.fn(async () => ({
          data: {
            ...pr,
            head: { ...head, sha: readCount++ > 0 ? (changedSha ?? activeSha) : activeSha },
          },
        })),
      },
      issues,
    },
    paginate: vi.fn(async (api) =>
      api === filesApi
        ? files.map((file) => (typeof file === "string" ? { filename: file } : file))
        : api === commentsApi
          ? comments
          : api === timelineApi
            ? timeline
            : reviews,
    ),
  };
  const core = { setFailed: vi.fn() };
  const context = {
    repo: { owner: "owner", repo: "hub" },
    eventName: commentEvent
      ? "issue_comment"
      : reviewEvent
        ? "pull_request_review"
        : "pull_request_target",
    payload: commentEvent
      ? { issue: { number: 7 } }
      : { pull_request: { ...pr, head: { sha: payloadSha } } },
  };
  const execute = Object.getPrototypeOf(async function () {}).constructor;
  await new execute("github", "context", "core", "process", script)(github, context, core, {
    env: { ODIA_NATIVE_REVIEWERS: reviewers },
  });
  return { issues, core };
}
let reviewId = 0;
const review = (
  state: string,
  commit_id = "current",
  login = "odia-reviewer",
  submitted_at = "2026-10-12T10:00:00Z",
) => ({
  id: ++reviewId,
  state,
  commit_id,
  user: { login },
  submitted_at,
});
const decisionComment = (body: string, at: string, login = "odia-reviewer") => ({
  body,
  user: { login },
  created_at: at,
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
    const comment = (body: string, login = "author") => ({
      body,
      user: { login },
      created_at: "2026-10-12T11:00:00Z",
    });
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
  it("protects renamed locale paths and ignores obsolete event heads", async () => {
    const renamed = await runGate({
      files: [{ filename: "src/locales/odia.ts", previous_filename: "src/locales/or.ts" }],
    });
    expect(renamed.issues.addLabels).toHaveBeenCalled();
    const stale = await runGate({ payloadSha: "old", reviews: [review("APPROVED", "old")] });
    expect(stale.core.setFailed).toHaveBeenCalled();
    expect(stale.issues.removeLabel).not.toHaveBeenCalled();
    const newer = await runGate({ reviews: [review("APPROVED")], changedSha: "newer" });
    expect(newer.issues.removeLabel).not.toHaveBeenCalled();
    expect(newer.issues.addLabels).not.toHaveBeenCalled();
    expect(workflow.jobs["native-review"].concurrency["cancel-in-progress"]).toBe(true);
  });
  it("honors an edited revocation even when its comment was created before approval", async () => {
    const result = await runGate({
      comments: [
        {
          body: "odia-review-revoke current",
          user: { login: "odia-reviewer" },
          created_at: "2026-10-12T10:00:00Z",
          updated_at: "2026-10-12T12:00:00Z",
        },
        {
          body: "odia-review-approved current",
          user: { login: "odia-reviewer" },
          created_at: "2026-10-12T11:00:00Z",
        },
      ],
    });
    expect(result.core.setFailed).toHaveBeenCalled();
    expect(result.issues.addLabels).toHaveBeenCalled();
    expect(result.issues.removeLabel).not.toHaveBeenCalled();
  });
  it.each([
    ["odia-review-approved current", "11:00", "CHANGES_REQUESTED", "12:00", false],
    ["odia-review-approved current", "12:00", "CHANGES_REQUESTED", "11:00", true],
    ["odia-review-revoke current", "12:00", "APPROVED", "11:00", false],
    ["odia-review-revoke current", "11:00", "APPROVED", "12:00", true],
    ["odia-review-approved current", "12:00", "CHANGES_REQUESTED", "12:00", false],
    ["odia-review-revoke current", "12:00", "APPROVED", "12:00", false],
  ])(
    "uses latest cross-channel decision: %s at %s, formal %s at %s",
    async (body, commentTime, state, reviewTime, approved) => {
      const result = await runGate({
        reviews: [review(state, "current", "odia-reviewer", `2026-10-12T${reviewTime}:00Z`)],
        comments: [decisionComment(body, `2026-10-12T${commentTime}:00Z`)],
      });
      expect(result.core.setFailed.mock.calls.length === 0).toBe(approved);
      expect(result.issues.removeLabel.mock.calls.length > 0).toBe(approved);
      expect(result.issues.addLabels.mock.calls.length > 0).toBe(!approved);
    },
  );
  it("compares edited comments and formal review timestamps rather than API order", async () => {
    const result = await runGate({
      reviews: [
        review("CHANGES_REQUESTED", "current", "odia-reviewer", "2026-10-12T12:00:00Z"),
        review("APPROVED", "current", "odia-reviewer", "2026-10-12T09:00:00Z"),
        review("COMMENTED", "current", "odia-reviewer", "2026-10-12T14:00:00Z"),
        review("PENDING", "current", "odia-reviewer", "2026-10-12T14:00:00Z"),
      ],
      comments: [
        {
          ...decisionComment("odia-review-approved current", "2026-10-12T10:00:00Z"),
          updated_at: "2026-10-12T13:00:00Z",
        },
        decisionComment("odia-review-revoke current", "2026-10-12T11:00:00Z"),
      ],
    });
    expect(result.core.setFailed).not.toHaveBeenCalled();
    expect(result.issues.removeLabel).toHaveBeenCalled();
    const reversed = await runGate({
      reviews: [
        review("CHANGES_REQUESTED", "current", "odia-reviewer", "2026-10-12T12:00:00Z"),
        review("APPROVED", "current", "odia-reviewer", "2026-10-12T09:00:00Z"),
      ],
    });
    expect(reversed.core.setFailed).toHaveBeenCalled();
  });
  it.each(["11:00", "13:00"])(
    "uses dismissal time, not the dismissed approval's submitted_at (comment at %s)",
    async (commentTime) => {
      const dismissed = review("DISMISSED", "current", "odia-reviewer", "2026-10-12T09:00:00Z");
      const result = await runGate({
        reviewEvent: true,
        reviews: [dismissed],
        comments: [
          decisionComment("odia-review-approved current", `2026-10-12T${commentTime}:00Z`),
        ],
        timeline: [
          { event: "commented", created_at: "2026-10-12T15:00:00Z" },
          { event: "review_dismissed", dismissed_review: null },
          {
            event: "review_dismissed",
            created_at: "2026-10-12T15:00:00Z",
            dismissed_review: { review_id: 99999 },
          },
          {
            event: "review_dismissed",
            created_at: "2026-10-12T12:00:00Z",
            dismissed_review: { review_id: String(dismissed.id) },
          },
        ],
      });
      expect(result.core.setFailed.mock.calls.length === 0).toBe(commentTime === "13:00");
      expect(result.issues.removeLabel.mock.calls.length > 0).toBe(commentTime === "13:00");
    },
  );
  it("fails closed for unknown approval or dismissal chronology", async () => {
    const dismissed = review("DISMISSED");
    for (const timeline of [
      [],
      [
        {
          event: "review_dismissed",
          created_at: "invalid",
          dismissed_review: { review_id: dismissed.id },
        },
      ],
    ]) {
      const result = await runGate({
        reviews: [dismissed],
        timeline,
        comments: [decisionComment("odia-review-approved current", "2026-10-12T13:00:00Z")],
      });
      expect(result.core.setFailed).toHaveBeenCalled();
      expect(result.issues.removeLabel).not.toHaveBeenCalled();
    }
    for (const input of [
      { reviews: [review("APPROVED", "current", "odia-reviewer", "invalid")] },
      { comments: [decisionComment("odia-review-approved current", "invalid")] },
      {
        reviews: [review("APPROVED", "current", "odia-reviewer", "2026-10-12T13:00:00Z")],
        comments: [decisionComment("odia-review-revoke current", "invalid")],
      },
    ]) {
      const result = await runGate(input);
      expect(result.core.setFailed).toHaveBeenCalled();
      expect(result.issues.removeLabel).not.toHaveBeenCalled();
    }
  });
  it("ignores other-head decisions and keeps reviewer decisions independent", async () => {
    const approved = await runGate({
      reviews: [review("DISMISSED", "old", "odia-reviewer", "2026-10-12T15:00:00Z")],
      comments: [decisionComment("odia-review-approved current", "2026-10-12T13:00:00Z")],
    });
    expect(approved.core.setFailed).not.toHaveBeenCalled();
    const multi = await runGate({
      reviewers: "odia-reviewer,second-reviewer",
      reviews: [review("CHANGES_REQUESTED", "current", "odia-reviewer", "2026-10-12T15:00:00Z")],
      comments: [
        decisionComment("odia-review-approved current", "2026-10-12T13:00:00Z", "second-reviewer"),
      ],
    });
    expect(multi.core.setFailed).not.toHaveBeenCalled();
  });
  it("evaluates fork reviews with a read-only token and updates labels from base events", async () => {
    const approved = await runGate({
      fork: true,
      reviewEvent: true,
      reviews: [review("APPROVED")],
      createError: { status: 403 },
      removeError: { status: 403 },
    });
    expect(approved.core.setFailed).not.toHaveBeenCalled();
    for (const mutation of [
      approved.issues.createLabel,
      approved.issues.addLabels,
      approved.issues.removeLabel,
    ])
      expect(mutation).not.toHaveBeenCalled();
    const pending = await runGate({ fork: true, reviewEvent: true, createError: { status: 403 } });
    expect(pending.core.setFailed).toHaveBeenCalled();
    expect(pending.issues.addLabels).not.toHaveBeenCalled();
    const trusted = await runGate({
      fork: true,
      commentEvent: true,
      reviews: [review("APPROVED")],
    });
    expect(trusted.issues.removeLabel).toHaveBeenCalled();
    const sameRepo = await runGate({ reviewEvent: true, reviews: [review("APPROVED")] });
    expect(sameRepo.issues.removeLabel).toHaveBeenCalled();
  });
  it("skips unrelated PRs and handles only expected label races", async () => {
    const unchanged = await runGate({ files: ["src/routes/tools.tsx"] });
    expect(unchanged.issues.createLabel).not.toHaveBeenCalled();
    expect(unchanged.issues.removeLabel).toHaveBeenCalled();
    expect(unchanged.core.setFailed).not.toHaveBeenCalled();
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
  it("clears a reverted locale label only with a trusted token and unchanged head", async () => {
    const fork = await runGate({
      files: [],
      fork: true,
      reviewEvent: true,
      removeError: { status: 403 },
    });
    const obsolete = await runGate({ files: [], changedSha: "newer" });
    expect(fork.issues.removeLabel).not.toHaveBeenCalled();
    expect(obsolete.issues.removeLabel).not.toHaveBeenCalled();
    expect(
      (await runGate({ files: [], removeError: { status: 404 } })).core.setFailed,
    ).not.toHaveBeenCalled();
    await expect(runGate({ files: [], removeError: { status: 403 } })).rejects.toEqual({
      status: 403,
    });
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
