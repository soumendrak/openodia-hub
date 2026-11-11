// Odia runs keep inner spaces, joiners (ZWNJ/ZWJ) and a trailing danda together.
const RUNS =
  /[\u0B00-\u0B7F][\u0B00-\u0B7F\u200C\u200D]*(?:[\s\u0964\u0965]+[\u0B00-\u0B7F][\u0B00-\u0B7F\u200C\u200D]*)*[\u0964\u0965]?|[^\u0B00-\u0B7F]+/g;

/** Tag Odia script separately from the surrounding English catalog text. */
export function LanguageRuns({ text }: { text: string }) {
  const runs = text.match(RUNS) ?? [];
  return runs.map((run, index) =>
    /[\u0B00-\u0B7F]/.test(run) ? (
      <span key={index} lang="or">
        {run}
      </span>
    ) : /\p{L}/u.test(run) ? (
      <span key={index} lang="en">
        {run}
      </span>
    ) : (
      run
    ),
  );
}
