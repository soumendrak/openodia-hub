import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Event } from "../src/data/events/types";
import { EVENT_OVERRIDES } from "../src/data/event-overrides";
import { events } from "../src/data/events";
import { EventUpdates } from "../src/components/EventUpdates";
import { dedupeEventsByResolvedUrl } from "../src/lib/event-url";
import { eventListSchema } from "../src/lib/jsonld";
import { filterNewEventsByUrl } from "../scripts/crawl-events.mjs";
import {
  applyEventOverrides,
  eventSchemaStatus,
  lifecycleLabel,
  mergeReviewedCollections,
  mergeReviewedEvents,
  normalizeEventDates,
  preciseDate,
  REGISTRATION_LABELS,
  resolveEventStatus,
  sortEventCollection,
  validEventPatch,
  validateOverrides,
  type EventOverride,
  type EventPatch,
} from "../src/lib/event-lifecycle";

const event: Event = {
  url: "https://example.com/event",
  title: "Community workshop",
  description: "Description",
  year: "2027",
  date: "10 January 2027",
  startDate: "2027-01-10",
  endDate: "2027-01-11",
  type: "Workshop",
  community: "GDG Bhubaneswar",
  attendance: { policy: "eligibility", note: "Students with ID" },
};
const proof = { evidenceUrl: "https://example.com/notice", verifiedAt: "2026-10-12" };
const correction = (patch: EventPatch, reviewedAt = "2026-10-12"): EventOverride => ({
  url: event.url,
  evidenceUrl: proof.evidenceUrl,
  reviewedAt,
  patch,
});
afterEach(cleanup);

