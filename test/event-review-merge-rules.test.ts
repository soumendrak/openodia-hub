// @vitest-environment node
import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  normalizeReviewedTimes,
  persistReviewedEvent,
  restoreReviewedEvents,
  REVIEWED_UPSERT_SQL,
} from "../src/lib/event-reviewed-store";
import { mergeReviewedEvents } from "../src/lib/event-lifecycle";
import type { D1Like } from "../src/lib/events-store";
import type { Event } from "../src/data/events/types";

const proof = { evidenceUrl: "https://example.com/evidence", verifiedAt: "2026-10-10" };
const base: Event = {
  url: "https://example.com/merge-rules",
  title: "Workshop",
  community: "GDG Bhubaneswar",
  type: "Workshop",
  year: "2027",
  date: "2027-01-10",
  startDate: "2027-01-10",
  endDate: "2027-01-20",
};

let mf: Miniflare;
let db: D1Like;
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default {fetch: () => new Response('')}",
    d1Databases: ["EVENTS_DB"],
  });
  db = await mf.getD1Database("EVENTS_DB");
  for (const sql of readFileSync("db/schema.sql", "utf8")
    .split(";")
    .filter((part) => part.trim()))
    await db.prepare(sql).run();
});
afterAll(() => mf.dispose());
afterEach(async () => {
  await db.prepare("DELETE FROM event_reviewed_metadata").run();
});

const upsert = (patch: object, reviewedTimes: object, reviewedAt: string) =>
  db
    .prepare(REVIEWED_UPSERT_SQL)
    .bind(
      JSON.stringify([
        {
          event_id: base.url,
          payload_json: JSON.stringify({
            patch,
            reviewedFields: Object.keys(patch),
            reviewedTimes,
          }),
          reviewed_at: reviewedAt,
        },
      ]),
    )
    .run();
const stored = async () => {
  const { results } = await db
    .prepare("SELECT payload_json FROM event_reviewed_metadata WHERE event_id = ?")
    .bind(base.url)
    .all<{ payload_json: string }>();
  return JSON.parse(results[0].payload_json);
};

describe("reviewed metadata merge rules", () => {
  it("keeps the newest per-field review time so a later stale write cannot win (R7)", async () => {
    const newer = "2026-10-12T00:00:00.000Z";
    const stale = "2026-10-10T00:00:00.000Z";
    const between = "2026-10-11T00:00:00.000Z";
    const cancelled = { state: "cancelled", ...proof };
    await upsert({ lifecycle: cancelled }, { lifecycle: newer }, newer);
    await upsert({ lifecycle: { state: "scheduled", ...proof } }, { lifecycle: stale }, stale);
    expect((await stored()).reviewedTimes.lifecycle).toBe(newer);
    // Reviewed after the stale write but before the stored one: it must still lose.
    await upsert({ lifecycle: { state: "postponed", ...proof } }, { lifecycle: between }, between);
    const payload = await stored();
    expect(payload.patch.lifecycle).toEqual(cancelled);
    expect(payload.reviewedTimes.lifecycle).toBe(newer);
  });

  it("keeps the existing value on an exact per-field review-time tie (R14)", () => {
    const at = "2026-10-12T00:00:00.000Z";
    const previous: Event = {
      ...base,
      lifecycle: { state: "cancelled", ...proof },
      reviewedAt: at,
      reviewedFields: ["lifecycle"],
    };
    const next: Event = {
      ...base,
      lifecycle: { state: "scheduled", ...proof },
      reviewedAt: at,
      reviewedFields: ["lifecycle"],
    };
    expect(mergeReviewedEvents(previous, next).lifecycle).toEqual(previous.lifecycle);
    expect(mergeReviewedEvents(next, previous).lifecycle).toEqual(next.lifecycle);
  });

  it("lets only a newer review's day change drop a reviewed end date (R13)", () => {
    const previous: Event = {
      ...base,
      startDate: "2027-02-01",
      endDate: "2027-02-02",
      reviewedAt: "2026-10-12T00:00:00.000Z",
      reviewedFields: ["startDate", "endDate"],
    };
    const olderMove: Event = {
      ...base,
      startDate: "2027-03-01",
      endDate: "2027-03-01",
      reviewedAt: "2026-10-10T00:00:00.000Z",
      reviewedFields: ["startDate"],
    };
    const merged = mergeReviewedEvents(previous, olderMove);
    expect(merged.startDate).toBe("2027-02-01");
    expect(merged.endDate).toBe("2027-02-02");
    expect(merged.reviewedTimes?.endDate).toBe("2026-10-12T00:00:00.000Z");
    // The same move reviewed later does change the day and drops the old end.
    const newerMove = { ...olderMove, reviewedAt: "2026-10-13T00:00:00.000Z" };
    expect(mergeReviewedEvents(previous, newerMove).reviewedFields).not.toContain("endDate");
  });

  it("does not keep the base duration when a restored review moves the day (R11)", async () => {
    await persistReviewedEvent(db, {
      url: base.url,
      lifecycle: {
        state: "postponed",
        previousDate: "2027-01-10",
        replacementDate: "2027-01-12",
        ...proof,
      },
      reviewedAt: "2026-10-12",
      reviewedFields: ["lifecycle"],
    });
    const [restored] = await restoreReviewedEvents(db, [base]);
    expect(restored.startDate).toBe("2027-01-12");
    // The old 10-20 Jan range is not a reviewed duration for the new day.
    expect(restored.endDate).toBeUndefined();
    // An unchanged day keeps the base duration.
    const [unchanged] = await restoreReviewedEvents(db, [
      { ...base, lifecycle: { state: "postponed", replacementDate: "2027-01-12", ...proof } },
    ]);
    expect(unchanged.endDate).toBe("2027-01-20");
  });
});

