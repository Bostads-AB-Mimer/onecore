/*
 * One-off importer: uploads all *.jpg files under a local source directory to
 * the public MinIO bucket under the `bofaktablad/` key prefix.
 *
 * Usage:
 *   pnpm exec ts-node src/scripts/import-bofaktablad.ts [<source-dir>] [--dry-run]
 *
 * Defaults source-dir to B:\Bofaktablad. The --dry-run flag inspects every file
 * (including the existence check against the bucket) but performs no uploads.
 *
 * Idempotent: re-running skips any key that already exists in the public bucket.
 * Only the top level of the source dir is scanned — nested directories are
 * ignored to avoid silent key collisions on basename.
 */

import { promises as fs } from 'fs'
import * as path from 'path'

import {
  getPublicFileUrl,
  initializePublicBucket,
  publicFileExists,
  uploadPublicFile,
} from '../adapters/minio-adapter'

const DEFAULT_SOURCE_DIR = 'B:\\Bofaktablad'
const KEY_PREFIX = 'bofaktablad'
const CONTENT_TYPE = 'image/jpeg'
const PROGRESS_EVERY = 50

const parseArgs = (argv: string[]) => {
  let sourceDir: string | undefined
  let dryRun = false

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true
    } else if (!arg.startsWith('--') && sourceDir === undefined) {
      sourceDir = arg
    }
  }

  return { sourceDir: sourceDir ?? DEFAULT_SOURCE_DIR, dryRun }
}

const isJpg = (name: string): boolean => name.toLowerCase().endsWith('.jpg')

const main = async (): Promise<void> => {
  const { sourceDir, dryRun } = parseArgs(process.argv.slice(2))

  console.log(`Source dir:        ${sourceDir}`)
  console.log(
    `Mode:              ${dryRun ? 'DRY-RUN (no uploads)' : 'LIVE upload'}`
  )
  console.log(`Target key prefix: ${KEY_PREFIX}/`)
  console.log('---')

  // Idempotent — ensures the bucket and its anonymous read policy exist even
  // if the user hasn't run `pnpm run dev` since the policy was last applied.
  await initializePublicBucket()

  let entries
  try {
    entries = await fs.readdir(sourceDir, { withFileTypes: true })
  } catch (err) {
    throw new Error(`Failed to read source dir '${sourceDir}': ${String(err)}`)
  }

  const jpgFiles = entries
    .filter((e) => e.isFile() && isJpg(e.name))
    .map((e) => e.name)
    .sort()

  console.log(
    `Found ${jpgFiles.length} .jpg files at top level of ${sourceDir}`
  )
  console.log('---')

  let uploaded = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < jpgFiles.length; i++) {
    const fileName = jpgFiles[i]
    const fullPath = path.join(sourceDir, fileName)
    const key = `${KEY_PREFIX}/${fileName}`

    try {
      const alreadyExists = await publicFileExists(key)

      if (alreadyExists) {
        skipped++
        if (dryRun) {
          console.log(`[skip]         ${key} (already in bucket)`)
        }
      } else if (dryRun) {
        uploaded++
        console.log(`[would upload] ${key}`)
      } else {
        const buffer = await fs.readFile(fullPath)
        await uploadPublicFile(key, buffer, CONTENT_TYPE)
        uploaded++
      }
    } catch (err) {
      failed++
      console.error(`[fail] ${key}:`, err)
    }

    if ((i + 1) % PROGRESS_EVERY === 0) {
      console.log(
        `progress: ${i + 1}/${jpgFiles.length} (uploaded=${uploaded} skipped=${skipped} failed=${failed})`
      )
    }
  }

  console.log('---')
  console.log(`Total files seen:  ${jpgFiles.length}`)
  console.log(`Uploaded:          ${uploaded}${dryRun ? ' (planned)' : ''}`)
  console.log(`Skipped:           ${skipped}`)
  console.log(`Failed:            ${failed}`)

  if (jpgFiles.length > 0) {
    const sampleKey = `${KEY_PREFIX}/${jpgFiles[0]}`
    console.log(`Sample public URL: ${getPublicFileUrl(sampleKey)}`)
  }

  if (failed > 0) {
    throw new Error(`Import completed with ${failed} failed uploads`)
  }
}

main().catch((err) => {
  console.error('Import script failed:', err)
  process.exitCode = 1
})
