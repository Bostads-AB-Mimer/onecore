import fs from 'fs/promises'
import config from '../common/config'
import { makeTenfastRequest } from '../common/adapters/tenfast/tenfast-adapter'

/**
 * Resets the manual export flag for invoices in Tenfast.
 *
 * Reads OCR numbers from a CSV file (one per line). For each OCR number the
 * Tenfast invoice id is looked up, and the manual export flag is then reset
 * in batches using POST /v1/hyresvard/hyror/manual-export/reset (which
 * accepts up to 2000 ids per request).
 *
 * Successfully reset OCR numbers are commented out (prefixed with #) in the
 * CSV file, making the script idempotent - it can safely be re-run and will
 * only process the remaining OCR numbers.
 *
 * Usage: pnpm dev:script:reset-exported-invoice <csv-file> [tenfast-company-id]
 */
const resetBatchSize = 2000
const maxConsecutiveLookupFailures = 10

const resetExportedInvoicesScript = async () => {
  const csvFilePath = process.argv[2]

  if (!csvFilePath) {
    console.error(
      'Usage: pnpm dev:script:reset-exported-invoice <csv-file> [tenfast-company-id]'
    )
    process.exitCode = 1
    return
  }

  const companyId = process.argv[3] ?? config.tenfast.companyId

  if (!companyId) {
    console.error(
      'No Tenfast company id (hyresvard) configured. Pass it as the second argument.\n' +
        'Known companies from config:\n' +
        config.companies
          .map((company) => `  ${company.name}: ${company.tenfastId}`)
          .join('\n')
    )
    process.exitCode = 1
    return
  }

  const csvFile = await fs.readFile(csvFilePath)
  const lines = csvFile.toString().split('\n')

  const isCommentedOut = (line: string) => line.trim().startsWith('#')
  const ocrNumbers = lines
    .filter((line) => line.trim().length > 0 && !isCommentedOut(line))
    .map((line) => line.trim())

  console.log(
    `Resetting manual export for ${ocrNumbers.length} invoices in Tenfast (hyresvard ${companyId})`
  )

  const errors: { ocr: string; error: string }[] = []

  const commentOutOcrs = async (ocrs: string[]) => {
    const ocrSet = new Set(ocrs)
    let commentedOut = 0
    for (let i = 0; i < lines.length; i++) {
      if (ocrSet.has(lines[i].trim()) && !isCommentedOut(lines[i])) {
        lines[i] = `#${lines[i]}`
        commentedOut++
      }
    }
    if (commentedOut > 0) {
      await fs.writeFile(csvFilePath, lines.join('\n'))
    }
  }

  const formatError = (err: any) => {
    const status = err?.response?.status
    const responseData = err?.response?.data
      ? ` - ${JSON.stringify(err.response.data).slice(0, 200)}`
      : ''
    return `${err?.message ?? 'unknown error'}${status ? ` (status ${status})` : ''}${responseData}`
  }

  // Phase 1: look up the Tenfast id for each OCR number
  const invoices: { ocr: string; id: string }[] = []
  let lookupFailures = 0
  let consecutiveLookupFailures = 0

  for (let i = 0; i < ocrNumbers.length; i++) {
    if (consecutiveLookupFailures >= maxConsecutiveLookupFailures) {
      console.log(
        `\nAborting lookups after ${maxConsecutiveLookupFailures} consecutive failures`
      )
      break
    }

    const ocr = ocrNumbers[i]
    process.stdout.write(
      `\rLooking up OCR ${i + 1}/${ocrNumbers.length} (${lookupFailures} failed)   `
    )

    try {
      const lookupResult = await makeTenfastRequest(
        `/v1/hyresvard/extras/hyror/${encodeURIComponent(ocr)}`,
        { params: { hyresvard: companyId } }
      )

      if (lookupResult.status !== 200 || !lookupResult.data?._id) {
        lookupFailures++
        consecutiveLookupFailures++
        errors.push({
          ocr,
          error: `OCR lookup failed with status ${lookupResult.status}`,
        })
        continue
      }

      invoices.push({ ocr, id: lookupResult.data._id })
      consecutiveLookupFailures = 0
    } catch (err: any) {
      lookupFailures++
      consecutiveLookupFailures++
      errors.push({ ocr, error: formatError(err) })
    }
  }

  console.log(`\nLooked up ${invoices.length} invoice ids`)

  // Phase 2: reset manual export in batches
  let succeeded = 0
  let resetFailures = 0

  const resetBatch = async (
    batch: { ocr: string; id: string }[]
  ): Promise<boolean> => {
    const resetResult = await makeTenfastRequest(
      '/v1/hyresvard/hyror/manual-export/reset',
      {
        method: 'POST',
        params: { hyresvard: companyId },
        data: { ids: batch.map((invoice) => invoice.id) },
      }
    )

    return (
      resetResult.status === 200 &&
      resetResult.data?.matchedCount === batch.length
    )
  }

  for (
    let batchStart = 0;
    batchStart < invoices.length;
    batchStart += resetBatchSize
  ) {
    const batch = invoices.slice(batchStart, batchStart + resetBatchSize)
    process.stdout.write(
      `\rResetting ${Math.min(batchStart + batch.length, invoices.length)}/${invoices.length} (${succeeded} succeeded, ${resetFailures} failed)   `
    )

    try {
      if (await resetBatch(batch)) {
        await commentOutOcrs(batch.map((invoice) => invoice.ocr))
        succeeded += batch.length
        continue
      }
    } catch {
      // Fall through to per-invoice resets below
    }

    // Batch failed or did not match all invoices - reset one by one to
    // find out which ones succeed
    for (const invoice of batch) {
      try {
        if (await resetBatch([invoice])) {
          await commentOutOcrs([invoice.ocr])
          succeeded++
        } else {
          resetFailures++
          errors.push({
            ocr: invoice.ocr,
            error: 'Reset did not match the invoice',
          })
        }
      } catch (err: any) {
        resetFailures++
        errors.push({ ocr: invoice.ocr, error: formatError(err) })
      }
    }
  }

  console.log(
    `\nDone: ${succeeded} succeeded, ${lookupFailures + resetFailures} failed`
  )

  if (errors.length > 0) {
    console.log('\nErrors:')
    console.log(
      errors.map((error) => `${error.ocr}: ${error.error}`).join('\n')
    )
  }
}

resetExportedInvoicesScript()
