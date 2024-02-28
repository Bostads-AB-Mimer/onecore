# onecore-types

Package containing common types for ONECore

## Setup

### Install package

```shell script
npm i onecore-types
```

## For contributors

This packages uses [Release Please](https://github.com/google-github-actions/release-please-action) for automatic updates to the Changelog and for bumping version.

### Conventional Commit Messages

Conventional Commit Messages is what triggers the release action.

The most important prefixes you should have in mind are:

- fix: which represents bug fixes, and correlates to a SemVer patch.
- feat: which represents a new feature, and correlates to a SemVer minor.
- feat!:, or fix!:, refactor!:, etc., which represent a breaking change (indicated by the !) and will result in a SemVer major.

Read more [here](https://www.npmjs.com/package/release-please).

### Relasing a new version

When Relase Please detects a new commit, it creates a pull request for updating changelog and bumps version. Once merged the new version is published on npm.