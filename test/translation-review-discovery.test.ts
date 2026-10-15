import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it, vi } from "vitest";

const workflow = parse(
  readFileSync(`${process.cwd()}/.github/workflows/translation-review.yml`, "utf8"),
);
const script = workflow.jobs["discover-review-prs"].steps[0].with.script;

function freshPr({
  number = 7,
  state = "open",
  baseRepository = "owner/hub",
  sha = "current",
  ref = "topic",
  headRepository = "contributor/hub",
  mergeSha = "merge",
  baseSha = "base-current",
} = {}) {
  return {
    number,
    state,
    base: { sha: baseSha, repo: { full_name: baseRepository } },
    head: { sha, ref, repo: { full_name: headRepository } },
    merge_commit_sha: mergeSha,
  };
}

async function discover({
  event = "workflow_run",
  candidates = [{ number: 7 }],
  associated = [],
  listed = [],
  runOverrides = {},
  prs = [freshPr()],
  associationError,
  payloadNumber = 7,
  mergeParents = ["base-current", "current"],
  commitError,
  ref = "refs/heads/main",
  reviewers = "odia-reviewer",
  comment = { body: "odia-review-approved current", user: { login: "odia-reviewer" } },
  action = "created",
  previousBody,
  sender = "maintainer",
}: {
  event?: string;
  candidates?: object[];
  associated?: object[];
  listed?: object[];
  runOverrides?: object;
  prs?: ReturnType<typeof freshPr>[];
  associationError?: object;
  payloadNumber?: number;
  mergeParents?: string[];
  commitError?: object;
  ref?: string;
  reviewers?: string;
  comment?: object;
  action?: string;
  previousBody?: string;
  sender?: string;
} = {}) {
  const run = {
    id: 99,
    event: "pull_request_review",
    path: ".github/workflows/translation-review-notification.yml",
    name: "Native Odia review notification",
    repository: { full_name: "owner/hub" },
    head_repository: { full_name: "contributor/hub", owner: { login: "contributor" } },
    head_branch: "topic",
    head_sha: "current",
    pull_requests: candidates,
    // Deliberately arbitrary: a notification result can never supply approval.
    conclusion: "success",
    ...runOverrides,
  };
  const associatedApi = vi.fn();
  const listedApi = vi.fn();
  const github = {
    rest: {
      actions: { getWorkflowRun: vi.fn(async () => ({ data: run })) },
      repos: {
        listPullRequestsAssociatedWithCommit: associatedApi,
        getCommit: vi.fn(async ({ ref: commitRef }: { ref: string }) => {
          if (commitError) throw commitError;
          return { data: { sha: commitRef, parents: mergeParents.map((sha) => ({ sha })) } };
        }),
      },
      pulls: {
        list: listedApi,
        get: vi.fn(async ({ pull_number }: { pull_number: number }) => ({
          data: prs.find((pr) => pr.number === pull_number),
        })),
      },
    },
    paginate: vi.fn(async (api) => {
      if (api === associatedApi) {
        if (associationError) throw associationError;
        return associated;
      }
      if (api === listedApi) return listed;
      throw new Error("Unexpected discovery API");
    }),
  };
  const core = { setOutput: vi.fn() };
  const context = {
    repo: { owner: "owner", repo: "hub" },
    eventName: event,
    ref,
    payload: {
      repository: { default_branch: "main" },
      workflow_run: { id: 99, conclusion: "failure", pull_requests: [{ number: 999 }] },
      pull_request: event === "pull_request_target" ? { number: payloadNumber } : undefined,
      issue: { number: payloadNumber },
      action,
      comment,
      changes: previousBody === undefined ? undefined : { body: { from: previousBody } },
      sender: { login: sender },
    },
  };
  const execute = Object.getPrototypeOf(async function () {}).constructor;
  await new execute("github", "context", "core", "process", script)(github, context, core, {
    env: { ODIA_NATIVE_REVIEWERS: reviewers },
  });
  return { github, core, associatedApi, listedApi };
}

