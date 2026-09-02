---
description: Clear context & review changes on current branch
allowed-tools: mcp__linear__get_issue, Bash(git:*)
---

/clear

The parent branch is: $ARGUMENTS (default to main if no argument provided)

Check the local commits I've added to the current branch and make suggestions about what to improve:

- opportunities for refactoring
- potential bugs
- best practices to follow
- libraries to use
- check that I've followed established patterns in the project and used any apropriate utilities etc.
- check the relevant Linear issue so that I've covered the entire definition of done. The Linear issue id is a team prefix + number (e.g. `MIM-32`, `AVTAL-215`, `UTH-236`, `eko-28`, `CSD-6196`, `DEV-33`) — don't assume a specific team, and match case-insensitively since the same team prefix appears both upper- and lowercase across branches (`UTH-236` vs `uth-207`, `AVTAL-211` vs `avtal-107`). It usually sits right after a `type/` segment (`fix/`, `feat/`, `feature/`, `bug/`, `chore/`, `epic/`) or a person's name (`username/uth-26-...`), but can also be at the very start of the branch name with no prefix at all. Take the match closest to the start of the branch name, not just any `[A-Za-z]{2,}-\d+` occurrence anywhere in the string — a naive "anywhere" search produces false positives like dependabot branches (`vite-6.4.3` matches as `vite-6`, a version number) — skip the Linear check entirely for `dependabot/*` branches. Also explicitly ignore a `pr-\d+` match (e.g. `pr-708-review`) — that's a PR number, not a Linear id, and "closest to start" alone won't catch it since it can legitimately sit at position 0, same as a real prefix-less ticket id. If the branch name has a bare number with no letter prefix (e.g. `feat/1129-create-lease...`), don't assume it's a non-Linear legacy ID — check the first commit message on the branch first, since some bare-numeric branches in this repo turned out to carry the real ticket id there instead (e.g. a branch named `feat/310-...` whose first commit says "Feat: UTH-310 ..."). Only skip if neither the branch name nor that commit message has a match, or the issue can't be found in Linear — and mention that you skipped it in the review
- check the claude.md files and make sure I follow the instructions there

Give me feedback as if you were code reviewing a PR.
