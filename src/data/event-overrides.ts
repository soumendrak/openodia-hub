import type { EventOverride } from "../lib/event-lifecycle";

/** Reviewed, version-controlled corrections keyed by canonical event URL.
 * Add only official evidence and review timestamps. No synthetic events are published here.
 * The initial release refreshes known URLs through this manual correction path.
 */
export const EVENT_OVERRIDES: EventOverride[] = [];
