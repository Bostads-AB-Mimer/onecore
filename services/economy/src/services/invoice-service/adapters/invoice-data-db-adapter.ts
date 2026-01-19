import {
  AdapterResult,
  CustomerGroup,
  CounterPartCustomer,
  CUSTOMER_LEDGER_ACCOUNT,
  InvoiceContract,
  InvoiceDataRow,
  TOTAL_ACCOUNT,
  XpandContact,
} from '../../../common/types/legacyTypes'
import knex from 'knex'
import config from '../../../common/config'
import { logger } from '@onecore/utilities'

const db = knex({
  connection: {
    host: config.economyDatabase.host,
    user: config.economyDatabase.user,
    password: config.economyDatabase.password,
    port: config.economyDatabase.port,
    database: config.economyDatabase.database,
  },
  pool: { min: 0, max: 10 },
  client: 'mssql',
})

export const closeDb = () => {
  db.destroy()
}

export const createBatch = async (batchTotal: number = 0) => {
  const batchResult = await db('invoice_batch')
    .insert({ BatchTotalAmount: batchTotal })
    .returning('Id')
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
    invoiceTotalAmount: row.invoiceTotalAmount,
  }
}

export const saveInvoiceRows = async (
  rows: InvoiceDataRow[],
  batchId: string
) => {
  for (const row of rows) {
    const dbRow = convertToDbRow(row, batchId)
    try {
      await db('invoice_data').insert(dbRow)
    } catch (error: any) {
      logger.error(
        {
          error,
          contractCode: dbRow['contractCode'],
          article: dbRow['rentArticle'],
          invoiceNumber: dbRow['invoiceNumber'],
        },
        'Could not save invoice row to invoice db'
      )
    }
  }

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
    const counterPart = counterPartCustomers.find(
      counterPartCustomers.customers,
      contact.fullName as string
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
        counterPart: counterPart ? counterPart.counterPartCode : '',
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
    .select(
      'ContactCode',
      'FirstName',
      'LastName',
      'FullName',
      'NationalRegistrationNumber',
      'EmailAddress',
      'Street',
      'StreetNumber',
      'PostalCode',
      'City',
      'CounterPart',
      'CustomerGroup',
      'InvoiceDeliveryMethod'
    )
    .distinct()
    .where('batchId', batchId)
    .whereNull('importStatus')
}

/*export const getInvoices = async (
  batchId: string
): Promise<LedgerInvoice[]> => {
  const invoices = await db('invoice_data')
    .select(
      'ContractCode',
      'InvoiceDate',
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
    .orderBy('InvoiceDate', 'ASC')
    .orderBy('LedgerAccount', 'ASC')

  const ledgerInvoices = invoices.map((invoice) => {
    return {
      contractCode: invoice.ContractCode,
      invoiceNumber: invoice.InvoiceNumber,
      invoiceDate: invoice.InvoiceDate,
      invoiceFromDate: invoice.InvoiceFromDate,
      invoiceToDate: invoice.InvoiceToDate,
      ledgerAccount: invoice.LedgerAccount,
      totalAccount: invoice.TotalAccount,
      tenantName: invoice.TenantName,
    }
  })

  return ledgerInvoices
}*/

/**
 * Gets all invoices for a batch, sorted by invoice from date
 * and to date to group periods later.
 *
 * @param batchId
 * @returns
 */
export const getInvoicesByChunks = async (
  batchId: string
): Promise<InvoiceContract[]> => {
  return await db('invoice_data')
    .select(
      'invoiceNumber',
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

/*export const getInvoiceRows = async (
  invoiceNumber: string,
  batchId: string
) => {
  return await db('invoice_data')
    .where('batchId', batchId)
    .where('invoiceNumber', invoiceNumber)
}*/

export const getAggregatedInvoiceRows = async (
  batchId: string,
  invoiceNumbers: string[]
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
    .whereIn('InvoiceNumber', invoiceNumbers)

  return rows
}

export const getCounterPartCustomers = async (): Promise<{
  customers: CounterPartCustomer[]
  find: (
    customers: CounterPartCustomer[],
    customerName: string
  ) => CounterPartCustomer | undefined
}> => {
  const result = await db('invoice_counterpart')

  const counterPartCustomers = result.map((row) => {
    return {
      customerName: row.CustomerName,
      counterPartCode: row.CounterpartCode,
      ledgerAccount: row.LedgerAccount,
      totalAccount: row.TotalAccount,
    }
  })

  const findCounterPartCustomer = (
    customers: CounterPartCustomer[],
    customerName: string
  ): CounterPartCustomer | undefined => {
    return customers.find((counterPart) =>
      customerName
        .toLowerCase()
        .startsWith(counterPart.customerName.toLowerCase())
    )
  }

  return {
    customers: counterPartCustomers,
    find: findCounterPartCustomer,
  }
}

export const addAccountInformation = async (
  invoiceDataRows: InvoiceDataRow[]
): Promise<InvoiceDataRow[]> => {
  const counterPartCustomers = await getCounterPartCustomers()
  for (const row of invoiceDataRows) {
    if ('Öresutjämning'.localeCompare(row.invoiceRowText as string) !== 0) {
      try {
        const counterPart = counterPartCustomers.find(
          counterPartCustomers.customers,
          row.tenantName as string
        )

        if (counterPart) {
          row.ledgerAccount = counterPart.ledgerAccount
          row.totalAccount = counterPart.totalAccount
        } else {
          row.ledgerAccount = CUSTOMER_LEDGER_ACCOUNT
          row.totalAccount = TOTAL_ACCOUNT
        }
      } catch (error: any) {
        logger.error(
          { error, row },
          'Could not add account information for invoice data row'
        )
      }
    }
  }

  return invoiceDataRows
}

export const markInvoicesAsImported = async (batchId: number) => {
  const updateQuery = db
    .into(
      db.raw('?? (??, ??, ??, ??)', [
        'invoice_import_status',
        'InvoiceType',
        'ImportedDate',
        'InvoiceNumber',
        'Amount',
      ])
    )
    .insert((query: any) => {
      query
        .select(
          { InvoiceType: db.raw("'invoice'") },
          { ImportedDate: db.raw('GETDATE()') },
          'InvoiceNumber'
        )
        .sum({ Amount: 'TotalAmount' })
        .from('invoice_data')
        .where('BatchId', batchId)
        .groupBy('InvoiceNumber')
    })

  await updateQuery
}

export const excludeExportedInvoices = async (
  importedInvoiceRows: InvoiceDataRow[]
) => {
  const importedInvoices = await db('invoice_import_status')

  const invoiceRowsToImport = importedInvoiceRows.filter(
    (invoiceRow: InvoiceDataRow) => {
      const alreadyImported = importedInvoices.find((importedInvoice) => {
        const exists =
          (importedInvoice.InvoiceNumber as string).localeCompare(
            invoiceRow.invoiceNumber as string
          ) === 0
        return exists
      })

      return alreadyImported === undefined
    }
  )

  return invoiceRowsToImport
}

export const getImportedInvoiceNumbers = async () => {
  const invoiceNumbers = await db('invoice_import_status')
    .select('InvoiceNumber')
    .where('InvoiceType', 'invoice')

  return invoiceNumbers.map((invoice) => invoice.InvoiceNumber)
}

export const getAllInvoiceRows = async (batchId: string) => {
  return await db('invoice_data')
    .where('batchId', batchId)
    .orderBy('InvoiceDate', 'ASC')
    .orderBy('LedgerAccount', 'ASC')
    .orderBy('InvoiceNumber', 'ASC')
}

export const verifyImport = async (
  invoicesToImport: string[],
  batchId: string,
  xpandBatchTotal: number
) => {
  const importedInvoiceNumbers = (
    await db('invoice_data')
      .select('InvoiceNumber')
      .distinct()
      .where('batchId', batchId)
  ).map((invoice) => invoice.InvoiceNumber)

  const missedInvoices = invoicesToImport.filter(
    (rentalInvoiceNumber: string) =>
      !importedInvoiceNumbers.includes(rentalInvoiceNumber)
  )

  if (missedInvoices.length > 0) {
    logger.error(
      { missedInvoices },
      'Invoices that were selected for import were not imported'
    )
    throw new Error('Invoices that were selected for import were not imported')
  }

  const batchTotalAmountResult = await db.raw(
    'SELECT SUM(TotalAmount) FROM invoice_data where batchId = ?',
    batchId
  )
  const batchTotalAmount = batchTotalAmountResult[0] as number
  const batchTotalDiff = Math.abs(xpandBatchTotal - batchTotalAmount)

  if (batchTotalDiff > 1) {
    logger.error(
      { batchTotalAmount, xpandTotalAmount: xpandBatchTotal },
      'Xpand total amount does not match batch row totals'
    )
    throw new Error(
      `Xpand total amount ${xpandBatchTotal} does not match batch row totals ${batchTotalAmount}`
    )
  }

  return missedInvoices.length === 0 && batchTotalDiff > 1
}

export const getBatchAccountTotals = async (batchId: string) => {
  const accountResult = await db.raw(
    'select account, sum(totalamount) as accountSum from invoice_data \
      where batchId = ? \
      group by account \
      order by account',
    [batchId]
  )

  const accountTotals: Record<string, number> = {}

  accountResult.forEach((account: any) => {
    accountTotals[account['account']] = account['accountSum']
  })

  return accountTotals
}
