# Canonical event model (`src/events`)

`src/events/model.ts` holds the canonical event model. Its runtime classes are the real guarantee. `ExactDates`, `Upstream`, `Reviewed`, `AttendanceRecord` and `NoticeRecord` are built only by the module's builders (`ExactDates.of`, `upstream`, `reviewed`, `attendance` and `notice`), and each instance is frozen. Two checks also hold at runtime against a forged value. `ExactDates` checks a module-private key in its constructor, and `notices()` rejects anything that isn't a `NoticeRecord`, including a plain object with the same fields. The other builders trust their branded inputs.

The string types (`IsoDay`, `Text`, `HttpsUrl` and the rest) exist only at compile time. All of them share one `unique symbol` brand and differ only in a type-level label, so nothing marks them at runtime.

The `isolated/owned-types` lint rule is a guard against copy-paste, not a type guarantee. It reports the usual ways of forging a model value outside `src/events`: casts, `JSON.parse`, bodiless declarations and generic helpers. It has known bypasses, though, such as a generic overload signature inside a generic helper or a nested result of an ambient (`.d.ts`) generic declaration. The full list is in the `isolated/owned-types` pull request (#164). Code that needs a trustworthy value should get it from the module's builders, not from the lint passing.