describe("event lifecycle remains separate from dates, registration and eligibility", () => {
  it.each([
    ["2027-01-09", "upcoming"],
    ["2027-01-10", "live"],
    ["2027-01-11", "live"],
    ["2027-01-12", undefined],
  ] as const)("scheduled on %s yields %s", (today, expected) => {
    expect(resolveEventStatus(event, today)).toBe(expected);
  });
  it("rejects an override end date that precedes the base start", () => {
    expect(() => applyEventOverrides(event, [correction({ endDate: "2027-01-01" })])).toThrow(
      "Invalid reviewed event correction",
    );
  });
  it("keeps an existing end date when the reviewed start day is unchanged", () => {
    const multiDay = { ...event, endDate: "2027-01-11" };
    expect(
      applyEventOverrides(multiDay, [correction({ startDate: multiDay.startDate })]).endDate,
    ).toBe("2027-01-11");
    expect(
      applyEventOverrides(multiDay, [correction({ startDate: "2027-02-01" })]).endDate,
    ).toBeUndefined();
  });
  it("keeps known-event refresh manual while a reviewed correction survives the next crawl", () => {
    const checked = applyEventOverrides(event, [
      correction({ lifecycle: { state: "cancelled", ...proof } }),
    ]);
    const upstream = { ...event, url: event.url + "?utm_source=feed", status: "upcoming" as const };
    expect(filterNewEventsByUrl([upstream], new Set([event.url]))).toEqual([]);
    expect(mergeReviewedCollections([checked], [upstream], [], "2027-01-01")[0]).toMatchObject({
      lifecycle: { state: "cancelled" },
      status: undefined,
    });
  });
  it("places the nearest active opportunities ahead of a newest-first archive with stable ties", () => {
    const row = (url: string, startDate: string | undefined, status?: Event["status"]): Event => ({
      ...event,
      url,
      startDate,
      year: "2026",
      status,
    });
    expect(
      sortEventCollection([
        row("past-old", "2020-01-01"),
        row("future-later", "2099-03-01", "upcoming"),
        row("future-near", "2099-02-01", "upcoming"),
        row("past-new", "2025-01-01"),
        row("unknown-z", undefined),
        row("unknown-a", undefined),
        row("active-unknown", undefined, "upcoming"),
      ]).map((e) => e.url),
    ).toEqual([
      "active-unknown",
      "future-near",
      "future-later",
      "unknown-a",
      "unknown-z",
      "past-new",
      "past-old",
    ]);
  });
  it("exposes the dedicated registration destination independently of event and evidence", () => {
    render(
      <EventUpdates
        event={{
          ...event,
          registration: { state: "waitlist", url: "https://example.com/join-waitlist", ...proof },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Registration page" })).toHaveAttribute(
      "href",
      "https://example.com/join-waitlist",
    );
    expect(screen.getByRole("link", { name: "Registration evidence" })).toHaveAttribute(
      "href",
      proof.evidenceUrl,
    );
  });
  it("recognizes identical reviewed start dates as no schedule change", () => {
    const previous = {
      ...event,
      reviewedAt: "2026-10-12",
      reviewedFields: ["startDate", "endDate"] as const,
    };
    const next = { ...event, reviewedAt: "2026-10-13", reviewedFields: ["startDate"] as const };
    expect(
      mergeReviewedEvents(
        { ...previous, reviewedFields: [...previous.reviewedFields] },
        { ...next, reviewedFields: [...next.reviewedFields] },
      ).endDate,
    ).toBe(event.endDate);
  });
  it("keeps future cancellations and undated postponements out of active attendance", () => {
    expect(
      resolveEventStatus({ ...event, lifecycle: { state: "cancelled", ...proof } }, "2027-01-01"),
    ).toBeUndefined();
    expect(
      resolveEventStatus({ ...event, lifecycle: { state: "postponed", ...proof } }, "2027-01-01"),
    ).toBeUndefined();
    const replacement = {
      ...event,
      lifecycle: { state: "postponed" as const, replacementDate: "2027-02-01", ...proof },
    };
    expect(resolveEventStatus(replacement, "2027-01-20")).toBe("upcoming");
    expect(resolveEventStatus(replacement, "2027-02-01")).toBe("live");
    expect(resolveEventStatus(replacement, "2027-02-02")).toBeUndefined();
    const moved = normalizeEventDates(replacement);
    expect(moved).toMatchObject({ startDate: "2027-02-01", date: "2027-02-01", year: "2027" });
    expect(moved.endDate).toBeUndefined();
    expect(
      normalizeEventDates({ ...replacement, endDate: "2027-02-03", reviewedFields: ["endDate"] })
        .endDate,
    ).toBe("2027-02-03");
    expect(
      resolveEventStatus(
        { ...replacement, endDate: "2027-02-03", reviewedFields: ["endDate"] },
        "2027-02-02",
      ),
    ).toBe("live");
    expect(
      resolveEventStatus(
        { ...event, startDate: undefined, endDate: undefined, status: "live" },
        "2027-01-01",
      ),
    ).toBe("live");
  });
  it("never lets unreviewed or older upstream data undo a reviewed cancellation", () => {
    const cancelled = applyEventOverrides(event, [
      correction({ lifecycle: { state: "cancelled", ...proof } }),
    ]);
    const stale = {
      ...event,
      title: "New upstream title",
      lifecycle: { state: "scheduled" as const, ...proof },
      reviewedAt: "2026-10-01",
    };
    for (const live of [{ ...stale, reviewedAt: undefined }, stale]) {
      const merged = mergeReviewedEvents(cancelled, live);
      expect(merged.lifecycle?.state).toBe("cancelled");
      expect(merged.title).toBe("New upstream title");
      expect(merged.attendance).toEqual(event.attendance);
    }
    const newer = applyEventOverrides(cancelled, [
      correction({ lifecycle: { state: "scheduled", ...proof } }, "2026-10-13"),
    ]);
    expect(newer.lifecycle?.state).toBe("scheduled");
    const legacyReviewed = { ...cancelled, reviewedFields: undefined };
    expect(mergeReviewedEvents(legacyReviewed, { ...event, title: "overwrite" }).title).toBe(
      event.title,
    );
  });
  it("keeps older reviewed facts protected when a newer correction changes a different field", () => {
    const cancelled = applyEventOverrides(event, [
      correction({ lifecycle: { state: "cancelled", ...proof } }),
    ]);
    const closed = applyEventOverrides(cancelled, [
      correction({ registration: { state: "closed", ...proof } }, "2026-10-13"),
    ]);
    expect(closed.reviewedFields).toEqual(expect.arrayContaining(["lifecycle", "registration"]));
    expect(
      mergeReviewedEvents(closed, { ...event, lifecycle: { state: "scheduled", ...proof } })
        .lifecycle?.state,
    ).toBe("cancelled");
    expect(
      mergeReviewedEvents(cancelled, {
        ...event,
        registration: { state: "closed", ...proof },
        reviewedAt: "2026-10-13",
        reviewedFields: ["registration"],
      }).lifecycle?.state,
    ).toBe("cancelled");
  });
  it("normalizes a genuine replacement date and never carries an older reviewed duration forward", () => {
    const old = {
      ...event,
      endDate: "2027-04-01",
      reviewedAt: "2026-10-11",
      reviewedFields: ["endDate"] as Event["reviewedFields"],
    };
    const moved = applyEventOverrides(old, [
      correction({
        lifecycle: {
          state: "postponed",
          previousDate: "2027-01-10",
          replacementDate: "2027-02-01",
          ...proof,
        },
      }),
    ]);
    expect(moved).toMatchObject({ year: "2027", date: "2027-02-01", startDate: "2027-02-01" });
    expect(moved.endDate).toBeUndefined();
    expect(resolveEventStatus(moved, "2027-02-02")).toBeUndefined();
    const newDuration = applyEventOverrides(old, [
      correction({
        endDate: "2027-02-03",
        lifecycle: {
          state: "postponed",
          previousDate: "2027-01-10",
          replacementDate: "2027-02-01",
          ...proof,
        },
      }),
    ]);
    expect(newDuration.endDate).toBe("2027-02-03");
    const newDay = applyEventOverrides(event, [correction({ startDate: "2028-03-01" })]);
    expect(newDay).toMatchObject({ year: "2028", date: "2028-03-01", startDate: "2028-03-01" });
    expect(newDay.endDate).toBeUndefined();
  });
  it.each([
    {
      startDate: "2027-01-10",
      lifecycle: { state: "postponed", replacementDate: "2027-02-01", ...proof },
    },
    {
      endDate: "2027-01-11",
      lifecycle: { state: "postponed", replacementDate: "2027-02-01", ...proof },
    },
    {
      lifecycle: {
        state: "postponed",
        previousDate: "2027-02-01",
        replacementDate: "2027-02-01",
        ...proof,
      },
    },
  ] as EventPatch[])("rejects contradictory replacement/start/end claims", (patch) => {
    expect(validEventPatch(patch)).toBe(false);
  });

  it("deduplicates canonical URLs and preserves reviewed metadata for every surface", () => {
    const result = mergeReviewedCollections(
      [event],
      [{ ...event, url: event.url + "?utm_source=live" }],
      [
        correction({
          registration: { state: "closed", ...proof },
          notices: [{ kind: "registration", text: "Registration ended", ...proof }],
        }),
      ],
      "2027-01-01",
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      registration: { state: "closed" },
      status: "upcoming",
      attendance: { policy: "eligibility" },
    });
    expect(applyEventOverrides(event, [])).toBe(event);
    expect(() =>
      applyEventOverrides(event, [
        correction({
          lifecycle: { state: "cancelled", ...proof, evidenceUrl: "javascript:alert(1)" },
        }),
      ]),
    ).toThrow("Invalid reviewed event correction");
  });
  it("preserves a reviewed correction on a renamed canonical destination regardless of row order", async () => {
    const current = {
      ...event,
      url: "https://gdg.community.dev/events/details/current/",
      title: "Current title",
    };
    const legacy = applyEventOverrides(
      { ...event, url: "https://gdg.community.dev/events/details/old/" },
      [
        {
          ...correction({ lifecycle: { state: "cancelled", ...proof } }),
          url: "https://gdg.community.dev/events/details/old/",
        },
      ],
    );
    for (const rows of [
      [current, legacy],
      [legacy, current],
      [legacy, { ...legacy, url: legacy.url + "?utm_source=duplicate" }],
    ]) {
      const merged = await dedupeEventsByResolvedUrl(
        rows,
        async () => current.url,
        mergeReviewedEvents,
      );
      expect(merged).toHaveLength(1);
      expect(merged[0].lifecycle?.state).toBe("cancelled");
      expect(merged[0].url).toBe(current.url);
      if (rows.includes(current)) expect(merged[0].title).toBe("Current title");
    }
  });
  it("maps cancelled/postponed/rescheduled states into accurate schema.org values", () => {
    expect(eventSchemaStatus(event)).toBe("https://schema.org/EventScheduled");
    for (const [state, replacementDate, suffix, label] of [
      ["cancelled", undefined, "EventCancelled", "Cancelled"],
      ["postponed", undefined, "EventPostponed", "Postponed — new date unknown"],
      ["postponed", "2027-02-01", "EventRescheduled", "Rescheduled"],
    ] as const) {
      const fixture = { ...event, lifecycle: { state, replacementDate, ...proof } };
      expect(eventSchemaStatus(fixture)).toBe(`https://schema.org/${suffix}`);
      expect(lifecycleLabel(fixture)).toBe(label);
      const schema = eventListSchema([
        {
          name: fixture.title,
          url: fixture.url,
          description: fixture.description,
          startDate: replacementDate ?? event.startDate!,
          previousStartDate: event.startDate,
          lifecycle: fixture.lifecycle,
        },
      ]);
      expect(schema.itemListElement[0].item).toMatchObject({
        eventStatus: `https://schema.org/${suffix}`,
        previousStartDate: "2027-01-10",
      });
    }
    expect(lifecycleLabel(event)).toBe("Scheduled");
  });
});

describe("evidence validation and legacy compatibility", () => {
  it("requires actual dates and rejects unsafe or invented evidence", () => {
    for (const value of [null, "2026-02-30", "2026-1-1", "2026-99-99"])
      expect(preciseDate(value)).toBe(false);
    expect(preciseDate("2028-02-29")).toBe(true);
    const invalid: unknown[] = [
      null,
      [],
      { unknown: "field" },
      { title: " " },
      { description: 3 },
      { startDate: "2026-02-30" },
      { endDate: "unknown" },
      { startDate: "2027-01-02", endDate: "2027-01-01" },
      { attendance: null },
      { attendance: { policy: "everyone", note: "" } },
      { attendance: { policy: "unknown", note: 1 } },
      { lifecycle: null },
      { lifecycle: { state: "deleted", ...proof } },
      { lifecycle: { state: "cancelled", ...proof, replacementDate: "2027-01-01" } },
      { lifecycle: { state: "postponed", ...proof, replacementDate: "2027-02-30" } },
      { lifecycle: { state: "cancelled", evidenceUrl: "not-url", verifiedAt: "2026-10-12" } },
      { lifecycle: { state: "cancelled", evidenceUrl: 4, verifiedAt: "2026-10-12" } },
      { lifecycle: { state: "cancelled", ...proof, verifiedAt: "2026-10-12T99:99:99Z" } },
      { lifecycle: { state: "cancelled", ...proof, verifiedAt: "tomorrow" } },
      { registration: null },
      { registration: { state: "guess" } },
      { registration: { state: "open" } },
      { registration: { state: "unknown", url: "http://example.com" } },
      { registration: { state: "unknown", evidenceUrl: "javascript:alert(1)" } },
      { registration: { state: "unknown", verifiedAt: "tomorrow" } },
      { registration: { state: "unknown", url: "https://person@example.com/" } },
      { registration: { state: "unknown", url: "https://:credential@example.com/" } },
      { notices: null },
      { notices: "text" },
      { notices: [null] },
      { notices: [{ kind: "guess", text: "x", ...proof }] },
      { notices: [{ kind: "venue", text: " ", ...proof }] },
      { notices: [{ kind: "venue", text: 4, ...proof }] },
      { notices: [{ kind: "venue", text: "x".repeat(1001), ...proof }] },
      { notices: Array.from({ length: 21 }, () => ({ kind: "venue", text: "x", ...proof })) },
    ];
    for (const patch of invalid)
      expect(validEventPatch(patch as EventPatch), JSON.stringify(patch)).toBe(false);
    expect(validEventPatch({ registration: { state: "unknown" } })).toBe(true);
    expect(
      validEventPatch({ lifecycle: { state: "postponed", ...proof, previousDate: "2027-02-30" } }),
    ).toBe(false);
    expect(
      validEventPatch({
        lifecycle: {
          state: "postponed",
          ...proof,
          previousDate: "2027-01-10",
          replacementDate: "2027-02-01",
        },
      }),
    ).toBe(true);
    expect(
      validEventPatch({
        startDate: "2027-01-01",
        endDate: "2027-01-02",
        title: "Updated",
        description: "Details",
        location: "Online",
        attendance: { policy: "unknown", note: "Source silent" },
        registration: { state: "waitlist", url: "https://example.com/register", ...proof },
        notices: [{ kind: "venue", text: "Online", ...proof }],
        lifecycle: { state: "scheduled", ...proof },
      }),
    ).toBe(true);
    expect(
      validateOverrides([
        correction({}),
        { ...correction({}), url: event.url + "?utm_source=duplicate" },
      ]),
    ).toEqual(expect.arrayContaining([expect.stringContaining("Duplicate")]));
    expect(
      validateOverrides([
        { ...correction({}), url: "http://unsafe.example", reviewedAt: "not-a-time" },
      ]),
    ).toEqual(expect.arrayContaining([expect.stringContaining("Invalid")]));
    expect(validateOverrides(EVENT_OVERRIDES)).toEqual([]);
    for (const item of events)
      expect(
        validEventPatch({
          lifecycle: item.lifecycle,
          registration: item.registration,
          notices: item.notices,
        }),
      ).toBe(true);
  });
});

describe("event update UX", () => {
  it("preserves legacy cards and renders separate state/evidence/notice links", () => {
    const legacy = render(<EventUpdates event={event} />);
    expect(legacy.container).toBeEmptyDOMElement();
    cleanup();
    render(
      <article>
        <a href={event.url}>Event details</a>
        <EventUpdates
          event={{
            ...event,
            lifecycle: { state: "postponed", replacementDate: "2027-02-01", ...proof },
            registration: { state: "closed", ...proof },
            notices: [{ kind: "time", text: "The workshop moved to February", ...proof }],
          }}
        />
      </article>,
    );
    expect(screen.getByText(/Rescheduled/)).toHaveTextContent("2027-02-01");
    expect(screen.getByText(/Registration closed/)).toHaveTextContent(
      "Attendance eligibility is separate",
    );
    expect(screen.getByRole("link", { name: "Lifecycle evidence" })).toHaveAttribute(
      "href",
      proof.evidenceUrl,
    );
    expect(screen.getByRole("link", { name: "Registration evidence" })).toHaveAttribute(
      "rel",
      "noreferrer",
    );
    expect(document.querySelector("a a")).toBeNull();
    expect(screen.getByText(/The workshop moved/)).toBeInTheDocument();
  });
  it("does not invent a checked timestamp for an unknown registration reference", () => {
    const registration = { state: "unknown" as const, evidenceUrl: proof.evidenceUrl };
    expect(validEventPatch({ registration })).toBe(true);
    render(<EventUpdates event={{ ...event, registration }} />);
    expect(screen.getByRole("link", { name: "Registration evidence" })).toHaveAttribute(
      "href",
      proof.evidenceUrl,
    );
    expect(screen.queryByText(/Checked|undefined/)).not.toBeInTheDocument();
  });
  it("labels every registration state without inferring public admission or free fees", () => {
    for (const state of Object.keys(REGISTRATION_LABELS) as (keyof typeof REGISTRATION_LABELS)[]) {
      render(<EventUpdates event={{ ...event, registration: { state, ...proof } }} />);
      expect(screen.getByText(new RegExp(REGISTRATION_LABELS[state]))).toBeInTheDocument();
      expect(screen.queryByText(/free|open to all/i)).toBeNull();
      cleanup();
    }
    render(<EventUpdates event={{ ...event, lifecycle: { state: "cancelled", ...proof } }} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});

describe("per-field review timestamps", () => {
  const base = { url: "https://example.org/e", title: "t", startDate: "2099-01-01" } as Event;
  const cancelled = (state: "cancelled" | "postponed", at: string) =>
    ({
      ...base,
      lifecycle: { state, evidenceUrl: "https://example.org/p", verifiedAt: at.slice(0, 10) },
      reviewedAt: at,
      reviewedFields: ["lifecycle"],
    }) as Event;
  it("does not promote a retained lifecycle to an unrelated newer registration review", () => {
    const registration = {
      ...base,
      registration: { url: "https://example.org/r" },
      reviewedAt: "2026-10-03T00:00:00Z",
      reviewedFields: ["registration"],
    } as unknown as Event;
    const merged = mergeReviewedEvents(
      mergeReviewedEvents(cancelled("postponed", "2026-10-01T00:00:00Z"), registration),
      cancelled("cancelled", "2026-10-02T00:00:00Z"),
    );
    expect(merged.lifecycle?.state).toBe("cancelled");
    expect(merged.registration).toEqual({ url: "https://example.org/r" });
    expect(merged.reviewedTimes).toEqual({
      lifecycle: "2026-10-02T00:00:00.000Z",
      registration: "2026-10-03T00:00:00.000Z",
    });
  });
  it("keeps a newer retained lifecycle over an older one", () => {
    const merged = mergeReviewedEvents(
      cancelled("cancelled", "2026-10-02T00:00:00Z"),
      cancelled("postponed", "2026-10-01T00:00:00Z"),
    );
    expect(merged.lifecycle?.state).toBe("cancelled");
  });
});
