import {
  AdapterResult,
  CustomerGroup,
  CUSTOMER_LEDGER_ACCOUNT,
  LedgerInvoice,
  InvoiceContract,
  InvoiceDataRow,
  TOTAL_ACCOUNT,
  XpandContact,
} from '../../../common/types'
import knex from 'knex'
import config from '../../../common/config'
import { logger } from 'onecore-utilities'

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

const convertToDbRow = (row: InvoiceDataRow, batchId: string) => {
  return {
    batchId,
    contractCode: row.contractCode,
    contactCode: row.contactCode,
    tenantName: row.tenantName,
    invoiceDate: row.invoiceDate,
    invoiceFromDate: row.invoiceFromDate,
    invoiceToDate: row.invoiceToDate,
    invoiceDueDate: row.invoiceDueDate,
    rentArticle: row.rentArticle,
    invoiceRowText: row.invoiceRowText,
    amount: row.amount,
    vat: row.vat,
    totalAmount: row.totalAmount,
    account: row.account,
    costCode: row.costCode,
    property: row.property,
    projectCode: row.projectCode,
    freeCode: row.freeCode,
    invoiceNumber: row.invoiceNumber,
    oCR: row.invoiceNumber,
    ledgerAccount: row.ledgerAccount,
    totalAccount: row.totalAccount,
  }
}

export const saveInvoiceRows = async (
  rows: InvoiceDataRow[],
  batchId: string
) => {
  let i = 0

  for (const row of rows) {
    const dbRow = convertToDbRow(row, batchId)
    try {
      await db('invoice_data').insert(dbRow)
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
      process.stdout.write('Saving ' + (++i).toString())
    } catch (error: any) {
      logger.error({
        error,
        contractCode: dbRow['contractCode'],
        article: dbRow['rentArticle'],
      })
    }
  }

  process.stdout.write('\n')

  return null
}

export const saveContacts = async (
  contacts: XpandContact[],
  batchId: string
): Promise<
  AdapterResult<
    { successfulContacts: number; failedContacts: number; errors: string[] },
    string
  >
> => {
  const counterPartCustomers = await getCounterPartCustomers()

  const errors: string[] = []
  let successfulContacts = 0
  let failedContacts = 0
  for (const contact of contacts) {
    const counterPart = counterPartCustomers.find((counterPart) =>
      (contact.fullName as string)?.startsWith(counterPart.CustomerName)
    )

    let customerGroup = counterPart ? CustomerGroup.CounterPart : null
    if (!customerGroup) {
      customerGroup = contact.autogiro
        ? CustomerGroup.AutoGiro
        : CustomerGroup.OtherPaymentMethod
    }

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
        counterPart: counterPart ? counterPart.CounterpartCode : '',
        customerGroup,
        invoiceDeliveryMethod: contact.invoiceDeliveryMethod,
      })

      successfulContacts++
    } catch (error: any) {
      failedContacts++
      logger.error(
        error,
        `Error saving contact ${contact.contactCode} to invoice data database`
      )
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

export const getInvoices = async (
  batchId: string
): Promise<LedgerInvoice[]> => {
  const invoices = await db('invoice_data')
    .select(
      'ContractCode',
      'InvoiceNumber',
      'InvoiceFromDate',
      'InvoiceToDate',
      'LedgerAccount',
      'TotalAccount',
      'TenantName'
    )
    .distinct()
    .where('batchId', batchId)
    .whereNull('importStatus')

  const ledgerInvoices = invoices.map((invoice) => {
    return {
      contractCode: invoice.ContractCode,
      invoiceNumber: invoice.InvoiceNumber,
      invoiceFromDate: invoice.InvoiceFromDate,
      invoiceToDate: invoice.InvoiceToDate,
      ledgerAccount: invoice.LedgerAccount,
      totalAccount: invoice.TotalAccount,
      tenantName: invoice.TenantName,
    }
  })

  return ledgerInvoices
}

/**
 * Gets all contracts for a batch, sorted by invoice from date
 * and to date to group periods later.
 *
 * @param batchId
 * @returns
 */
export const getContracts = async (
  batchId: string
): Promise<InvoiceContract[]> => {
  return await db('invoice_data')
    .select(
      'contractCode',
      'invoiceFromDate',
      'invoiceToDate',
      'ledgerAccount',
      'totalAccount'
    )
    .distinct()
    .where('batchId', batchId)
    .whereNull('importStatus')
    .orderBy([
      'invoiceFromDate',
      'invoiceToDate',
      'ledgerAccount',
      'totalAccount',
    ])
}

export const getInvoiceRows = async (
  invoiceNumber: string,
  batchId: string
) => {
  return await db('invoice_data')
    .where('batchId', batchId)
    .where('invoiceNumber', invoiceNumber)
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
      'BatchId',
      'TotalAccount'
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
      'BatchId',
      'TotalAccount'
    )
    .where('batchId', batchId)
    .whereIn('ContractCode', contractCodes)

  return rows
}

export const getCounterPartCustomers = async () => {
  const result = await db('invoice_counterpart')

  return result
}

export const addAccountInformation = async (
  invoiceDataRows: InvoiceDataRow[]
): Promise<InvoiceDataRow[]> => {
  const counterPartCustomers = await getCounterPartCustomers()
  for (const row of invoiceDataRows) {
    if ('Öresutjämning'.localeCompare(row.invoiceRowText as string) !== 0) {
      try {
        const counterPart = counterPartCustomers.find((counterPart) =>
          (row.tenantName as string).startsWith(counterPart.CustomerName)
        )

        if (counterPart) {
          row.ledgerAccount = counterPart.LedgerAccount
          row.totalAccount = counterPart.TotalAccount
        } else {
          row.ledgerAccount = CUSTOMER_LEDGER_ACCOUNT
          row.totalAccount = TOTAL_ACCOUNT
        }
      } catch (error: any) {
        console.log(row)
      }
    }
  }

  return invoiceDataRows
}