describe("review timestamp normalisation", () => {
  it("stores every per-field time as a full ISO instant", () => {
    // As strings, '...:00Z' sorts above the later '...:00.500Z'.
    expect("2026-10-12T00:00:00Z" > "2026-10-12T00:00:00.500Z").toBe(true);
    expect(
      normalizeReviewedTimes(
        { lifecycle: "2026-10-12T00:00:00Z", registration: "2026-10-11" },
        {
          lifecycle: { state: "cancelled", ...proof },
          registration: { state: "closed", ...proof },
        },
        "2026-10-12T00:00:00.500Z",
      ),
    ).toEqual({ lifecycle: "2026-10-12T00:00:00.000Z", registration: "2026-10-11T00:00:00.000Z" });
  });

  it("drops unknown, unpatched and malformed keys and clamps times to the row review", () => {
    expect(
      normalizeReviewedTimes(
        {
          lifecycle: "2099-01-01T00:00:00Z",
          registration: "2026-10-11",
          title: "2026-10-11",
          notices: "yesterday",
        },
        { lifecycle: { state: "cancelled", ...proof }, notices: [] },
        "2026-10-12T00:00:00.000Z",
      ),
    ).toEqual({ lifecycle: "2026-10-12T00:00:00.000Z" });
    expect(normalizeReviewedTimes(undefined, {}, "2026-10-12")).toBeUndefined();
    expect(normalizeReviewedTimes("2026-10-12", {}, "2026-10-12")).toBeUndefined();
  });

  it("restores clamped stored times so a future-claimed field cannot outrank later reviews", async () => {
    await upsert(
      { lifecycle: { state: "cancelled", ...proof } },
      { lifecycle: "2099-01-01T00:00:00Z", bogus: "2026-10-12" },
      "2026-10-12T00:00:00.000Z",
    );
    const [restored] = await restoreReviewedEvents(db, [base]);
    expect(restored.reviewedTimes).toEqual({ lifecycle: "2026-10-12T00:00:00.000Z" });
    await persistReviewedEvent(db, {
      url: base.url,
      lifecycle: { state: "scheduled", ...proof, verifiedAt: "2026-10-13" },
      reviewedAt: "2026-10-13",
      reviewedFields: ["lifecycle"],
    });
    const payload = await stored();
    expect(payload.patch.lifecycle.state).toBe("scheduled");
    expect(payload.reviewedTimes.lifecycle).toBe("2026-10-13T00:00:00.000Z");
  });
});
