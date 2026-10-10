import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ATTENDANCE_POLICIES, EVENT_TYPES } from "../src/data/events/types";
import { ORGANIZERS, ORGANIZER_KINDS } from "../src/data/organizers";
import { ISSUE_FORMS, issueFormUrl } from "../src/lib/issue-forms";

type Element = {
  type: string;
  id?: string;
  attributes: {
    label?: string;
    value?: string;
    description?: string;
    default?: number;
    options?: (string | { label: string })[];
  };
  validations?: { required?: boolean };
};
type Form = { name: string; description: string; title: string; labels: string[]; body: Element[] };

type Checkbox = { label: string; required?: boolean };
type FormName = keyof typeof ISSUE_FORMS;

const UNKNOWN = "Unknown / not stated";
const NAMES = Object.keys(ISSUE_FORMS) as FormName[];
const load = (name: FormName) =>
  parse(readFileSync(`.github/ISSUE_TEMPLATE/${ISSUE_FORMS[name].file}`, "utf8")) as Form;
const forms = Object.fromEntries(NAMES.map((name) => [name, load(name)])) as Record<FormName, Form>;
const form = forms.event;

function field(id: string, from: Form = form): Element {
  const element = from.body.find((e) => e.id === id);
  if (!element) throw new Error(`missing field ${id}`);
  return element;
}
const options = (id: string, from: Form = form) =>
  (field(id, from).attributes.options ?? []).map((o) => (typeof o === "string" ? o : o.label));
const required = (id: string, from: Form = form) => field(id, from).validations?.required === true;

describe.each([
  ["event", "[Event]: ", "enhancement"],
  ["organizer", "[Organizer]: ", "enhancement"],
  ["correction", "[Event correction]: ", "bug"],
] as const)("%s issue form: shared rules", (name, title, label) => {
  const current = forms[name];

  it("follows GitHub's issue-form rules", () => {
    const form = current;
    expect(form.name).toBe(ISSUE_FORMS[name].label);
    expect(form.description.trim()).not.toBe("");
    expect(form.title).toBe(title);
    expect(form.labels).toEqual([label]);
    const fields = form.body.filter((e) => e.type !== "markdown");
    for (const element of form.body) {
      expect(["markdown", "input", "textarea", "dropdown", "checkboxes"]).toContain(element.type);
    }
    for (const key of ["id", "label"] as const) {
      const values = fields.map((e) => (key === "id" ? e.id : e.attributes.label));
      expect(values.every((v) => v?.trim())).toBe(true);
      expect(new Set(values).size).toBe(values.length);
    }
    for (const element of fields.filter((e) => e.attributes.options)) {
      const values = options(element.id!, form);
      expect(values.length).toBeGreaterThan(0);
      expect(new Set(values).size).toBe(values.length);
      // GitHub reserves "None" for dropdowns.
      expect(values).not.toContain("None");
    }
  });

  it("states that publication is reviewed, and offers an explicit unknown", () => {
    const intro = current.body[0];
    expect(intro.type).toBe("markdown");
    expect(intro.attributes.value).toMatch(/requires maintainer review/);
    expect(intro.attributes.value).toContain(UNKNOWN);
  });

  it("requires every acknowledgement checkbox", () => {
    const boxes = (field("acknowledgement", current).attributes.options ?? []) as Checkbox[];
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(box.required).toBe(true);
  });

  it("asks for evidence and the date it was checked", () => {
    expect(required("evidence_url", current)).toBe(true);
    expect(required("evidence_checked_on", current)).toBe(true);
  });

  it("is linked from CONTRIBUTING.md with the same URL the site uses", () => {
    expect(readFileSync("CONTRIBUTING.md", "utf8")).toContain(
      `[${ISSUE_FORMS[name].label}](${issueFormUrl(name)})`,
    );
  });
});

