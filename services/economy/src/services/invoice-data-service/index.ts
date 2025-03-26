import KoaRouter from '@koa/router'
import { enrichInvoiceRows } from './adapters/xpand-db-adapter'
import {
  getInvoiceRows,
  saveInvoiceRows,
  markInvoiceRowsAsImported,
  saveContacts,
  createBatch,
  getContacts,
  getContracts,
  getAggregatedInvoiceRows,
} from './adapters/invoice-data-db-adapter'
import { InvoiceDataRow } from './types'
import {
  createCustomerLedgerRow,
  syncContact,
  transformAggregatedInvoiceRow,
  transformContact,
  updateAggregatedInvoiceData,
  updateCustomerLedger,
} from './adapters/xledger-adapter'
import { generateRouteMetadata, logger } from 'onecore-utilities'
import { start } from 'repl'

/**
 * Parses excel file and enriches each row with accounting data from Xpand. Saves each
 * enriched row to invoice_data in economy db.
 *
 * @param invoiceDataRows Array of invoice rows from Xpand
 * @returns Array of contact codes referred to in uploaded invoice data
 */
const processInvoiceRows = async (
  invoiceDataRows: InvoiceDataRow[],
  batchId: string,
  invoiceDate: string,
  invoiceDueDate: string
): Promise<string[]> => {
  const addedContactCodes: Record<string, boolean> = {}

  const enrichedInvoiceRows = await enrichInvoiceRows(
    invoiceDataRows,
    invoiceDate,
    invoiceDueDate
  )

  invoiceDataRows.forEach((row) => {
    addedContactCodes[row.contactCode] = true
  })

  await saveInvoiceRows(enrichedInvoiceRows, batchId)

  return Object.keys(addedContactCodes)
}

