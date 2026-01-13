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

type CreateInvoiceRowRequestPayload = {
  amount: number
  article: string | null
  label: string | null
  from?: string
  to?: string
}

type CreateInvoiceRowResponse = CreateInvoiceRowRequestPayload & {
  vat: number
  _id: string
}

export async function createInvoiceRow(params: {
  leaseId: string
  invoiceRow: CreateInvoiceRowRequestPayload
}): Promise<AdapterResult<CreateInvoiceRowResponse, 'unknown'>> {
  const result = await axios(
    `${tenantsLeasesServiceUrl}/leases/${params.leaseId}/invoice-rows`,
    {
      method: 'POST',
      data: {
        ...params.invoiceRow,
      },
    }
  )

  if (result.status === 201) {
    return { ok: true, data: result.data.content }
  } else {
    logger.error(
      { error: JSON.stringify(result.data) },
      'Unknown error when creating invoice row'
    )

    return { ok: false, err: 'unknown' }
  }
}

export async function deleteInvoiceRow(params: {
  leaseId: string
  invoiceRowId: string
}): Promise<AdapterResult<null, 'unknown'>> {
  const result = await axios.delete(
    `${tenantsLeasesServiceUrl}/leases/${params.leaseId}/invoice-rows/${params.invoiceRowId}`
  )

  if (result.status === 200) {
    return { ok: true, data: null }
  } else {
    logger.error(
      { error: JSON.stringify(result.data) },
      'Unknown error when deleting invoice row'
    )

    return { ok: false, err: 'unknown' }
  }
}