describe("event submission issue form", () => {
  it("says listing is not registration", () => {
    expect(form.body[0].attributes.value).toMatch(/never means registration is open/);
  });

  it("lets an individual organizer enter their own name", () => {
    expect(field("organizer_name").attributes.description).toMatch(/your own name/);
  });

  it("offers every registry organizer by name and ID, plus a not-listed choice", () => {
    expect(options("organizer")).toEqual([
      ...ORGANIZERS.map((o) => `${o.canonicalName} (${o.id})`),
      "Not listed yet (name it below)",
    ]);
  });

  it("collects every Event field, with the event and registration URLs kept separate", () => {
    // An undated announcement can be submitted with precision "Unknown / not stated".
    for (const id of ["start_date", "end_date", "location", "theme", "registration_url"]) {
      expect(required(id)).toBe(false);
    }
    for (const id of [
      "title",
      "event_url",
      "organizer",
      // Required so a "Not listed yet" organizer is still named.
      "organizer_name",
      "event_type",
      "description",
      // Event.attendance.note is required alongside the policy.
      "attendance_evidence",
    ]) {
      expect(required(id)).toBe(true);
    }
    expect(options("event_type")).toEqual([...EVENT_TYPES, UNKNOWN]);
    // Event.type has no unknown value, so the form says how review resolves it.
    expect(field("event_type").attributes.description).toMatch(/maintainer then picks the type/);
    // Options read like "public — explicit open invitation".
    expect(options("attendance_policy").map((o) => o.split(" — ")[0])).toEqual([
      ...ATTENDANCE_POLICIES,
    ]);
  });

  it("defaults registration and fee to unknown and accepts unknown precision and format", () => {
    for (const id of ["registration", "fee"]) {
      // A dropdown preselects nothing unless `default` names an option index.
      expect(options(id)[field(id).attributes.default!]).toBe(UNKNOWN);
    }
    for (const id of ["date_precision", "mode"]) expect(options(id)).toContain(UNKNOWN);
  });

  it("links the forms through GitHub's template chooser", () => {
    const base = "https://github.com/soumendrak/openodia-hub/issues/new?template=";
    expect(issueFormUrl("event")).toBe(`${base}event-submission.yml`);
    expect(issueFormUrl("organizer")).toBe(`${base}organizer-submission.yml`);
    expect(issueFormUrl("correction")).toBe(`${base}event-correction.yml`);
  });
});

describe("organizer issue form", () => {
  const organizer = forms.organizer;

  it("collects the Organizer fields a contributor can know", () => {
    for (const id of ["canonical_name", "kind", "region", "description", "official_links"]) {
      expect(required(id, organizer)).toBe(true);
    }
    // Maintainers choose the final id; aliases and relationships may not exist.
    for (const id of ["aliases", "relationship", "suggested_id"]) {
      expect(required(id, organizer)).toBe(false);
    }
  });

  it("offers every organizer kind, plus unknown resolved in review", () => {
    // Options read like "community — community group".
    expect(options("kind", organizer).map((o) => o.split(" — ")[0])).toEqual([
      ...ORGANIZER_KINDS,
      UNKNOWN,
    ]);
    expect(field("kind", organizer).attributes.description).toMatch(/maintainer then picks/);
  });
});

describe("event correction issue form", () => {
  const correction = forms.correction;

  it("identifies the listing by its canonical URL and requires the change", () => {
    for (const id of ["event_url", "change", "details"]) {
      expect(required(id, correction)).toBe(true);
    }
    for (const id of ["fields", "duplicate_of"]) expect(required(id, correction)).toBe(false);
    // The URL is the listing's identity, so the form does not ask for the organizer again.
    expect(correction.body.some((e) => e.id === "organizer")).toBe(false);
  });

  it("covers postponement, cancellation, and duplicates", () => {
    expect(options("change", correction)).toEqual(
      expect.arrayContaining(["Postponed or rescheduled", "Cancelled", "Duplicate listing"]),
    );
    // Event has no cancelled status, so the form says what happens instead.
    expect(field("change", correction).attributes.description).toMatch(/removed after review/);
  });
});
