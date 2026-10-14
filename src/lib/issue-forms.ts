/** GitHub issue forms under `.github/ISSUE_TEMPLATE/` for non-code submissions. */
const NEW_ISSUE = "https://github.com/soumendrak/openodia-hub/issues/new";

export const ISSUE_FORMS = {
  event: { file: "event-submission.yml", label: "Submit an event" },
  organizer: { file: "organizer-submission.yml", label: "Add an organizer" },
  correction: { file: "event-correction.yml", label: "Correct or update an event" },
} as const;

export function issueFormUrl(form: keyof typeof ISSUE_FORMS): string {
  return `${NEW_ISSUE}?template=${ISSUE_FORMS[form].file}`;
}