describe("trusted review PR discovery", () => {
  it.each([
    { comment: { body: "Thanks", user: { login: "odia-reviewer" } } },
    { comment: { body: "odia-review-approved current", user: { login: "outsider" } } },
    { comment: { body: "odia-review-revoke old", user: { login: "odia-reviewer" } } },
    { comment: { body: "odia-review-approved current", user: null } },
    { reviewers: "" },
    { action: "unknown" },
  ])(
    "filters irrelevant or unauthorized comment events before publisher concurrency (case %#)",
    async (input) => {
      const result = await discover({ event: "issue_comment", ...input });
      expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[]");
      expect(result.github.rest.actions.getWorkflowRun).not.toHaveBeenCalled();
    },
  );
  it.each([
    {
      action: "created",
      comment: { body: " odia-review-revoke current ", user: { login: "ODIA-REVIEWER" } },
    },
    {
      action: "edited",
      comment: { body: "Withdrawn", user: { login: "odia-reviewer" } },
      previousBody: "odia-review-approved current",
    },
    {
      action: "deleted",
      comment: { body: "odia-review-approved current", user: { login: "odia-reviewer" } },
    },
  ])(
    "discovers relevant configured-reviewer comment changes including withdrawal (case %#)",
    async (input) => {
      const result = await discover({
        event: "issue_comment",
        sender: "different-maintainer",
        ...input,
      });
      expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[7]");
      expect(result.github.rest.pulls.get).toHaveBeenCalledWith(
        expect.objectContaining({ pull_number: 7 }),
      );
    },
  );
  it.each(["pull_request_target", "issue_comment"])(
    "resolves %s against the trusted API",
    async (event) => {
      const result = await discover({ event });
      expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[7]");
      expect(result.github.rest.actions.getWorkflowRun).not.toHaveBeenCalled();
      expect(result.github.rest.pulls.get).toHaveBeenCalledWith({
        owner: "owner",
        repo: "hub",
        pull_number: 7,
      });
    },
  );
  it("uses canonical run metadata and fresh source head rather than the event payload", async () => {
    const result = await discover({
      candidates: [{ number: 7, head: { sha: "merge-or-old" } }],
      runOverrides: { conclusion: "failure" },
    });
    expect(result.github.rest.actions.getWorkflowRun).toHaveBeenCalledWith({
      owner: "owner",
      repo: "hub",
      run_id: 99,
    });
    expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[7]");
    expect(result.github.rest.repos.getCommit).not.toHaveBeenCalled();
    expect(result.github.paginate).not.toHaveBeenCalled();
    expect(result.github.rest.pulls.get).not.toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 999 }),
    );
  });
  it("accepts a canonical merge run only when its parents match the current source and base", async () => {
    const result = await discover({
      candidates: [{ number: 7, head: { sha: "current" } }],
      runOverrides: { head_sha: "merge" },
    });
    expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[7]");
    expect(result.github.rest.repos.getCommit).toHaveBeenCalledWith({
      owner: "owner",
      repo: "hub",
      ref: "merge",
    });
  });
  it.each([["base-current", "old"], ["old-base", "current"], ["current"]])(
    "rejects a stale or invalid merge even if merge_commit_sha has not refreshed: %j",
    async (...parents) => {
      const result = await discover({
        runOverrides: { head_sha: "merge" },
        mergeParents: parents,
      });
      expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[]");
    },
  );
  it("does not treat a refreshed canonical association as proof of an old run's source head", async () => {
    const result = await discover({
      candidates: [{ number: 7, head: { sha: "current" } }],
      runOverrides: { head_sha: "old" },
    });
    expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[]");
    expect(result.github.rest.repos.getCommit).not.toHaveBeenCalled();
  });
  it("resolves a merge-SHA fork notification without canonical PR associations", async () => {
    const result = await discover({
      candidates: [],
      runOverrides: { head_sha: "merge" },
      listed: [{ number: 7 }],
      associationError: { status: 404 },
    });
    expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[7]");
    expect(result.github.paginate).toHaveBeenCalledWith(result.associatedApi, {
      owner: "owner",
      repo: "hub",
      commit_sha: "merge",
    });
  });
  it.each([undefined, { status: 404 }])(
    "fails closed when a merge run cannot be verified (%j)",
    async (commitError) => {
      const result = await discover({
        runOverrides: { head_sha: "merge" },
        mergeParents: [],
        commitError,
      });
      expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[]");
    },
  );
  it("reports unexpected merge-commit API failures", async () => {
    await expect(
      discover({ runOverrides: { head_sha: "merge" }, commitError: { status: 403 } }),
    ).rejects.toEqual({ status: 403 });
  });
  it.each(["schedule", "workflow_dispatch"])(
    "discovers all open PRs from the trusted default branch on %s without a notification",
    async (event) => {
      const result = await discover({
        event,
        listed: [{ number: 7 }, { number: 8 }, { number: 7 }, { number: 9 }],
        prs: [freshPr(), freshPr({ number: 8 }), freshPr({ number: 9, state: "closed" })],
      });
      expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[7,8]");
      expect(result.github.paginate).toHaveBeenCalledWith(result.listedApi, {
        owner: "owner",
        repo: "hub",
        state: "open",
        per_page: 100,
      });
      expect(result.github.rest.actions.getWorkflowRun).not.toHaveBeenCalled();
      expect(result.github.rest.repos.getCommit).not.toHaveBeenCalled();
    },
  );
  it("rejects manual reconciliation on a contributor branch", async () => {
    const result = await discover({ event: "workflow_dispatch", ref: "refs/heads/topic" });
    expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[]");
    expect(result.github.paginate).not.toHaveBeenCalled();
    expect(result.github.rest.pulls.get).not.toHaveBeenCalled();
  });
  it("resolves a fork's empty PR array using paginated commit associations", async () => {
    const result = await discover({ candidates: [], associated: [{ number: 7 }] });
    expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[7]");
    expect(result.github.paginate).toHaveBeenCalledWith(result.associatedApi, {
      owner: "owner",
      repo: "hub",
      commit_sha: "current",
    });
    expect(result.github.paginate).toHaveBeenCalledWith(result.listedApi, {
      owner: "owner",
      repo: "hub",
      state: "open",
      head: "contributor:topic",
      per_page: 100,
    });
  });
  it.each([undefined, { status: 404 }])(
    "resolves open forks when base-repository commit association is absent (%j)",
    async (associationError) => {
      const result = await discover({ candidates: [], listed: [{ number: 7 }], associationError });
      expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[7]");
      expect(result.github.paginate).toHaveBeenCalledWith(result.listedApi, {
        owner: "owner",
        repo: "hub",
        state: "open",
        head: "contributor:topic",
        per_page: 100,
      });
    },
  );
  it("rejects unexpected association failures rather than assuming a valid empty result", async () => {
    await expect(discover({ candidates: [], associationError: { status: 403 } })).rejects.toEqual({
      status: 403,
    });
  });
  it("still discovers an open fork when commit associations name other repositories", async () => {
    const result = await discover({
      candidates: [],
      associated: [{ number: 7 }],
      listed: [{ number: 8 }],
      prs: [freshPr({ headRepository: "other/hub" }), freshPr({ number: 8 })],
    });
    expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[8]");
  });
  it("emits each verified PR only once for independent per-PR publisher concurrency", async () => {
    const result = await discover({
      candidates: [
        { number: 7 },
        { number: 8 },
        { number: 7 },
        { number: "injection" },
        { number: 0 },
      ],
      prs: [freshPr(), freshPr({ number: 8 })],
    });
    expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[7,8]");
    expect(result.github.rest.pulls.get).toHaveBeenCalledTimes(2);
  });
  it.each([
    { event: "push" },
    { name: "Other workflow" },
    { path: ".github/workflows/untrusted.yml" },
    { repository: { full_name: "attacker/hub" } },
    { head_repository: null },
    { head_sha: null },
    { head_branch: null },
  ])(
    "ignores mismatched notification identity or missing head metadata: %j",
    async (runOverrides) => {
      const result = await discover({ runOverrides });
      expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[]");
      expect(result.github.rest.pulls.get).not.toHaveBeenCalled();
    },
  );
  it.each([
    { state: "closed" },
    { baseRepository: "other/hub" },
    { sha: "newer" },
    { sha: "merge" },
    { headRepository: "attacker/hub" },
    { ref: "other-branch" },
  ])("does not publish stale or unrelated candidate heads: %j", async (overrides) => {
    const result = await discover({ prs: [freshPr(overrides)] });
    expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[]");
  });
  it("emits an empty matrix when no open fork is associated with the notification", async () => {
    const result = await discover({ candidates: [] });
    expect(result.core.setOutput).toHaveBeenCalledWith("prs", "[]");
  });
  it("rejects direct untrusted review events in the discovery script", async () => {
    await expect(discover({ event: "pull_request_review" })).rejects.toThrow(
      "trusted base workflow event",
    );
  });
});
