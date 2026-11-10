import {
  AdapterResult,
  CustomerGroup,
  CounterPartCustomer,
  XpandContact,
} from '../../../common/types'
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

export const createBatch = async (batchTotal: number = 0) => {
  const batchResult = await db('invoice_batch')
    .insert({ BatchTotalAmount: batchTotal })
    .returning('Id')
  const batchId = batchResult[0].Id

  return batchId
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
    const counterPart = findCounterPartCustomer(
      counterPartCustomers,
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

export const getCounterPartCustomers = async (): Promise<
  CounterPartCustomer[]
> => {
  const result = await db('invoice_counterpart')

  return result.map((row) => ({
    customerName: row.CustomerName,
    counterPartCode: row.CounterpartCode,
    ledgerAccount: row.LedgerAccount,
    totalAccount: row.TotalAccount,
  }))
}

export const findCounterPartCustomer = (
  customers: CounterPartCustomer[],
  customerName: string | undefined
): CounterPartCustomer | undefined =>
  customerName
    ? customers.find((cp) =>
        customerName.toLowerCase().startsWith(cp.customerName.toLowerCase())
      )
    : undefined
