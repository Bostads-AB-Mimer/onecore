import { InvoiceDataRow } from '../types'
import knex from 'knex'
import config from '../../../common/config'
import { Contact, Invoice } from 'onecore-types'

console.log(config)

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

export const saveInvoiceRows = async (rows: InvoiceDataRow[]) => {
  const batchResult = await db('invoice_batch').insert({}).returning('Id')
  const batchId = batchResult[0].Id

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

export const saveContacts = async (contacts: Contact[]) => {
  for (const contact of contacts) {
  }
}
