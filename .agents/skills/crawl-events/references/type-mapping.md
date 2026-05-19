# Event Type Mapping

Maps labels from source pages to the `EventType` values in `src/data/events/types.ts`.

## GDG community.dev labels → EventType

| GDG label | EventType |
|-----------|-----------|
| Hackathon | `"Hackathon"` |
| Workshop / Study Group | `"Workshop"` |
| Speaker Session / Tech Talk | `"Talk"` |
| Info session | `"Talk"` (only if substantive; skip pure orientation/admin info sessions) |
| Conference | `"Conference"` |
| Summit | `"Summit"` |
| Free registration *(label only, no type)* | infer from event title/description |

## Odisha AI labels → EventType

| Event | EventType |
|-------|-----------|
| Annual Conference | `"Conference"` |
| Summit | `"Summit"` |
| Regional Summit | `"Summit"` |
| Research paper / publication event | `"Research"` |

## General heuristics

- If the event title contains "hackathon", "hack", "CTF", "arena", "forge" → `"Hackathon"`
- If it contains "bootcamp", "workshop", "study jam", "hands-on" → `"Workshop"`
- If it contains "talk", "session", "seminar", "panel", "webinar" → `"Talk"`
- If it contains "fest", "devfest", "conference", "summit", "congregation" → `"Conference"` or `"Summit"`
- When in doubt, prefer `"Workshop"` over `"Talk"` for interactive events.

## When to skip an event

Skip (do not add) events that are:
- Pure orientation / onboarding info sessions with no technical content
- Internal organizer meetings
- Duplicate entries for the same physical event (e.g. "ATLAS Final Results" and "ATLAS Final Evaluation" on the same day — pick the more descriptive one)
