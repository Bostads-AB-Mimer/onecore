import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { economy } from '@onecore/types'

import {
  getInvoiceByInvoiceNumber,
  getInvoicesByContactCode as getXledgerInvoicesByContactCode,
} from './adapters/xledger-adapter'
import {
  saveContacts,
  createBatch,
  getContacts as getInvoiceContacts,
} from './adapters/invoice-data-db-adapter'
import {
  getInvoiceRows,
  getInvoicesByContactCode as getXpandInvoicesByContactCode,
  getContacts as getXpandContacts,
} from './adapters/xpand-db-adapter'
import { syncContact, transformContact } from './adapters/xledger-adapter'
import {
  createAggregateRows,
  createLedgerRows,
  processInvoiceRows,
  uploadFile,
} from './service'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/invoices/bycontactcode/:contactCode', async (ctx) => {
    const queryParams = economy.GetInvoicesByContactCodeQueryParams.safeParse(
      ctx.query
    )
    if (!queryParams.success) {
      ctx.status = 400
      return
    }

    const from = queryParams.data?.from

    const contactCode = ctx.params.contactCode
    try {
      const xledgerInvoices =
        (await getXledgerInvoicesByContactCode(contactCode)) ?? []
      const xpandInvoices =
        (await getXpandInvoicesByContactCode(contactCode, { from: from })) ?? []

      const xledgerInvoiceIds = xledgerInvoices.map(
        (invoice) => invoice.invoiceId
      )

      const invoices = [
        ...xledgerInvoices,
        ...xpandInvoices.filter(
          (invoice) => !xledgerInvoiceIds.includes(invoice.invoiceId)
        ),
      ]

      const invoiceRows = await getInvoiceRows(
        new Date().getFullYear(),
        '001',
        invoices.map((v) => v.invoiceId)
      )

      const invoicesWithRows = invoices.map((invoice) => {
        const rows = invoiceRows.filter(
          (row) => row.invoiceNumber === invoice.invoiceId
        )

        return { ...invoice, invoiceRows: rows }
      })

      ctx.status = 200
      ctx.body = invoicesWithRows
    } catch (error: any) {
      console.log('error: ', error)
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.get('(.*)/invoices/:invoiceNumber', async (ctx) => {
    try {
      const result = await getInvoiceByInvoiceNumber(ctx.params.invoiceNumber)
      if (!result) {
        ctx.status = 404
        return
      }

      ctx.status = 200
      ctx.body = result
    } catch (error: any) {
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoices/import/enrich-invoice-data-rows', async (ctx) => {
    console.log('enrich-invoice-data-rows')

    try {
      const invoiceDataRows = ctx.request.body['invoiceDataRows']
      const batchId = ctx.request.body['batchId']

      const contactCodes = await processInvoiceRows(invoiceDataRows, batchId)

      ctx.status = 200
      // Roundoff rows are missing contact codes, filter out the
      // 'undefined' entry that results in
      ctx.body = {
        contacts: contactCodes.contacts.filter(
          (contactCode) => contactCode !== 'undefined'
        ),
        errors: contactCodes.errors,
      }
    } catch (error: any) {
      console.error('Error', error)
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })

  router.post('(.*)/invoices/import/batches', async (ctx) => {
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

  router.post('(.*)/invoices/import/save-contacts', async (ctx) => {
    console.log('save-contacts')
    const metadata = generateRouteMetadata(ctx)

    try {
      const contactCodes = ctx.request.body['contactCodes']
      const batchId = ctx.request.body['batchId']

      const contacts = await getXpandContacts(contactCodes)
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

  router.post('(.*)/invoices/import/update-contacts', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    function sleep(ms: number) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    console.log('update-contacts')

    try {
      const batchId = ctx.request.body['batchId']

      const contacts = await getInvoiceContacts(batchId)

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

  router.get('(.*)/invoices/import/batches/:batchId/contacts', async (ctx) => {
    console.log('get contacts', ctx.params.batchId)
    const metadata = generateRouteMetadata(ctx)

    const contacts = await getInvoiceContacts(ctx.params.batchId)
    const xledgerContacts = contacts.map(transformContact)

    ctx.status = 200
    ctx.body = {
      content: xledgerContacts,
      metadata,
    }
  })

  router.get(
    '(.*)/invoices/import/batches/:batchId/aggregated-rows',
    async (ctx) => {
      ctx.request.socket.setTimeout(0)
      const metadata = generateRouteMetadata(ctx)

      try {
        const batchId = ctx.params.batchId
        const transactionRows = await createAggregateRows(batchId)

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

  router.get(
    '(.*)/invoices/import/batches/:batchId/ledger-rows',
    async (ctx) => {
      ctx.request.socket.setTimeout(0)
      const metadata = generateRouteMetadata(ctx)

      console.log('get-ledger-rows')

      try {
        const batchId = ctx.params.batchId
        const transactionRows = await createLedgerRows(batchId)

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

  router.post('(.*)/invoices/import/upload-file', async (ctx) => {
    ctx.request.socket.setTimeout(0)
    const metadata = generateRouteMetadata(ctx)
    const filename = ctx.request.body.filename
    const csvFile = ctx.request.body.fileContents

    try {
      await uploadFile(filename, csvFile)
      ctx.status = 200
      ctx.body = {
        content: 'File upload completed',
        ...metadata,
      }
    } catch (error: any) {
      logger.error(error, 'Error getting invoice transaction rows')
      ctx.status = 500
      ctx.body = {
        message: error.message,
      }
    }
  })
}
