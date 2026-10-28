import fs from 'fs'
import path from 'path'
import { logger } from '@onecore/utilities'
import config from '../common/config'
import { getHomeInsuranceExport } from '../adapters/leasing-adapter'
import { convertHomeInsuranceToXlsx } from '../processes/reports/converters/excelConverter'
import * as sftpAdapter from '../adapters/sftp-adapter'

export async function handleHomeInsuranceExport() {
  const dateStr = new Date().toISOString().split('T')[0]
  const fileName = `Hemforsakring_LF_${dateStr}.xlsx`

  logger.info('Starting home insurance export')

  const result = await getHomeInsuranceExport()
  if (!result.ok) {
    throw new Error(`Failed to fetch home insurance export: ${result.err}`)
  }

  const rows = result.data
  logger.info({ rowCount: rows.length }, 'Fetched home insurance rows')

  const xlsxBuffer = await convertHomeInsuranceToXlsx(rows)

  if (process.env['LOCAL_OUTPUT']) {
    const outputPath = path.resolve(process.env['LOCAL_OUTPUT'], fileName)
    fs.writeFileSync(outputPath, xlsxBuffer)
    logger.info(
      { outputPath, rowCount: rows.length },
      'Home insurance export written locally'
    )
  } else {
    await sftpAdapter.uploadFile(
      xlsxBuffer,
      fileName,
      config.homeInsurance.sftp
    )
    logger.info(
      { fileName, rowCount: rows.length },
      'Home insurance export complete'
    )
  }
}

if (require.main === module) {
  handleHomeInsuranceExport().catch((err) => {
    logger.error(err, 'Home insurance export failed')
    throw err
  })
}
