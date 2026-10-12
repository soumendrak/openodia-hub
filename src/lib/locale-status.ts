import { en } from "../locales/en";
import { or } from "../locales/or";
import { ODIA_REVIEW_QUEUE, ODIA_REVIEWS } from "../locales/review";

export type NativeReview = { translation: string; reviewer: string; reviewedAt: string };
export type LocaleEntry = {
  key: string;
  english: string;
  translation: string;
  status: "missing" | "needs-review" | "reviewed";
};

/** Presence and native review are different measures; neither means every page is localized. */
export function assessLocale(
  english: Record<string, string>,
  translations: Partial<Record<string, string>>,
  queue: readonly string[],
  reviews: Record<string, NativeReview>,
) {
  const errors: string[] = [];
  const keys = Object.keys(english).sort();
  const tracked = new Set(queue);
  const tokens = (text: string) => (text.match(/\{+[^{}]*\}+|[{}]/g) ?? []).sort().join("|");
  for (const key of queue)
    if (!Object.hasOwn(english, key)) errors.push(`Unknown tracking key: ${key}`);
  for (const key of Object.keys(translations))
    if (!Object.hasOwn(english, key)) errors.push(`Unknown translation key: ${key}`);
  for (const key of Object.keys(reviews))
    if (!Object.hasOwn(english, key)) errors.push(`Unknown review key: ${key}`);
  const entries: LocaleEntry[] = keys.map((key) => {
    if (!tracked.has(key)) errors.push(`Untracked English key: ${key}`);
    if (!Object.hasOwn(translations, key)) errors.push(`Missing translation placeholder: ${key}`);
    const translation = translations[key] ?? "";
    const present = /(?=[\u0B00-\u0B7F])\p{L}/u.test(translation);
    if (translation.trim() && !present) errors.push(`Not an Odia translation: ${key}`);
    if (present && tokens(translation) !== tokens(english[key]))
      errors.push(`Placeholder mismatch: ${key}`);
    const review = reviews[key];
    const reviewed = Boolean(
      present &&
      review &&
      review.translation === translation &&
      review.reviewer.trim() &&
      /^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt) &&
      !Number.isNaN(Date.parse(review.reviewedAt)) &&
      new Date(review.reviewedAt).toISOString().slice(0, 10) === review.reviewedAt,
    );
    return {
      key,
      english: english[key],
      translation,
      status: !present ? "missing" : reviewed ? "reviewed" : "needs-review",
    };
  });
  const translated = entries.filter((entry) => entry.status !== "missing").length;
  const reviewed = entries.filter((entry) => entry.status === "reviewed").length;
  return {
    scope:
      "Registered navigation, home hero/opening/statistics, and footer UI only. Other page bodies and upstream content remain in their original language.",
    total: keys.length,
    translated,
    reviewed,
    entries,
    errors,
  };
}

export function getLocaleStatus() {
  return assessLocale(en, or, ODIA_REVIEW_QUEUE, ODIA_REVIEWS);
}
