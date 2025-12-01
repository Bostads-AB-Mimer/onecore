/**
 * Script to publish external parking spaces from the old system
 *
 * This script:
 * 1. Reads parking spaces from a JSON file (old system data)
 * 2. Filters for external parking spaces (rentalObjectTypeCode: "POÄNGFRITT")
 * 3. Creates listings for all parking spaces that are currently vacant
 *
 * Usage:
 *   ts-node scripts/publish-external-parking-spaces.ts <path-to-json-file>
 */

import fs from 'fs'
import path from 'path'
import { logger } from '@onecore/utilities'

import * as publishService from '../src/services/lease-service/publish-external-parking-spaces'
import { db } from '../src/services/lease-service/adapters/db'
import type { OldSystemParkingSpace } from '../src/services/lease-service/publish-external-parking-spaces'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error(
      'Usage: ts-node scripts/publish-external-parking-spaces.ts <path-to-json-file>'
    )
    console.error(
      'Example: ts-node scripts/publish-external-parking-spaces.ts ./data/old-system-parking-spaces.json'
    )
    throw new Error('Missing required argument: path to JSON file')
  }

  const jsonFilePath = path.resolve(args[0])

  if (!fs.existsSync(jsonFilePath)) {
    throw new Error(`File not found: ${jsonFilePath}`)
  }

  logger.info({ filePath: jsonFilePath }, 'Reading parking spaces from file')

  let oldSystemSpaces: OldSystemParkingSpace[]
  try {
    const fileContent = fs.readFileSync(jsonFilePath, 'utf-8')
    oldSystemSpaces = JSON.parse(fileContent)
  } catch (error) {
    logger.error({ error }, 'Failed to read or parse JSON file')
    throw new Error('Failed to read or parse JSON file')
  }

  if (!Array.isArray(oldSystemSpaces)) {
    throw new Error('JSON file must contain an array of parking spaces')
  }

  logger.info(
    { count: oldSystemSpaces.length },
    'Starting publication process for parking spaces'
  )

  try {
    const result = await publishService.publishExternalParkingSpaces(
      oldSystemSpaces,
      db
    )

    logger.info('Publication process completed:')
    logger.info(`  Total processed: ${result.processed}`)
    logger.info(`  Already vacant in system: ${result.alreadyVacant}`)
    logger.info(`  Not vacant (skipped): ${result.notVacant}`)
    logger.info(`  Successfully created: ${result.created}`)
    logger.info(`  Failed (likely duplicates): ${result.failed}`)

    if (result.errors.length > 0) {
      logger.info('\nErrors:')
      result.errors.forEach(
        (err: { rentalObjectCode: string; error: string }) => {
          logger.error(`  ${err.rentalObjectCode}: ${err.error}`)
        }
      )
    }

    // Close database connection
    await db.destroy()

    // Script is successful if we created at least one listing
    // Failed listings are typically duplicates which is expected on re-runs
    if (result.created > 0) {
      logger.info(
        `Script completed successfully - created ${result.created} new listings`
      )
    } else if (result.failed > 0 && result.alreadyVacant > 0) {
      logger.info('No new listings created - all listings may already exist')
    }
  } catch (error) {
    logger.error({ error }, 'Script execution failed')
    await db.destroy()
    throw error
  }
}

main().catch((error) => {
  logger.error({ error }, 'Script failed')
  throw error
})