export const routes = (router: KoaRouter) => {
  router.post('(.*)/invoice-data/enrich-invoice-data-rows', async (ctx) => {
    console.log('enrich-invoice-data-rows')
    const contactCodes: string[] = []

    try {
      const invoiceDataRows = ctx.request.body['invoiceDataRows']
      const batchId = ctx.request.body['batchId']
      const invoiceDate = ctx.request.body['invoiceDate']
      const invoiceDueDate = ctx.request.body['invoiceDueDate']

      contactCodes.push(
        ...(await processInvoiceRows(
          invoiceDataRows,
          batchId,
          invoiceDate,
          invoiceDueDate
        ))
      )

      ctx.status = 200
      ctx.body = contactCodes
    } catch (error: any) {
      console.error('Error', error)
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoice-data/batches', async (ctx) => {
    try {
      const batchId = await createBatch()

      ctx.status = 200
      ctx.body = batchId
    } catch (error: any) {
      console.error('Error', error)
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoice-data/save-contacts', async (ctx) => {
    console.log('save-contacts')
    const metadata = generateRouteMetadata(ctx)

    try {
      const contacts = ctx.request.body['contacts']
      const batchId = ctx.request.body['batchId']

      const result = await saveContacts(contacts, batchId)

      ctx.status = 200
      ctx.body = { content: result.ok ? result.data : {}, ...metadata }
    } catch (error: any) {
      logger.error(error, 'Error saving contacts to invoice data database')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoice-data/update-contacts', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    function sleep(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    console.log('update-contacts')

    try {
      const batchId = ctx.request.body['batchId']

      const contacts = await getContacts(batchId)

      const errors: string[] = []
      let successfulContacts = 0
      let failedContacts = 0

      for (const contact of contacts) {
        const result = await syncContact(contact)
        if (!result.ok) {
          errors.push('Error syncing contact: ' + result.err)
          failedContacts++
        } else {
          successfulContacts++
        }
        await sleep(200)
      }

      ctx.status = 200
      ctx.body = {
        content: { successfulContacts, failedContacts, errors },
        ...metadata,
      }
    } catch (error: any) {
      logger.error(error, 'Error updating contacts')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.get('(.*)/invoice-data/batches/:batchId/contacts', async (ctx) => {
    console.log('get contacts', ctx.params.batchId)
    const metadata = generateRouteMetadata(ctx)

    const contacts = await getContacts(ctx.params.batchId)
    const xledgerContacts = contacts.map(transformContact)

    ctx.status = 200
    ctx.body = {
      content: xledgerContacts,
      metadata,
    }
  })

  router.get(
    '(.*)/invoice-data/batches/:batchId/transaction-rows',
    async (ctx) => {
      ctx.request.socket.setTimeout(0)
      const metadata = generateRouteMetadata(ctx)

      console.log('get-transaction-rows')

      try {
        const batchId = ctx.params.batchId
        const transactionRows: InvoiceDataRow[] = []

        // Do transaction rows in chunks of contracts to get different
        // voucher numbers.

        const contractCodes = (await getContracts(batchId)).map(
          (contract) => contract.contractCode as string
        )
        const CHUNK_SIZE = 500
        let chunkNum = 0

        while (CHUNK_SIZE * chunkNum < contractCodes.length) {
          const startNum = chunkNum * CHUNK_SIZE
          const endNum = Math.min(
            (chunkNum + 1) * CHUNK_SIZE,
            contractCodes.length
          )

          logger.info(
            { startNum, endNum, contractCodes: contractCodes.length },
            'Processing contracts'
          )
          const currentContractCodes = contractCodes.slice(startNum, endNum)
          // Get aggregated rows for account/projectCode/costCode combos
          const aggregatedDbRows = await getAggregatedInvoiceRows(
            batchId,
            currentContractCodes
          )
          const aggregatedRows = aggregatedDbRows.map((row) => {
            return transformAggregatedInvoiceRow(row, chunkNum)
          })
          transactionRows.push(...aggregatedRows)
          logger.info({}, 'Got aggregated rows')

          for (const contractCode of currentContractCodes) {
            const contractInvoiceRows = await getInvoiceRows(
              contractCode,
              batchId
            )
            const customerLedgerRow = await createCustomerLedgerRow(
              contractInvoiceRows,
              batchId,
              chunkNum
            )

            if (customerLedgerRow.ok) {
              transactionRows.push(customerLedgerRow.data)
            } else {
              logger.error(
                customerLedgerRow.err,
                `Error creating customer ledger row for contract ${contractCode}`
              )
              throw new Error('Error creating customer ledger row')
            }
          }

          chunkNum++
        }

        ctx.status = 200
        ctx.body = {
          content: transactionRows,
          ...metadata,
        }
      } catch (error: any) {
        logger.error(error, 'Error getting invoice transaction rows')
        ctx.status = 500
        ctx.body = {
          message: error.message,
        }
      }
    }
  )

  /*router.post('(.*)/invoice-data/update-invoices', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    function sleep(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    console.log('update-invoices')

    try {
      const batchId = ctx.request.body['batchId']
      // Get aggregated rows for account/projectCode/costCode combos
      const aggregatedRows = await getAggregatedInvoiceRows(batchId)

      aggregatedRows.forEach((row) => {
        if ((row.totalVat as number) > 0) {
          row['vatPercent'] = Math.round(
            ((row.totalVat as number) * 100) / (row.totalAmount as number)
          )
        }
      })

      const aggregatedRowsResult = await updateAggregatedInvoiceData(
        aggregatedRows,
        batchId
      )

      // Get rows for each contract
      const contractCodes = await getContracts(batchId)
      const customerLedgerErrors: string[] = []
      let successfulLedgers = 0

      for (const contractCode of contractCodes) {
        const contractInvoiceRows = await getInvoiceRows(
          contractCode.contractCode,
          batchId
        )
        const customerLedgerResult = await updateCustomerLedger(
          contractInvoiceRows,
          batchId
        )

        if (customerLedgerResult.ok) {
          await markInvoiceRowsAsImported(contractInvoiceRows, batchId)
          successfulLedgers++
        } else {
          customerLedgerErrors.push(
            `Customer ledger could not be updated for contract ${contractCode.contractCode}`
          )
        }
      }

      ctx.status = 200
      ctx.body = {
        content: {
          aggregatedRows: aggregatedRowsResult.ok && aggregatedRowsResult.data,
          customerLedgers: {
            successfulLedgers,
            failedLedgers: contractCodes.length - successfulLedgers,
            errors: customerLedgerErrors,
          },
        },
        ...metadata,
      }
    } catch (error: any) {
      logger.error(error, 'Error updating invoices')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })*/
}
