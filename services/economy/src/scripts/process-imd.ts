import fs from 'fs/promises'
import path from 'path'
import { logger } from '@onecore/utilities'
import { imdService } from '../services/imd-service'

async function main() {
  const inputPath = process.argv[2]
  const outputPath = process.argv[3]

  if (!inputPath || !outputPath) {
    throw new Error('Usage: process-imd <input.csv> <output.csv>')
  }

  const csv = await fs.readFile(path.resolve(inputPath), 'utf-8')
  const result = await imdService.processIMD(csv)

  if (!result.ok) {
    throw new Error('IMD: Processing failed')
  }

  const unprocessedPath = outputPath.replace(/\.csv$/, '-unprocessed.csv')

  await fs.writeFile(path.resolve(outputPath), result.data.enrichedCsv, 'utf-8')
  await fs.writeFile(
    path.resolve(unprocessedPath),
    result.data.unprocessedCsv,
    'utf-8'
  )

  logger.info(`Enriched CSV written to ${outputPath}`)
  logger.info(`Unprocessed CSV written to ${unprocessedPath}`)
  logger.info(
    `  ${result.data.enriched} rows exported, ${result.data.unprocessed.length} unprocessed`
  )
}

main().catch((err) => {
  logger.error(err)
})
