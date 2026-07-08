import knex from 'knex'
import { logger } from '@onecore/utilities'
import { InvoiceBase } from '@onecore/types'
import config from '../../../common/config'
import { AdapterResult } from '../../../common/types'

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

interface InvoiceBaseRow {
  Id: number
  ContactCode: string
  ExternalIdentifier: string
  CreatedAt: Date
}

interface InvoiceBaseItemRow {
  InvoiceBaseId: number
  XledgerDbId: string
}

export interface InvoiceBasePayload {
  contactCode: string
  externalIdentifier: string
  leaseId: string
  invoiceBaseItemXledgerDbIds: string[]
}

export const closeDb = () => {
  db.destroy()
}

export const createInvoiceBase = async ({
  contactCode,
  externalIdentifier,
  leaseId,
  invoiceBaseItemXledgerDbIds,
}: InvoiceBasePayload): Promise<AdapterResult<any, Error>> => {
  try {
    const result = await db.transaction(async (tx) => {
      const invoiceBases = await tx('invoice_base')
        .insert({
          ContactCode: contactCode,
          LeaseId: leaseId,
          ExternalIdentifier: externalIdentifier,
        })
        .returning('Id')

      await tx('invoice_base_item').insert(
        invoiceBaseItemXledgerDbIds.map((dbId) => ({
          InvoiceBaseId: invoiceBases[0].Id,
          XledgerDbId: dbId,
        }))
      )

      return tx
    })

    return { ok: true, data: result } // TODO fix typing
  } catch (err: any) {
    logger.error(err, 'Failed to insert InvoiceBase')
    return { ok: false, err }
  }
}

const transformToInvoiceBase = (
  invoiceBaseRow: InvoiceBaseRow
): Omit<
  InvoiceBase,
  // These InvoiceBase properties are populated from InvoiceBaseItems
  | 'invoiceDate'
  | 'ourReference'
  | 'attachment'
  | 'headerInfo'
  | 'comment'
  | 'totalAmount'
  | 'items'
> => {
  return {
    id: invoiceBaseRow.Id,
    externalIdentifier: invoiceBaseRow.ExternalIdentifier,
    createdAt: invoiceBaseRow.CreatedAt,
    contactCode: invoiceBaseRow.ContactCode,
    leaseId: '',
  }
}

export interface BaseInvoiceQueryOptions {
  from?: Date
  to?: Date
  skip?: number
  pageSize?: number
}

const baseInvoiceBaseQuery = ({
  from,
  to,
  skip,
  pageSize,
}: BaseInvoiceQueryOptions) => {
  const query = db<InvoiceBaseRow>('invoice_base')

  if (from) {
    query.where('CreatedAt', '>=', from)
  }
  if (to) {
    query.where('CreatedAt', '<=', to)
  }
  if (skip) {
    query.offset(skip)
  }
  if (pageSize) {
    query.limit(pageSize)
  }

  return query.orderBy('CreatedAt', 'desc')
}

export const getInvoiceBases = async (options: BaseInvoiceQueryOptions) => {
  const result = await baseInvoiceBaseQuery(options)
  return result.map(transformToInvoiceBase)
}

export const getInvoiceBasesByContactCode = async (
  contactCode: string,
  options: BaseInvoiceQueryOptions
) => {
  const result = await baseInvoiceBaseQuery(options).where(
    'invoice_base.ContactCode',
    '=',
    contactCode
  )

  return result.map(transformToInvoiceBase)
}

export const getInvoiceBaseItems = async (invoiceBaseIds: number[]) => {
  return db<InvoiceBaseItemRow>('invoice_base_item').whereIn(
    'InvoiceBaseId',
    invoiceBaseIds
  )
}
