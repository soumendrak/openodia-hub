Stage or stash every change before you commit, and never use `--no-verify` or any other way to skip the pre-commit hook. The hook and `just check` run `bun scripts/standards.ts`, the same standards CI runs, and it refuses untracked files and unstaged edits.

A `no-new-comments` entry in `scripts/standards/exceptions.json` is only needed by the PR that adds the comment. Delete it in the next PR once the comment is on main: the standards flag it only after the comment text is gone, so a forgotten entry fails the exceptions step for everyone when it expires.
