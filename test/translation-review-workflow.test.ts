import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it, vi } from "vitest";

const workflow = parse(
  readFileSync(`${process.cwd()}/.github/workflows/translation-review.yml`, "utf8"),
);
const publisher = workflow.jobs["publish-native-review"];
const script = publisher.steps[0].with.script;
const discoverScript = workflow.jobs["discover-review-prs"].steps[0].with.script;
const notification = parse(
  readFileSync(`${process.cwd()}/.github/workflows/translation-review-notification.yml`, "utf8"),
);
async function runGate({
  files = ["src/locales/or.ts"],
  changedFiles = files.length,
  omitChangedFiles = false,
  reviewers = "odia-reviewer",
  reviews = [],
  comments = [],
  timeline = [],
  commentEvent = false,
  reviewEvent = false,
  scheduled = false,
  event,
  eventComment,
  commentAction = "created",
  previousBody,
  sender = "maintainer",
  existingStatuses = [],
  statusReadError,
  fork = false,
  payloadSha = "current",
  activeSha = "current",
  changedSha,
  changeAfterRead = 1,
  state = "open",
  baseRepository = "owner/hub",
  statusCalls = [],
  createError,
  removeError,
  removeLabelObserver,
}: {
  files?: (string | { filename: string; previous_filename?: string })[];
  changedFiles?: unknown;
  omitChangedFiles?: boolean;
  reviewers?: string;
  reviews?: object[];
  comments?: object[];
  timeline?: object[];
  commentEvent?: boolean;
  reviewEvent?: boolean;
  scheduled?: boolean;
  event?: string;
  eventComment?: object;
  commentAction?: string;
  previousBody?: string;
  sender?: string;
  existingStatuses?: object[];
  statusReadError?: object;
  fork?: boolean;
  payloadSha?: string;
  activeSha?: string;
  changedSha?: string;
  changeAfterRead?: number;
  state?: string;
  baseRepository?: string;
  statusCalls?: object[];
  createError?: object;
  removeError?: object;
  removeLabelObserver?: () => void;
} = {}) {
  const issues = {
    createLabel: vi.fn(async () => {
      if (createError) throw createError;
    }),
    addLabels: vi.fn(),
    removeLabel: vi.fn(async () => {
      removeLabelObserver?.();
      if (removeError) throw removeError;
    }),
  };
  const commentsApi = vi.fn();
  const timelineApi = vi.fn();
  Object.assign(issues, { listComments: commentsApi, listEventsForTimeline: timelineApi });
  const head = { sha: activeSha, repo: { full_name: fork ? "contributor/hub" : "owner/hub" } };
  const pr = {
    number: 7,
    state,
    base: { repo: { full_name: baseRepository } },
    head,
    user: { login: "author" },
    changed_files: omitChangedFiles ? undefined : changedFiles,
  };
  let readCount = 0;
  const filesApi = vi.fn();
  const reviewsApi = vi.fn();
  const statusesApi = vi.fn();
  const github = {
    rest: {
      pulls: {
        listFiles: filesApi,
        listReviews: reviewsApi,
        get: vi.fn(async () => ({
          data: {
            ...pr,
            head: {
              ...head,
              sha: readCount++ >= changeAfterRead ? (changedSha ?? activeSha) : activeSha,
            },
          },
        })),
      },
      issues,
      repos: {
        createCommitStatus: vi.fn((status) => statusCalls.push(status)),
        listCommitStatusesForRef: statusesApi,
      },
    },
    paginate: vi.fn(async (api) => {
      if (api === statusesApi) {
        if (statusReadError) throw statusReadError;
        return existingStatuses;
      }
      return api === filesApi
        ? files.map((file) => (typeof file === "string" ? { filename: file } : file))
        : api === commentsApi
          ? comments
          : api === timelineApi
            ? timeline
            : reviews;
    }),
  };
  const core = { setFailed: vi.fn() };
  const eventName =
    event ??
    (scheduled
      ? "schedule"
      : commentEvent
        ? "issue_comment"
        : reviewEvent
          ? "workflow_run"
          : "pull_request_target");
  const context = {
    repo: { owner: "owner", repo: "hub" },
    runId: 99,
    eventName,
    payload:
      eventName === "issue_comment"
        ? {
            action: commentAction,
            issue: { number: 7 },
            comment: eventComment ??
              comments.at(-1) ?? {
                body: `odia-review-approved ${activeSha}`,
                user: { login: "odia-reviewer" },
              },
            changes: previousBody === undefined ? undefined : { body: { from: previousBody } },
            sender: { login: sender },
          }
        : { pull_request: { ...pr, head: { sha: payloadSha } } },
  };
  const execute = Object.getPrototypeOf(async function () {}).constructor;
  await new execute("github", "context", "core", "process", script)(github, context, core, {
    env: { ODIA_NATIVE_REVIEWERS: reviewers, PR_NUMBER: "7" },
  });
  return { issues, core, statuses: github.rest.repos.createCommitStatus, github };
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
const nativeStatus = (
  state: string,
  creator = "github-actions[bot]",
  context = "native-review",
  description = state === "success"
    ? "Configured native reviewer approved this exact commit"
    : state === "error"
      ? "Native review evaluation failed; inspect the trusted workflow run"
      : "Native Odia approval of this exact commit is required",
) => ({ state, description, context, creator: { login: creator } });

describe("native Odia review policy", () => {
  it.each([
    { changedFiles: 3001, files: Array.from({ length: 3000 }, (_, i) => `other/${i}.ts`) },
    { changedFiles: 2, files: ["src/routes/tools.tsx"] },
    { changedFiles: 2, files: ["src/locales/or.ts"] },
    { changedFiles: 0, files: ["src/routes/tools.tsx"] },
    { changedFiles: -1 },
    { changedFiles: 1.5 },
    { changedFiles: Number.MAX_SAFE_INTEGER + 1 },
    { changedFiles: null },
    { changedFiles: "1" },
    { omitChangedFiles: true },
    { files: ["same.ts", "same.ts"] },
    { files: [""] },
  ])("fails closed on incomplete or invalid PR file inventory (case %#)", async (input) => {
    const statusCalls: { state: string }[] = [];
    const removeLabel = vi.fn();
    // A previous success or visible protected file cannot replace a complete inventory.
    await expect(
      runGate({
        ...input,
        reviews: [review("APPROVED")],
        existingStatuses: [nativeStatus("success")],
        statusCalls,
        removeLabelObserver: removeLabel,
      }),
    ).rejects.toThrow("complete PR file inventory");
    expect(statusCalls.map((status) => status.state)).toEqual(["error"]);
    expect(removeLabel).not.toHaveBeenCalled();
  });
  it("accepts complete PR file inventory at the 3000-file boundary and at zero", async () => {
    const boundary = await runGate({
      files: [...Array.from({ length: 2999 }, (_, i) => `other/${i}.ts`), "src/locales/or.ts"],
    });
    expect(boundary.issues.addLabels).toHaveBeenCalled();
    expect(boundary.statuses.mock.calls.map(([status]) => status.state)).toEqual(["failure"]);
    const empty = await runGate({ files: [], changedFiles: 0 });
    expect(empty.issues.removeLabel).toHaveBeenCalled();
    expect(empty.statuses.mock.calls.map(([status]) => status.state)).toEqual(["success"]);
  });
  it("guards a moved head before publishing an incomplete PR file inventory error", async () => {
    const statusCalls: object[] = [];
    const removeLabel = vi.fn();
    await expect(
      runGate({
        changedFiles: 2,
        changedSha: "newer",
        statusCalls,
        removeLabelObserver: removeLabel,
      }),
    ).rejects.toThrow("complete PR file inventory");
    expect(statusCalls).toEqual([]);
    expect(removeLabel).not.toHaveBeenCalled();
  });
  it.each(["created", "edited", "deleted"])(
    "ignores unrelated or unauthorized comment events before any status/label writes (%s)",
    async (commentAction) => {
      for (const eventComment of [
        { body: "Thanks for the update", user: { login: "odia-reviewer" } },
        { body: "odia-review-approved current", user: { login: "outsider" } },
        { body: "odia-review-revoke old", user: { login: "odia-reviewer" } },
        { body: "odia-review-approved current", user: null },
      ]) {
        const result = await runGate({ commentEvent: true, commentAction, eventComment });
        expect(result.statuses).not.toHaveBeenCalled();
        expect(result.github.paginate).not.toHaveBeenCalled();
        expect(result.issues.addLabels).not.toHaveBeenCalled();
        expect(result.issues.removeLabel).not.toHaveBeenCalled();
      }
    },
  );
  it.each(["edited", "deleted"])(
    "reconciles withdrawn reviewer approval after a %s comment event",
    async (commentAction) => {
      const result = await runGate({
        commentEvent: true,
        commentAction,
        eventComment: {
          body: commentAction === "deleted" ? "odia-review-approved current" : "Withdrawn",
          user: { login: "ODIA-REVIEWER" },
        },
        previousBody: commentAction === "edited" ? "odia-review-approved current" : undefined,
        sender: "different-maintainer",
        comments:
          commentAction === "deleted" ? [] : [decisionComment("Withdrawn", "2026-10-12T13:00:00Z")],
        existingStatuses: [nativeStatus("success")],
      });
      expect(result.statuses.mock.calls.map(([status]) => status.state)).toEqual(["failure"]);
      expect(result.issues.addLabels).toHaveBeenCalled();
      expect(result.issues.removeLabel).not.toHaveBeenCalled();
    },
  );
  it.each(["issue_comment", "workflow_run", "pull_request_target"])(
    "recomputes review evidence but suppresses equivalent nonmanual status writes on %s",
    async (event) => {
      for (let signal = 0; signal < 2; signal++) {
        const result = await runGate({
          event,
          existingStatuses: [nativeStatus("success")],
          reviews: [review("APPROVED")],
        });
        expect(result.statuses).not.toHaveBeenCalled();
        expect(result.github.paginate).toHaveBeenCalledWith(
          result.github.rest.pulls.listReviews,
          expect.objectContaining({ pull_number: 7 }),
        );
      }
      const dismissed = await runGate({
        event,
        existingStatuses: [nativeStatus("success")],
        reviews: [review("DISMISSED")],
      });
      expect(dismissed.statuses.mock.calls.map(([status]) => status.state)).toEqual(["failure"]);
    },
  );
  it("checks the current head before the first manual pending status", async () => {
    const result = await runGate({ event: "workflow_dispatch", changedSha: "newer" });
    expect(result.statuses).not.toHaveBeenCalled();
    expect(result.issues.addLabels).not.toHaveBeenCalled();
    expect(result.issues.removeLabel).not.toHaveBeenCalled();
  });
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
    expect(publisher.concurrency["cancel-in-progress"]).toBe(true);
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
  it("publishes trusted decisions and labels for fork review notifications", async () => {
    const approved = await runGate({
      fork: true,
      reviewEvent: true,
      reviews: [review("APPROVED")],
    });
    expect(approved.core.setFailed).not.toHaveBeenCalled();
    expect(approved.issues.removeLabel).toHaveBeenCalled();
    expect(approved.statuses.mock.calls.map(([status]) => status.state)).toEqual(["success"]);
    const pending = await runGate({ fork: true, reviewEvent: true });
    expect(pending.core.setFailed).toHaveBeenCalled();
    expect(pending.issues.addLabels).toHaveBeenCalled();
    expect(pending.statuses.mock.calls.map(([status]) => status.state)).toEqual(["failure"]);
  });
  it("reconciles a dismissed approval when the contributor suppresses every review notification", async () => {
    expect(workflow.on.schedule).toEqual([{ cron: "2-57/5 * * * *" }]);
    expect(workflow.on.workflow_dispatch).toEqual({});
    const setOutput = vi.fn();
    const list = vi.fn();
    const getWorkflowRun = vi.fn(() => {
      throw new Error("The contributor removed the notification; no run exists");
    });
    const execute = Object.getPrototypeOf(async function () {}).constructor;
    await new execute("github", "context", "core", discoverScript)(
      {
        rest: {
          actions: { getWorkflowRun },
          pulls: {
            list,
            get: async () => ({
              data: { number: 7, state: "open", base: { repo: { full_name: "owner/hub" } } },
            }),
          },
        },
        paginate: async (api: unknown) => {
          expect(api).toBe(list);
          return [{ number: 7 }];
        },
      },
      {
        repo: { owner: "owner", repo: "hub" },
        eventName: "schedule",
        ref: "refs/heads/main",
        payload: { repository: { default_branch: "main" } },
      },
      { setOutput },
    );
    expect(setOutput).toHaveBeenCalledWith("prs", "[7]");
    expect(getWorkflowRun).not.toHaveBeenCalled();
    const dismissed = review("DISMISSED");
    const statusCalls = [{ sha: "current", context: "native-review", state: "success" }];
    const result = await runGate({
      scheduled: true,
      reviews: [dismissed],
      timeline: [
        {
          event: "review_dismissed",
          created_at: "2026-10-12T12:00:00Z",
          dismissed_review: { review_id: dismissed.id },
        },
      ],
      statusCalls,
    });
    expect(statusCalls.map((status) => status.state)).toEqual(["success", "failure"]);
    expect(result.core.setFailed).not.toHaveBeenCalled();
    expect(result.issues.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 7, labels: ["needs-native-speaker-review"] }),
    );
    expect(result.issues.removeLabel).not.toHaveBeenCalled();
  });
  it.each(["success", "failure"])(
    "recomputes current evidence while suppressing unchanged scheduled %s statuses",
    async (state) => {
      for (let poll = 0; poll < 2; poll++) {
        const result = await runGate({
          scheduled: true,
          reviews: state === "success" ? [review("APPROVED")] : [],
          existingStatuses: [
            ...Array.from({ length: 100 }, () => ({ context: "other-check", state: "pending" })),
            nativeStatus(state, "GitHub-Actions[bot]", "Native-Review"),
            nativeStatus(state === "success" ? "failure" : "success"),
          ],
        });
        expect(result.statuses).not.toHaveBeenCalled();
        expect(result.github.paginate).toHaveBeenCalledWith(
          result.github.rest.repos.listCommitStatusesForRef,
          { owner: "owner", repo: "hub", ref: "current", per_page: 100 },
        );
        expect(result.github.paginate).toHaveBeenCalledWith(
          result.github.rest.pulls.listReviews,
          expect.objectContaining({ pull_number: 7 }),
        );
        expect(result.core.setFailed).not.toHaveBeenCalled();
        expect(result.issues.addLabels.mock.calls.length > 0).toBe(state === "failure");
        expect(result.issues.removeLabel.mock.calls.length > 0).toBe(state === "success");
      }
    },
  );
  it("replaces a previously successful status once after dismissal without trusting cached approval", async () => {
    const dismissed = review("DISMISSED");
    const input = {
      scheduled: true,
      reviews: [dismissed],
      timeline: [
        {
          event: "review_dismissed",
          created_at: "2026-10-12T12:00:00Z",
          dismissed_review: { review_id: dismissed.id },
        },
      ],
    };
    const revoked = await runGate({ ...input, existingStatuses: [nativeStatus("success")] });
    expect(revoked.statuses.mock.calls.map(([status]) => status.state)).toEqual(["failure"]);
    const repeated = await runGate({ ...input, existingStatuses: [nativeStatus("failure")] });
    expect(repeated.statuses).not.toHaveBeenCalled();
    expect(repeated.issues.addLabels).toHaveBeenCalled();
    expect(repeated.core.setFailed).not.toHaveBeenCalled();
  });
  it("publishes a scheduled API error once, then publishes recovery only after recomputing approval", async () => {
    const first: { state: string; description: string }[] = [];
    await expect(
      runGate({
        scheduled: true,
        existingStatuses: [nativeStatus("success")],
        createError: { status: 403 },
        statusCalls: first,
      }),
    ).rejects.toEqual({ status: 403 });
    expect(first.map((status) => status.state)).toEqual(["error"]);
    const repeated: object[] = [];
    await expect(
      runGate({
        scheduled: true,
        existingStatuses: [nativeStatus("error")],
        createError: { status: 403 },
        statusCalls: repeated,
      }),
    ).rejects.toEqual({ status: 403 });
    expect(repeated).toEqual([]);
    const recovered = await runGate({
      scheduled: true,
      existingStatuses: [nativeStatus("error")],
      reviews: [review("APPROVED")],
    });
    expect(recovered.statuses.mock.calls.map(([status]) => status.state)).toEqual(["success"]);
    const stable = await runGate({
      scheduled: true,
      existingStatuses: [nativeStatus("success")],
      reviews: [review("APPROVED")],
    });
    expect(stable.statuses).not.toHaveBeenCalled();
  });
  it.each([
    [nativeStatus("failure", "outsider"), nativeStatus("failure")],
    [nativeStatus("success"), nativeStatus("failure")],
    [nativeStatus("pending"), nativeStatus("failure")],
    [nativeStatus("failure", "github-actions[bot]", "native-review", "Old policy")],
  ])("never skips the latest mismatched or untrusted scheduled status: %j", async (...history) => {
    const result = await runGate({ scheduled: true, existingStatuses: history });
    expect(result.statuses.mock.calls.map(([status]) => status.state)).toEqual(["failure"]);
    expect(result.core.setFailed).not.toHaveBeenCalled();
  });
  it("fails closed with one error status when the scheduled status-history API fails", async () => {
    const statusCalls: { state: string }[] = [];
    await expect(
      runGate({ scheduled: true, statusReadError: { status: 403 }, statusCalls }),
    ).rejects.toEqual({ status: 403 });
    expect(statusCalls.map((status) => status.state)).toEqual(["error"]);
  });
  it.each(["workflow_dispatch", "issue_comment", "workflow_run", "pull_request_target"])(
    "preserves fresh manual proof and suppresses equivalent automatic results on %s",
    async (event) => {
      const result = await runGate({
        event,
        existingStatuses: [nativeStatus("success")],
        reviews: [review("APPROVED")],
      });
      expect(result.statuses.mock.calls.map(([status]) => status.state)).toEqual(
        event === "workflow_dispatch" ? ["pending", "success"] : [],
      );
      if (event === "workflow_dispatch") {
        expect(result.github.paginate).not.toHaveBeenCalledWith(
          result.github.rest.repos.listCommitStatusesForRef,
          expect.anything(),
        );
      } else {
        expect(result.github.paginate).toHaveBeenCalledWith(
          result.github.rest.repos.listCommitStatusesForRef,
          expect.anything(),
        );
      }
    },
  );
  it("keeps expected scheduled missing configuration blocked without failing the cron job", async () => {
    const result = await runGate({ scheduled: true, reviewers: "" });
    expect(result.statuses.mock.calls.map(([status]) => status.state)).toEqual(["failure"]);
    expect(result.core.setFailed).not.toHaveBeenCalled();
    expect(result.issues.addLabels).toHaveBeenCalled();
  });
  it("does not publish a scheduled decision or error when the head moves", async () => {
    const result = await runGate({ scheduled: true, changedSha: "newer" });
    expect(result.statuses).not.toHaveBeenCalled();
    expect(result.issues.addLabels).not.toHaveBeenCalled();
    const statusCalls: object[] = [];
    await expect(
      runGate({
        scheduled: true,
        changedSha: "newer",
        statusReadError: { status: 403 },
        statusCalls,
      }),
    ).rejects.toEqual({ status: 403 });
    expect(statusCalls).toEqual([]);
  });
  it("publishes a fresh scheduled status on a new head with no prior status history", async () => {
    const result = await runGate({
      scheduled: true,
      activeSha: "new-head",
      existingStatuses: [],
      reviews: [review("APPROVED", "new-head")],
    });
    expect(result.github.paginate).toHaveBeenCalledWith(
      result.github.rest.repos.listCommitStatusesForRef,
      { owner: "owner", repo: "hub", ref: "new-head", per_page: 100 },
    );
    expect(result.statuses.mock.calls.map(([status]) => [status.sha, status.state])).toEqual([
      ["new-head", "success"],
    ]);
    expect(result.core.setFailed).not.toHaveBeenCalled();
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
  it("clears reverted locale requirements from the trusted publisher with an unchanged head", async () => {
    const cleanFork = await runGate({ files: [], fork: true, reviewEvent: true });
    expect(cleanFork.issues.removeLabel).toHaveBeenCalled();
    expect(cleanFork.statuses.mock.calls.map(([status]) => status.state)).toEqual(["success"]);
    const obsolete = await runGate({ files: [], changedSha: "newer" });
    expect(obsolete.issues.removeLabel).not.toHaveBeenCalled();
    expect(obsolete.statuses.mock.calls.map(([status]) => status.state)).toEqual([]);
    expect(
      (await runGate({ files: [], removeError: { status: 404 } })).core.setFailed,
    ).not.toHaveBeenCalled();
    await expect(runGate({ files: [], removeError: { status: 403 } })).rejects.toEqual({
      status: 403,
    });
  });
  it("publishes explicit same-author comment approval on the fresh PR head rather than the event SHA", async () => {
    const result = await runGate({
      reviewers: "author",
      commentEvent: true,
      payloadSha: "default-branch",
      comments: [decisionComment("odia-review-approved current", "2026-10-12T13:00:00Z", "author")],
    });
    expect(result.statuses.mock.calls.map(([status]) => status.state)).toEqual(["success"]);
    for (const [status] of result.statuses.mock.calls) {
      expect(status).toMatchObject({
        owner: "owner",
        repo: "hub",
        sha: "current",
        context: "native-review",
      });
      expect(status.target_url).toBe("https://github.com/owner/hub/actions/runs/99");
    }
    expect(result.statuses.mock.invocationCallOrder[0]).toBeGreaterThan(
      result.github.paginate.mock.invocationCallOrder[0],
    );
  });
  it.each(["success", "failure", "cancelled"])(
    "never turns an untrusted notification outcome (%s) into native approval",
    async (conclusion) => {
      const setOutput = vi.fn();
      const get = vi.fn(async () => ({
        data: {
          number: 7,
          state: "open",
          base: { repo: { full_name: "owner/hub" } },
          head: { sha: "current", ref: "topic", repo: { full_name: "contributor/hub" } },
        },
      }));
      const execute = Object.getPrototypeOf(async function () {}).constructor;
      await new execute("github", "context", "core", discoverScript)(
        {
          rest: {
            actions: {
              getWorkflowRun: async () => ({
                data: {
                  event: "pull_request_review",
                  path: ".github/workflows/translation-review-notification.yml",
                  name: "Native Odia review notification",
                  repository: { full_name: "owner/hub" },
                  head_sha: "current",
                  head_branch: "topic",
                  head_repository: { full_name: "contributor/hub" },
                  pull_requests: [{ number: 7 }],
                  conclusion,
                },
              }),
            },
            pulls: { get },
          },
        },
        {
          repo: { owner: "owner", repo: "hub" },
          eventName: "workflow_run",
          payload: { workflow_run: { id: 99 } },
        },
        { setOutput },
      );
      expect(setOutput).toHaveBeenCalledWith("prs", "[7]");
      // Even a contributor-controlled job named native-review reporting success
      // supplies no allowed-reviewer decision to this trusted commit-status path.
      const result = await runGate({ fork: true, reviewEvent: true });
      expect(result.statuses.mock.calls.map(([status]) => status.state)).toEqual(["failure"]);
      expect(result.statuses.mock.calls[0][0]).toMatchObject({
        context: "native-review",
        sha: "current",
      });
    },
  );
  it("does not publish a final decision after the head moves during label mutation", async () => {
    for (const files of [["src/locales/or.ts"], []]) {
      const result = await runGate({
        files,
        reviews: [review("APPROVED")],
        changedSha: "newer",
        changeAfterRead: 2,
      });
      expect(result.statuses.mock.calls.map(([status]) => status.state)).toEqual([]);
    }
  });
  it("leaves an error status after a trusted API failure, but never publishes on a moved head", async () => {
    const result = await runGate({ state: "closed" });
    expect(result.statuses).not.toHaveBeenCalled();
    expect((await runGate({ baseRepository: "other/hub" })).statuses).not.toHaveBeenCalled();
    const statusCalls: object[] = [];
    const failure = runGate({ createError: { status: 403 }, statusCalls });
    await expect(failure).rejects.toEqual({ status: 403 });
    expect(statusCalls).toEqual([expect.objectContaining({ state: "error", sha: "current" })]);
  });
  it("keeps write-capable decisions in trusted code and reserves the native-review status context", () => {
    expect(workflow.on).not.toHaveProperty("pull_request_review");
    expect(workflow.on.workflow_run).toEqual({
      workflows: ["Native Odia review notification"],
      types: ["completed"],
    });
    expect(publisher.steps).toHaveLength(1);
    expect(publisher.steps[0].uses).toBe("actions/github-script@v7");
    expect(script).not.toMatch(/checkout|exec\(|fetch\(|eval\(/);
    expect(discoverScript).not.toMatch(
      /downloadArtifact|conclusion|checkout|exec\(|fetch\(|eval\(/,
    );
    expect(publisher.permissions).toEqual({
      contents: "read",
      "pull-requests": "read",
      issues: "write",
      statuses: "write",
    });
    expect(workflow.jobs).not.toHaveProperty("native-review");
    expect(notification.jobs).not.toHaveProperty("native-review");
    expect(publisher.concurrency.group).toBe("native-odia-${{ matrix.pr }}");
    expect(publisher.strategy["fail-fast"]).toBe(false);
    expect(publisher.strategy.matrix.pr).toContain(
      "fromJSON(needs.discover-review-prs.outputs.prs)",
    );
  });
  it("uses the review workflow only as a powerless notification", async () => {
    expect(notification.permissions).toEqual({});
    expect(notification.on).toEqual({
      pull_request_review: { types: ["submitted", "edited", "dismissed"] },
    });
    const info = vi.fn();
    const api = new Proxy(
      {},
      {
        get() {
          throw new Error("Notification must not call GitHub APIs");
        },
      },
    );
    const execute = Object.getPrototypeOf(async function () {}).constructor;
    await new execute(
      "github",
      "core",
      notification.jobs["notify-review-change"].steps[0].with.script,
    )(api, { info });
    expect(info).toHaveBeenCalledOnce();
  });
});
