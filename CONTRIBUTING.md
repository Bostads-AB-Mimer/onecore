# Contribution Guidelines

## Code Formatting

The `onecore` repository contains a global .prettierrc and each sub-package
may contain an individual eslint configuration and/or inherit the global default.

Make sure that you have plugins installed and enabled in your editor before 
committing any code.

Source code that does not follow the prettier and eslint rules will not pass
the CI workflows.

## Branching and Development Flow

This repository follows a simple, predictable branching model:

### Branch Types

#### Main Branch
- **`main`** always represents the latest **production release**.
- It must stay **green**, **buildable**, and **deployable** at all times.
- Hotfixes may be branched from `main` and merged back after verification, 
  unless they are small and/or urgent enough to merit immediate fast-tracking to 
  production via main.
- Non-build related commits, e.g, documentation updates, may be pushed
  directly to main or via PR.

#### Release Branches
- Example: `release/1.7.0`
- **`release/x.y.z`** branches represent work toward an upcoming release.
- Created from **main**
- Targets **main**
- Accepts PRs of completed, verified and accepted **epic/** and **feature/** branches 
  aimed at the release.
- Once testing is complete and the release is approved:
  - Tag the release (e.g. `v1.7.0`), then merge it to `main`.
  - Delete the branch

#### Epic Branches
- Example: `epic/uth-227-publish-parking-spaces`
- **`epic/<project>-<issue#>-descriptive-slug`**
- Created from **main**, or - only when necessary - from other **epic/*** branches.
- Targets **release/***
- Used for ongoing work on **large, multi-feature initiatives**.
- Epics are integration branches where feature branches are merged via PRs.
- Avoid basing epic branches on other epic branches if possible - this is likely to
  lead to merge hell.
- Code reviews should have performed in smaller steps and via PRs before commits 
  touch the epic branch, as a meaningful review of a long-lived branch is near 
  impossible.

#### Feature Branches
- Example: `feature/mim-348-add-credit-check`
- **`feature/<project>-<issue#>-descriptive-slug`**
- Created from either:
  - The corresponding `epic/...` branch (if part of a larger effort), or
  - `main` directly (for standalone work).
- Targets **epic/*** or **release/***
- Used for **individual features or fixes**.

### Hotfixes, chores and the will-not-be-easily-categorized Branches
- Example `hotfix/holy-moly-this-just-cannot-wait`
- Used for **hotfixes**, **documentation changes** and **non-build related** chores.
- Created from **main**
- Target **main**
- Use your judgement
  
The naming conventions of **main**, **release/*** and **epic/*** are required for the 
correct building and tagging of docker images for the individual applications and services.

Note that epic branches MUST follow the pattern of **`epic/<project>-<issue#>-descriptive-slug`**

#### Summary

| Branch Type | Example                              | Purpose                    | Merges Into             |
|-------------|--------------------------------------|----------------------------|-------------------------|
| `feature/`  | `feature/mim-348-add-credit-check`   | Individual feature/fix     | `epic/…` or `release/…` |
| `epic/`     | `epic/uth-227-publish-parking-space` | Multi-feature initiative   | `release/…`             |
| `release/`  | `release/1.7.0`                      | Stabilization for release  | `main`                  |
| `main`      | —                                    | Current production release | —                       |

### Typical Flow

```mermaid
gitGraph
  commit id: "main"
  branch release/1.7.0
  commit id: "prep release"
  checkout main
  branch epic/mim-678
  commit id: "epic start"
  branch feature/mim-701
  commit id: "feature work"
  commit id: "feature done"
  checkout epic/mim-678
  merge feature/mim-701
  checkout release/1.7.0
  merge epic/mim-678
  checkout main
  merge release/1.7.0 tag: "v1.7.0"
```

### Examples

#### Case: I am starting work on a new epic. What do I do?

1. Create and push a new epic branch from an up-to-date **main**

```sh
# Make sure you are currently on main
$ git checkout main

# Make sure your local copy is up to date with the remote
$ git pull origin main

# Use the Linear issue number for your epic here:
$ git checkout -b epic/lin-449-some-meaningful-epic-summary

# Push it to the remote and set the upstream tracking branch
git push -u origin epic/lin-449-some-meaningful-epic-summary
```

2. Start work on the first epic feature by creating a feature branch

```sh
# On your epic branch, using the Linear issue number for the feature
$ git checkout -b feature/lin-480-some-meaningful-feature-description
```

...and push it to create it at the remote at any given time

```sh
# On your epic branch, using the Linear issue number for the feature
$ git push -u origin feature/lin-480-some-meaningful-feature-description
```

3. Produce your most amazing work yet - and place a PR against your epic branch when done

4. Repeat step 2 and 3 until the epic is completed, tested and accepted

5. Place a PR against the **release** branch for the upcoming targeted release

---

#### Case: I am starting work on a new feature that is part of an ongoing epic. What do I do?

1. Create a new feature branch from an up-to-date **epic branch**

```sh
# Make sure you are currently on the target epic branch
$ git checkout epic/lin-449-some-meaningful-epic-summary

# Make sure your local copy is up to date with the remote
$ git pull origin epic/lin-449-some-meaningful-epic-summary

# Use the Linear issue number for your feature here:
$ git checkout -b feature/lin-572-the-best-feature-since-the-last-best-feature
```

2. Start work on your feature and push it at any given time

```sh
# On your epic branch, using the Linear issue number for the feature
$ git push -u origin feature/lin-572-the-best-feature-since-the-last-best-feature
```

3. Place a PR against the source **epic** branch when the feature is complete

---

#### Case: I am starting work on a new feature not related to an epic. What do I do?

1. Create a new feature branch from an up-to-date **main**

```sh
# Make sure you are currently on main
$ git checkout main

# Make sure your local copy is up to date with the remote
$ git pull origin main

# Use the Linear issue number for your feature here:
$ git checkout -b feature/lin-560-some-meaningful-feature-description
```

2. Start work on your feature and push it at any given time

```sh
# On your epic branch, using the Linear issue number for the feature
$ git push -u origin feature/lin-560-some-meaningful-feature-description
```

5. Place a PR against the **release** branch for the upcoming targeted release

---
