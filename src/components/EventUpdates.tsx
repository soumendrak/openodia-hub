import type { Event } from "../data/events/types";
import { lifecycleLabel, REGISTRATION_LABELS } from "../lib/event-lifecycle";

/** Separate links remain valid inside an article, never nested in the event destination. */
export function EventUpdates({ event }: { event: Event }) {
  if (!event.lifecycle && !event.registration && !event.notices?.length) return null;
  return (
    <div className="min-w-0 space-y-2 text-sm [overflow-wrap:anywhere]">
      {event.lifecycle && (
        <p className="font-semibold">
          {lifecycleLabel(event)}
          {event.lifecycle.replacementDate ? ` · ${event.lifecycle.replacementDate}` : ""}
        </p>
      )}
      {event.registration && (
        <p>{REGISTRATION_LABELS[event.registration.state]} · Attendance eligibility is separate.</p>
      )}
      {event.lifecycle && (
        <p className="text-xs text-muted-foreground">
          <a
            className="underline underline-offset-4"
            href={event.lifecycle.evidenceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Lifecycle evidence
          </a>{" "}
          · Checked {event.lifecycle.verifiedAt}
        </p>
      )}
      {event.registration?.evidenceUrl && (
        <p className="text-xs text-muted-foreground">
          <a
            className="underline underline-offset-4"
            href={event.registration.evidenceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Registration evidence
          </a>{" "}
          {event.registration.verifiedAt && <>· Checked {event.registration.verifiedAt}</>}
        </p>
      )}
      {(event.notices ?? []).map((notice, index) => (
        <p key={`${notice.kind}-${notice.verifiedAt}-${index}`}>
          {notice.text}{" "}
          <a
            className="underline underline-offset-4 text-xs"
            href={notice.evidenceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
          <span className="text-xs text-muted-foreground"> · Checked {notice.verifiedAt}</span>
        </p>
      ))}
    </div>
  );
}
