import { describe, expect, it } from "vitest";
import { parseZizmor } from "../scripts/standards/zizmor";

type Segment = { Key: string } | { Index: number };

const location = (
  kind: string,
  path: string,
  row: number,
  route: Segment[] = [{ Key: "on" }],
  featureKind: unknown = "KeyOnly",
  feature = `  uses: ${path}@v${row}  `,
) => ({
  symbolic: {
    key: { Local: { verbatim_path: path } },
    kind,
    route: { route },
    feature_kind: featureKind,
  },
  concrete: { location: { start_point: { row } }, feature },
});
const report = (overrides: Record<string, unknown> = {}) => ({
  ident: "dangerous-triggers",
  desc: "use of fundamentally insecure workflow trigger",
  determinations: { severity: "High" },
  locations: [
    location("Related", ".github/workflows/a.yml", 1),
    location("Primary", ".github/workflows/b.yml", 2),
  ],
  ignored: false,
  ...overrides,
});
const injection = (job: string, step: number, expression: string) =>
  report({
    ident: "template-injection",
    locations: [
      location(
        "Primary",
        ".github/workflows/ci.yml",
        40,
        [
          { Key: "jobs" },
          { Key: job },
          { Key: "steps" },
          { Index: step },
          { Key: "with" },
          { Key: "script" },
        ],
        { Subfeature: { after: 14, fragment: { Raw: expression } } },
        `|\n  const url = \`\${{ ${expression} }}\`;\n`,
      ),
    ],
  });

describe("parseZizmor", () => {
  it("maps each finding to its primary location", () => {
    expect(parseZizmor([report()])).toEqual([
      {
        rule: "zizmor/dangerous-triggers",
        file: ".github/workflows/b.yml",
        line: 3,
        message: "High: use of fundamentally insecure workflow trigger",
        key: "on uses: .github/workflows/b.yml@v2",
      },
    ]);
  });

  it("keys a multi-line feature on its route and first line so unrelated edits keep the key", () => {
    const job = location(
      "Primary",
      ".github/workflows/a.yml",
      4,
      [{ Key: "jobs" }, { Key: "build" }],
      "Normal",
      "  build:\n    steps: []\n",
    );
    expect(parseZizmor([report({ locations: [job] })])[0]?.key).toBe("jobs.build build:");
  });

  it("keys block-scalar findings on the flagged expression and its job, ignoring step positions", () => {
    const keys = parseZizmor([
      injection("preview", 5, "steps.deploy.outputs.deployment-url"),
      injection("preview", 5, "github.event.pull_request.title"),
      injection("deploy", 5, "steps.deploy.outputs.deployment-url"),
      injection("preview", 7, "steps.deploy.outputs.deployment-url"),
    ]).map((finding) => finding.key);
    expect(keys).toEqual([
      "jobs.preview.steps.*.with.script steps.deploy.outputs.deployment-url",
      "jobs.preview.steps.*.with.script github.event.pull_request.title",
      "jobs.deploy.steps.*.with.script steps.deploy.outputs.deployment-url",
      "jobs.preview.steps.*.with.script steps.deploy.outputs.deployment-url",
    ]);
  });

  it("keys a workflow-level finding on its first line alone", () => {
    const root = location(
      "Primary",
      ".github/workflows/a.yml",
      0,
      [],
      "Normal",
      "name: CI\non: push\n",
    );
    expect(parseZizmor([report({ locations: [root] })])[0]?.key).toBe("name: CI");
  });

  it("falls back to the first location", () => {
    const only = report({ locations: [location("Related", ".github/workflows/a.yml", 0)] });
    expect(parseZizmor([only])[0]?.file).toBe(".github/workflows/a.yml");
  });

  it("keeps findings an inline zizmor ignore comment would hide", () => {
    expect(parseZizmor([report({ ignored: true })])).toHaveLength(1);
  });

  it("rejects output it does not recognise", () => {
    expect(() => parseZizmor([{ ident: "x" }])).toThrow();
  });
});
