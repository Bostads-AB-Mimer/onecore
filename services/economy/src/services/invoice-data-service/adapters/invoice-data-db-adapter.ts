import { AdapterResult, InvoiceDataRow } from '../types'
import knex from 'knex'
import config from '../../../common/config'
import { Contact } from 'onecore-types'

const db = knex({
  connection: {
    host: config.economyDatabase.host,
    user: config.economyDatabase.user,
    password: config.economyDatabase.password,
    port: config.economyDatabase.port,
    database: config.economyDatabase.database,
  },
  client: 'mssql',
})

export const createBatch = async () => {
  const batchResult = await db('invoice_batch').insert({}).returning('Id')
  const batchId = batchResult[0].Id

  return batchId
}

export const saveInvoiceRows = async (
  rows: InvoiceDataRow[],
  batchId: string
) => {
  const dbRows = rows.map((row): InvoiceDataRow => {
    return {
      ...row,
      batchId,
    }
  })

  let i = 0

  for (const row of dbRows) {
    try {
      const rowResult = await db('invoice_data').insert(row)
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
      process.stdout.write('Saving ' + (i++).toString())
    } catch (error: any) {
      console.error(
        'Error inserting row',
        row['contractCode'],
        row['rentalArticle']
      )
    }
  }

  process.stdout.write('\n')

  return null
}

export const saveContacts = async (
  contacts: Contact[],
  batchId: string
): Promise<
  AdapterResult<
    { successfulContacts: number; failedContacts: number; errors: string[] },
    string
  >
> => {
  const errors: string[] = []
  let successfulContacts = 0
  let failedContacts = 0
  for (const contact of contacts) {
    try {
      await db('invoice_contact').insert({
        batchId,
        contactCode: contact.contactCode,
        firstName: contact.firstName,
        lastName: contact.lastName,
        fullName: contact.fullName,
        nationalRegistrationNumber: contact.nationalRegistrationNumber,
        emailAddress: contact.emailAddress,
        street: contact.address?.street,
        streetNumber: contact.address?.number,
        postalCode: contact.address?.postalCode,
        city: contact.address?.city,
      })

      successfulContacts++
    } catch (error: any) {
      failedContacts++
      errors.push(
        `Error saving contact ${contact.contactCode} to invoice data database`
      )
    }
  }

  return {
    ok: true,
    data: {
      successfulContacts,
      failedContacts,
      errors,
    },
  }
}

export const getContacts = async (batchId: string) => {
  return await db('invoice_contact')
    .where('batchId', batchId)
    .whereNull('importStatus')
}

export const getContracts = async (batchId: string) => {
  return await db('invoice_data')
    .select('contractCode')
    .distinct()
    .where('batchId', batchId)
    .whereNull('importStatus')
}

export const getInvoiceRows = async (contractCode: string, batchId: string) => {
  return await db('invoice_data')
    .where('batchId', batchId)
    .where('contractCode', contractCode)
}

export const markInvoiceRowsAsImported = async (
  invoiceRows: InvoiceDataRow[],
  batchId: string
) => {
  for (const row of invoiceRows) {
    await db('invoice_data').update({ ImportStatus: true }).where({
      batchId,
      contractCode: row.ContractCode,
      account: row.Account,
    })
  }
}

export const getAggregatedInvoiceRows = async (
  batchId: string,
  contractCodes: string[]
): Promise<InvoiceDataRow[]> => {
  const rows = await db('invoice_data')
    .sum({ totalAmount: 'TotalAmount', totalVat: 'VAT' })
    .select(
      'RentArticle',
      'Account',
      'CostCode',
      'Property',
      'ProjectCode',
      'FreeCode',
      'InvoiceDate',
      'InvoiceDueDate',
      'InvoiceFromDate',
      'InvoiceToDate',
      'BatchId'
    )
    .groupBy(
      'RentArticle',
      'Account',
      'CostCode',
      'Property',
      'ProjectCode',
      'FreeCode',
      'InvoiceDate',
      'InvoiceDueDate',
      'InvoiceFromDate',
      'InvoiceToDate',
      'BatchId'
    )
    .where('batchId', batchId)
    .whereIn('ContractCode', contractCodes)

  return rows
}
