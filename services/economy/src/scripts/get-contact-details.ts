import { getContacts as getXpandContacts } from '../services/invoice-service/adapters/xpand-db-adapter'
import {
  saveContacts,
  createBatch,
} from '../services/invoice-service/adapters/invoice-data-db-adapter'
import config from '../common/config'
import fs from 'fs/promises'
import path from 'node:path'
import { getBatchContactsCsv } from '../services/invoice-service/service'

const MAX_CONTACTS_PER_QUERY = 2000

const getContactDetails = async () => {
  console.log(process.argv[2])

  const contactCodesFile = await fs.readFile(
    process.argv[2]
  )
  const contactCodes = contactCodesFile.toString().split('\n')

  const batchId = await createBatch(0)
  const contacts = []
  for (
    let i = 0;
    i < contactCodes.length;
    i += MAX_CONTACTS_PER_QUERY
  ) {
    const chunk = contactCodes.slice(i, i + MAX_CONTACTS_PER_QUERY)
    contacts.push(...(await getXpandContacts(chunk)))
    console.log(`Fetched contacts ${i + 1} - ${i + chunk.length}`)
  }
  await saveContacts(contacts, batchId)

  const contactsFilename = `contacts.csv`
  const contactsCsv = await getBatchContactsCsv(batchId)
  if (contactsCsv) {
    await fs.writeFile(
      path.join(config.rentalInvoices.exportDirectory, contactsFilename),
      contactsCsv
    )
  }
}

getContactDetails()
