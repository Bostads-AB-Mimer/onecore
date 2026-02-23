---
description: Clear context & review changes on current branch
allowed-tools: Bash(git:*)
---

/clear

The parent branch is: $ARGUMENTS (default to main if no argument provided)

Check the local commits I've added to the current branch and make suggestions about what to improve:

- opportunities for refactoring
- potential bugs
- best practices to follow
- libraries to use
- check that I've followed established patterns in the project and used any apropriate utilities etc.
- check the claude.md files and make sure I follow the instructions there

Give me feedback as if you were code reviewing a PR.
