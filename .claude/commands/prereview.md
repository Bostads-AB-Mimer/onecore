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
- check the relevant Linear issue so that I've covered the entire definition of done (the Linear issue id is at the start of the git branch name in the format MIM-{number}). If the issue isn't found or the branch name doesn't contain a Linear issue ID, skip this check and mention it in the review
- check the claude.md files and make sure I follow the instructions there

Give me feedback as if you were code reviewing a PR.
