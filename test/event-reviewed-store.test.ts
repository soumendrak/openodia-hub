// @vitest-environment node
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { persistReviewedEvent, restoreReviewedEvents } from "../src/lib/event-reviewed-store";
import { readEventsFromD1, type D1Like } from "../src/lib/events-store";
import { applyEventOverrides } from "../src/lib/event-lifecycle";
import type { Event } from "../src/data/events/types";

let mf: Miniflare;
let db: Awaited<ReturnType<Miniflare["getD1Database"]>>;
const proof = { evidenceUrl: "https://example.com/evidence", verifiedAt: "2026-10-12" };
const event: Event = {
  url: "https://example.com/event",
  title: "Workshop",
  description: "Details",
  community: "GDG Bhubaneswar",
  type: "Workshop",
  year: "2027",
  date: "2027-01-10",
  startDate: "2027-01-10",
};
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default {fetch: () => new Response('')}",
    d1Databases: ["EVENTS_DB"],
  });
  db = await mf.getD1Database("EVENTS_DB");
  for (const file of [
    "db/schema.sql",
    "db/migrations/0002_event_reviewed_metadata.sql",
    "db/migrations/0002_event_reviewed_metadata.sql",
  ]) {
    for (const sql of readFileSync(file, "utf8")
      .split(";")
      .filter((part) => part.trim()))
      await db.prepare(sql).run();
  }
  await db
    .prepare(
      "INSERT INTO events(id,url,title,community,type,start_date,description) VALUES(?,?,?,?,?,?,?)",
    )
    .bind(
      event.url,
      event.url,
      event.title,
      event.community,
      event.type,
      event.startDate!,
      event.description,
    )
    .run();
});
afterAll(() => mf.dispose());

