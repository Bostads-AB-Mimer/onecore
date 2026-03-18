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

  await fs.writeFile(path.resolve(outputPath), result.data.csv, 'utf-8')

  logger.info(`Output written to ${outputPath}`)
  logger.info(
    `  ${result.data.enriched} rows exported, ${result.data.unmatched.length} unmatched`
  )
}

main().catch((err) => {
  logger.error(err)
})
