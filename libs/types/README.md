# onecore-types

Package containing common types for ONECore

## Setup

### Install package

```shell script
npm i onecore-types
```

## For contributors

This packages uses [Release Please](https://github.com/google-github-actions/release-please-action) for automatic updates to the Changelog and for bumping version.

## Local development

To use a locally updated version of this package, the easiest way it to use npm link.

1. Run `npm link` inside this folder
2. In other projects using this package, run `npm link onecore-types`
3. Make sure you run `npm run build` every time you make changes to this package.
4. When done, unlink in the other projects with `npm unlink --no-save onecore-types`


## Relasing a new version

### Conventional Commit Messages

Conventional Commit Messages is what triggers the release action.

The most important prefixes you should have in mind are:

- fix: which represents bug fixes, and correlates to a SemVer patch.
- feat: which represents a new feature, and correlates to a SemVer minor.
- feat!:, or fix!:, refactor!:, etc., which represent a breaking change (indicated by the !) and will result in a SemVer major.

Read more [here](https://www.npmjs.com/package/release-please).

### Versions and publishing to npm

1. Make sure the latest version is built with `npm run build` before pushing.
2. When Relase Please detects that a new commit containing any of the prefixes listed above, it creates a pull request for updating changelog and bumps version. Once merged the new version is published on npm. Do not change versions in package.json manually.