describe("real D1 additive reviewed metadata", () => {
  it("round-trips a future cancellation, registration, eligibility and notices after live writes", async () => {
    const cancelled = applyEventOverrides(event, [
      {
        url: event.url,
        evidenceUrl: proof.evidenceUrl,
        reviewedAt: "2026-10-12",
        patch: {
          lifecycle: { state: "cancelled", ...proof },
          registration: { state: "closed", ...proof },
          attendance: { policy: "restricted", note: "Members only" },
          notices: [{ kind: "cancellation", text: "Organizer cancelled", ...proof }],
        },
      },
    ]);
    await persistReviewedEvent(db, cancelled);
    await db
      .prepare("UPDATE events SET title='Upstream update',is_active=1 WHERE id=?")
      .bind(event.url)
      .run();
    const restored = await readEventsFromD1(db);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      title: "Upstream update",
      lifecycle: { state: "cancelled" },
      registration: { state: "closed" },
      attendance: { policy: "restricted" },
      notices: [{ kind: "cancellation" }],
    });
    const older = {
      ...cancelled,
      reviewedAt: "2026-10-01",
      lifecycle: { state: "scheduled" as const, ...proof },
    };
    await persistReviewedEvent(db, older);
    expect((await restoreReviewedEvents(db, [event]))[0].lifecycle?.state).toBe("cancelled");
  });
  it("preserves an earlier cancellation when a newer independent registration correction is persisted", async () => {
    const registrationOnly = applyEventOverrides(event, [
      {
        url: event.url,
        evidenceUrl: proof.evidenceUrl,
        reviewedAt: "2026-10-13",
        patch: { registration: { state: "sold-out", ...proof } },
      },
    ]);
    await persistReviewedEvent(db, registrationOnly);
    const restored = (await readEventsFromD1(db))[0];
    expect(restored.lifecycle?.state).toBe("cancelled");
    expect(restored.registration?.state).toBe("sold-out");
    expect(restored.reviewedFields).toEqual(expect.arrayContaining(["lifecycle", "registration"]));
  });
  it("rejects a newer duration that conflicts with a separately reviewed start date", async () => {
    const fixture = { ...event, url: "https://example.com/conflicting-duration" };
    await persistReviewedEvent(
      db,
      applyEventOverrides(fixture, [
        {
          url: fixture.url,
          evidenceUrl: proof.evidenceUrl,
          reviewedAt: "2026-10-12",
          patch: { startDate: "2027-02-01" },
        },
      ]),
    );
    await expect(
      persistReviewedEvent(db, {
        ...fixture,
        reviewedAt: "2026-10-13",
        reviewedFields: ["endDate"],
        endDate: "2027-01-15",
      }),
    ).rejects.toThrow("Invalid reviewed event metadata");
    expect((await restoreReviewedEvents(db, [fixture]))[0].startDate).toBe("2027-02-01");
  });
  it("accepts old reviewed records without a field list and tolerates absent optional fields", async () => {
    const fixture = {
      ...event,
      url: "https://example.com/legacy-review",
      reviewedAt: "2026-10-12",
    };
    await persistReviewedEvent(db, fixture);
    const restored = (await restoreReviewedEvents(db, [fixture]))[0];
    expect(restored.title).toBe(event.title);
    await persistReviewedEvent(db, {
      ...fixture,
      url: "https://example.com/absent-reviewed-field",
      reviewedFields: ["location"],
    });
  });
  it("keeps legacy records valid and rejects invalid or corrupt reviewed payloads", async () => {
    await expect(persistReviewedEvent(db, event)).resolves.toBeUndefined();
    await expect(persistReviewedEvent(db, { ...event, reviewedAt: "bad-date" })).rejects.toThrow(
      "Invalid reviewed event metadata",
    );
    await db
      .prepare(
        "INSERT OR REPLACE INTO event_reviewed_metadata(event_id,payload_json,reviewed_at) VALUES(?,?,?)",
      )
      .bind("unrelated", "{}", "2026-10-12")
      .run();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const payload of [
      "not-json",
      "null",
      JSON.stringify({
        patch: {
          lifecycle: { state: "cancelled", evidenceUrl: "javascript:x", verifiedAt: "2026-10-12" },
        },
      }),
    ]) {
      await db
        .prepare("UPDATE event_reviewed_metadata SET payload_json=? WHERE event_id=?")
        .bind(payload, event.url)
        .run();
      expect((await restoreReviewedEvents(db, [event]))[0]).toEqual(event);
    }
    await db
      .prepare(
        "UPDATE event_reviewed_metadata SET payload_json='{}', reviewed_at='bad' WHERE event_id=?",
      )
      .bind(event.url)
      .run();
    expect((await restoreReviewedEvents(db, [event]))[0]).toEqual(event);
    await db
      .prepare(
        "UPDATE event_reviewed_metadata SET payload_json=?, reviewed_at='bad' WHERE event_id=?",
      )
      .bind(JSON.stringify({ patch: { registration: { state: "unknown" } } }), event.url)
      .run();
    expect((await restoreReviewedEvents(db, [event]))[0]).toEqual(event);
    expect(warn).toHaveBeenCalledWith("Invalid reviewed event metadata ignored");
    warn.mockRestore();
  });
  it("serves populated legacy rows before the sidecar migration", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const legacy: D1Like = {
      prepare(sql) {
        return {
          bind() {
            return this;
          },
          run: async () => ({}),
          all: async <T>() => {
            if (sql.includes("event_reviewed_metadata"))
              throw new Error("no such table: event_reviewed_metadata");
            return {
              results: [
                {
                  id: event.url,
                  url: event.url,
                  title: event.title,
                  community: event.community,
                  type: event.type,
                  start_date: event.startDate,
                  description: event.description,
                },
              ] as T[],
            };
          },
        };
      },
    };
    const restored = await readEventsFromD1(legacy);
    expect(restored[0]).toMatchObject({
      url: event.url,
      title: event.title,
      startDate: event.startDate,
    });
    expect(restored[0].reviewedAt).toBeUndefined();
    warn.mockRestore();
  });
  it("supports old databases before sidecar migration without hiding other storage failures", async () => {
    const makeDb = (error: unknown): D1Like => ({
      prepare(sql) {
        return {
          bind() {
            return this;
          },
          run: async () => ({}),
          all: async <T>() => {
            if (sql.includes("event_reviewed_metadata")) throw error;
            return { results: [] as T[] };
          },
        };
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(
      await readEventsFromD1(makeDb(new Error("no such table: event_reviewed_metadata"))),
    ).toEqual([]);
    await expect(readEventsFromD1(makeDb(new Error("database unavailable")))).rejects.toThrow(
      "database unavailable",
    );
    await expect(readEventsFromD1(makeDb("not-an-error"))).rejects.toBe("not-an-error");
    warn.mockRestore();
  });
});
