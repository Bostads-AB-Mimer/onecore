import { loggedAxios as axios, logger } from '@onecore/utilities'
import { Lease, leasing } from '@onecore/types'
import z from 'zod'

import { AdapterResult } from '../types'
import config from '../../common/config'

const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

type GetLeaseOptions = z.infer<typeof leasing.v1.GetLeaseOptionsSchema>
type GetLeasesOptions = z.infer<typeof leasing.v1.GetLeasesOptionsSchema>

export const getLease = async (
  leaseId: string,
  options: GetLeaseOptions
): Promise<Lease> => {
  const queryParams = new URLSearchParams({
    includeContacts: options.includeContacts.toString(),
  })

  const leaseResponse = await axios(
    `${tenantsLeasesServiceUrl}/leases/${encodeURIComponent(leaseId)}?${queryParams.toString()}`
  )

  return leaseResponse.data.content
}

export const getLeasesByContactCode = async (
  contactCode: string,
  options: GetLeasesOptions
): Promise<Lease[]> => {
  const queryParams = new URLSearchParams({
    includeContacts: options.includeContacts.toString(),
  })

  if (options.status) {
    queryParams.set('status', options.status.join(','))
  }

  const leasesResponse = await axios.get(
    `${tenantsLeasesServiceUrl}/leases/by-contact-code/${contactCode}?${queryParams.toString()}`
  )

  return leasesResponse.data.content
}

export const getLeasesByRentalObjectCode = async (
  rentalObjectCode: string,
  options: GetLeasesOptions
): Promise<Lease[]> => {
  const queryParams = new URLSearchParams({
    includeContacts: options.includeContacts.toString(),
  })

  if (options.status) {
    queryParams.set('status', options.status.join(','))
  }

  const leasesResponse = await axios(
    `${tenantsLeasesServiceUrl}/leases/by-rental-object-code/${rentalObjectCode}?${queryParams.toString()}`
  )
  return leasesResponse.data.content
}

export const createLease = async (
  objectId: string,
  contactId: string,
  fromDate: string,
  companyCode: string,
  includeVAT: boolean
): Promise<AdapterResult<string, 'create-lease-failed' | 'unknown'>> => {
  const axiosOptions = {
    method: 'POST',
    data: {
      parkingSpaceId: objectId,
      contactCode: contactId,
      fromDate,
      companyCode,
      includeVAT,
    },
  }

  const result = await axios(tenantsLeasesServiceUrl + '/leases', axiosOptions)

  if (result.status == 200) {
    return { ok: true, data: result.data.content }
  } else if (
    result.status == 404 &&
    result.data.error === 'Lease cannot be created on this rental object'
  ) {
    logger.error(
      { objectId, contactId, fromDate },
      'Lease could not be created for rental object'
    )
    return { ok: false, err: 'create-lease-failed' }
  } else {
    logger.error(
      { error: result.data.error },
      'Unknown error when creating lease'
    )
    return { ok: false, err: 'unknown' }
  }
}

type CreateLeaseInvoiceRowRequestPayload = {
  amount: number
  article: string
  label: string
  from?: string
  to?: string
}

type CreateLeaseInvoiceRowResponse = CreateLeaseInvoiceRowRequestPayload & {
  vat: number
  _id: string
}

export type Article = {
  includeInContract: boolean
  _id: string
  label: string
  type: string
  accountNr?: string | null
  createdAt: Date
  hyresvard: string
  code: string
  title: string
  defaultLabel: string
  vat?: number
  description?: string
  category?: string
  adjustmentType: 'negotiation' | 'custom' | 'index' | 'none'
  archivedAt?: Date | null
  updatedAt: Date
}

export async function createLeaseRentRow(params: {
  leaseId: string
  rentRow: CreateLeaseInvoiceRowRequestPayload
}): Promise<AdapterResult<CreateLeaseInvoiceRowResponse, 'unknown'>> {
  const result = await axios(
    `${tenantsLeasesServiceUrl}/leases/${params.leaseId}/rent-rows`,
    {
      method: 'POST',
      data: {
        ...params.rentRow,
      },
    }
  )

  if (result.status === 201) {
    return { ok: true, data: result.data.content }
  } else {
    logger.error(
      { error: JSON.stringify(result.data) },
      'Unknown error when creating rent row'
    )

    return { ok: false, err: 'unknown' }
  }
}

export async function deleteLeaseRentRow(params: {
  leaseId: string
  rentRowId: string
}): Promise<AdapterResult<null, 'unknown'>> {
  const result = await axios.delete(
    `${tenantsLeasesServiceUrl}/leases/${params.leaseId}/rent-rows/${params.rentRowId}`
  )

  if (result.status === 200) {
    return { ok: true, data: null }
  } else {
    logger.error(
      { error: JSON.stringify(result.data) },
      'Unknown error when deleting rent row'
    )

    return { ok: false, err: 'unknown' }
  }
}

export async function getArticles(): Promise<
  AdapterResult<Article[], 'unknown'>
> {
  type ApiArticle = Omit<Article, 'createdAt' | 'updatedAt' | 'archivedAt'> & {
    createdAt: string
    updatedAt: string
    archivedAt?: string | null
  }

  const result = await axios.get<{ content: ApiArticle[] }>(
    `${tenantsLeasesServiceUrl}/articles`
  )

  if (result.status === 200) {
    const articles: Article[] = result.data.content.map((article) => ({
      ...article,
      createdAt: new Date(article.createdAt),
      updatedAt: new Date(article.updatedAt),
      archivedAt: article.archivedAt ? new Date(article.archivedAt) : null,
    }))
    return { ok: true, data: articles }
  } else {
    logger.error(
      { error: JSON.stringify(result.data) },
      'Unknown error when fetching articles'
    )

    return { ok: false, err: 'unknown' }
  }
}
