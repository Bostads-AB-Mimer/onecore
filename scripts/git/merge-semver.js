#!/usr/bin/env node

/**
 * This script is used by git, with the "semver" merge strategy enabled
 * (use `npm run git:configure` or `npm run dev:init` to enabled)
 *
 * Compares the version attribute of package.json from conflicting versions
 * and picks the highest semver number.
 */
const fs = require('fs')
const semver = require('semver')

/**
 * Read package.json from `path`
 */
const readPkgJson = (path) => {
  try {
    return {
      path,
      json: JSON.parse(fs.readFileSync(path, 'utf8')),
    }
  } catch {
    return null
  }
}

/**
 * Strips the version property from a parsed package.json
 */
const stripVersion = (pkgJson) => {
  const c = { ...pkgJson }
  delete c.version
  return c
}

/**
 * Check if a and b serializes to the same JSON string
 */
const equal = (a, b) => {
  return JSON.stringify(a) === JSON.stringify(b)
}

// Read ancestor, our version and their version of package.json
const [, , basePath, oursPath, theirsPath] = process.argv
const files = [basePath, oursPath, theirsPath].map(readPkgJson)

const [, ourFile, theirFile] = files

// If there are other changes than version, bail and let the conflict stand
if (!equal(stripVersion(ourFile), stripVersion(theirFile))) {
  process.exit(1)
}

// Sort versions and pick the highest semver version number
const versions = files
  .filter(Boolean)
  .map((f) => f.json.version)
  .filter(Boolean)
  .sort((a, b) => {
    const va = semver.valid(a)
    const vb = semver.valid(b)
    if (va && vb) return semver.gt(va, vb) ? -1 : 1
    if (va) return -1
    if (vb) return 1
    return 0
  })
const highest = versions[0]

// Set version and save updated file
ourFile.json.version = highest
fs.writeFileSync(ourFile.path, JSON.stringify(ourFile.json, null, 2), 'utf8')

// Make sure we exit with code 0 to signal to git that the operation was successful
process.exit(0)
