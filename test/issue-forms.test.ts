import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ATTENDANCE_POLICIES, EVENT_TYPES } from "../src/data/events/types";
import { ORGANIZERS } from "../src/data/organizers";
import { ISSUE_FORMS, issueFormUrl } from "../src/lib/issue-forms";

type Element = {
  type: string;
  id?: string;
  attributes: {
    label?: string;
    value?: string;
    default?: number;
    options?: (string | { label: string })[];
  };
  validations?: { required?: boolean };
};
type Form = { name: string; description: string; title: string; labels: string[]; body: Element[] };

const UNKNOWN = "Unknown / not stated";
const form = parse(
  readFileSync(`.github/ISSUE_TEMPLATE/${ISSUE_FORMS.event.file}`, "utf8"),
) as Form;

function field(id: string): Element {
  const element = form.body.find((e) => e.id === id);
  if (!element) throw new Error(`missing field ${id}`);
  return element;
}
const options = (id: string) =>
  (field(id).attributes.options ?? []).map((o) => (typeof o === "string" ? o : o.label));
const required = (id: string) => field(id).validations?.required === true;

describe("event submission issue form", () => {
  it("follows GitHub's issue-form rules", () => {
    expect(form.name).toBe(ISSUE_FORMS.event.label);
    expect(form.description.trim()).not.toBe("");
    expect(form.title).toBe("[Event]: ");
    expect(form.labels).toEqual(["enhancement"]);
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
      const values = options(element.id!);
      expect(values.length).toBeGreaterThan(0);
      expect(new Set(values).size).toBe(values.length);
      // GitHub reserves "None" for dropdowns.
      expect(values).not.toContain("None");
    }
  });

  it("states that publication is reviewed and listing is not registration", () => {
    const intro = form.body[0];
    expect(intro.type).toBe("markdown");
    expect(intro.attributes.value).toMatch(/requires maintainer review/);
    expect(intro.attributes.value).toMatch(/never means registration is open/);
    expect(intro.attributes.value).toContain(UNKNOWN);
  });

  it("offers every registry organizer by name and ID, plus a not-listed choice", () => {
    expect(options("organizer")).toEqual([
      ...ORGANIZERS.map((o) => `${o.canonicalName} (${o.id})`),
      "Not listed yet (name it below)",
    ]);
  });

  it("collects every Event field, with the event and registration URLs kept separate", () => {
    for (const id of ["end_date", "location"]) expect(field(id)).toBeDefined();
    for (const id of [
      "title",
      "event_url",
      "organizer",
      // Required so a "Not listed yet" organizer is still named.
      "organizer_name",
      "event_type",
      "start_date",
      "description",
      // Event.attendance.note is required alongside the policy.
      "attendance_evidence",
    ]) {
      expect(required(id)).toBe(true);
    }
    expect(required("registration_url")).toBe(false);
    expect(options("event_type")).toEqual([...EVENT_TYPES, UNKNOWN]);
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

  it("asks for evidence and the date it was checked", () => {
    expect(required("evidence_url")).toBe(true);
    expect(required("evidence_checked_on")).toBe(true);
  });

  it("links the form through GitHub's template chooser", () => {
    expect(issueFormUrl("event")).toBe(
      "https://github.com/soumendrak/openodia-hub/issues/new?template=event-submission.yml",
    );
  });
});
