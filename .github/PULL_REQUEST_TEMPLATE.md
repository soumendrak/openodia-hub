## Summary

<!-- What does this PR do? -->

## Checklist

- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] New code has tests (if applicable)
- [ ] Existing tests pass

## Odia translations

- [ ] Changed wording in `src/locales/or.ts` has a native Odia speaker review
- [ ] Updated the explicit tracking inventory and exact-wording review record where applicable

Once installed on the default branch, the trusted translation-review publisher adds
`needs-native-speaker-review` and reports the `native-review` commit status on the
current PR head. A configured reviewer may approve with a formal review or the exact
PR conversation comment `odia-review-approved <current full head SHA>` after reviewing
the wording. Account ownership or an intention to review does not count as approval.
The first workflow-installation PR needs manually verified native approval before landing.
The default-branch schedule also reconciles review changes when the notification is
missing, but GitHub may delay or drop scheduled runs. If a review signal was missed,
run **Native Odia review** manually with the default branch selected and verify its
completed status on the unchanged PR head and current review state before merging.
