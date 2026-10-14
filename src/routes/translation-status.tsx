import { normalizeSearch } from "../lib/search";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getLocaleStatus } from "../lib/locale-status";
import { pageHead } from "../lib/seo";

export const Route = createFileRoute("/translation-status")({
  head: () =>
    pageHead({
      path: "translation-status",
      title: "Help translate OpenOdia",
      description:
        "Inspect registered English and Odia UI strings, see native-review progress, and contribute one translation.",
    }),
  component: TranslationStatus,
});

function TranslationStatus() {
  const report = getLocaleStatus();
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const entries = report.entries.filter(
    (entry) =>
      (!pendingOnly || entry.status !== "reviewed") &&
      normalizeSearch(`${entry.key} ${entry.english} ${entry.translation}`).includes(
        normalizeSearch(query),
      ),
  );
  const percent = (count: number) =>
    report.total === 0 ? 0 : Math.round((count / report.total) * 100);
  return (
    <div lang="en" className="mx-auto max-w-6xl px-4 pb-24">
      <p className="text-sm uppercase tracking-widest text-neon">Contribute one string</p>
      <h1 className="mt-3 font-display text-4xl font-bold md:text-6xl">Help translate OpenOdia.</h1>
      <p className="mt-5 max-w-3xl text-muted-foreground">{report.scope}</p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <dt>Odia strings present</dt>
          <dd className="mt-2 text-3xl font-semibold">
            {report.translated}/{report.total} · {percent(report.translated)}%
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <dt>Native-speaker reviewed</dt>
          <dd className="mt-2 text-3xl font-semibold">
            {report.reviewed}/{report.total} · {percent(report.reviewed)}%
          </dd>
        </div>
      </dl>
      <p className="mt-5 max-w-3xl text-sm text-muted-foreground">
        Draft wording remains marked “Needs native review”. A translation is reviewed only when its
        exact wording has a recorded reviewer and date. Presence is not a claim of linguistic
        accuracy or full-site translation.
      </p>
      <a
        className="mt-5 inline-block text-neon underline underline-offset-4"
        href="https://github.com/soumendrak/openodia-hub/blob/main/CONTRIBUTING.md#translate-one-string"
      >
        How to translate one string ↗
      </a>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <label className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-1">
          Find a string
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Key, English, or ଓଡ଼ିଆ"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(event) => setPendingOnly(event.target.checked)}
          />
          Needs translation or review
        </label>
      </div>
      <p aria-live="polite" className="mt-5 text-sm text-muted-foreground">
        {entries.length} strings shown
      </p>
      <ul className="mt-4 space-y-3">
        {entries.map((entry) => (
          <li key={entry.key} className="min-w-0 rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <code className="break-all text-sm">{entry.key}</code>
              <span className="text-sm">
                {entry.status === "reviewed"
                  ? "Native-reviewed"
                  : entry.status === "missing"
                    ? "Translation missing"
                    : "Needs native review"}
              </span>
            </div>
            <p className="mt-3">{entry.english}</p>
            <p lang="or" className="mt-2">
              {entry.translation.trim() || "ଅନୁବାଦ ଆବଶ୍ୟକ"}
            </p>
            <a
              className="mt-3 inline-block text-sm text-neon underline underline-offset-4"
              href="https://github.com/soumendrak/openodia-hub/edit/main/src/locales/or.ts"
              aria-label={`Edit Odia translation for ${entry.key}`}
            >
              Edit translation ↗
            </a>
          </li>
        ))}
      </ul>
      {entries.length === 0 && (
        <p className="mt-6">No matching strings. Clear the search or review filter.</p>
      )}
    </div>
  );
}
