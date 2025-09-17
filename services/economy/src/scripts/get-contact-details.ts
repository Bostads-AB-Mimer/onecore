import { getContacts as getXpandContacts } from '../services/invoice-service/adapters/xpand-db-adapter'
import {
  saveContacts,
  createBatch,
} from '../services/invoice-service/adapters/invoice-data-db-adapter'
import config from '../common/config'
import fs from 'fs/promises'
import path from 'node:path'
import { getBatchContactsCsv } from '../services/invoice-service/service'

const getContactDetails = async () => {
  const contactCodesFile = await fs.readFile(
    path.join(config.rentalInvoices.importDirectory, 'contacts.txt')
  )
  const contactCodes = contactCodesFile.toString().split('\n')

  const batchId = await createBatch()
  const contacts = await getXpandContacts(contactCodes)
  await saveContacts(contacts, batchId)

  const contactsFilename = `${batchId}-contacts-open.csv`
  const contactsCsv = await getBatchContactsCsv(batchId)
  await fs.writeFile(
    path.join(config.rentalInvoices.exportDirectory, contactsFilename),
    contactsCsv
  )
}

getContactDetails()
