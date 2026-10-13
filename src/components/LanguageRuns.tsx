/** Tag Odia script separately from the surrounding English catalog text. */
export function LanguageRuns({ text }: { text: string }) {
  const runs = text.match(/[\u0B00-\u0B7F]+|[^\u0B00-\u0B7F]+/g) ?? [];
  return runs.map((run, index) => (
    <span key={index} lang={/[\u0B00-\u0B7F]/.test(run) ? "or" : "en"}>
      {run}
    </span>
  ));
}
