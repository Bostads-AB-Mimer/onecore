import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'
import { logger } from '@onecore/utilities'
import { match } from 'ts-pattern'
import { ZodError } from 'zod'

import {
  TenfastTenantByContactCodeResponseSchema,
  TenfastTenant,
  TenfastRentalObject,
  TenfastRentalObjectByRentalObjectCodeResponseSchema,
  TenfastCreateLeaseRequestSchema,
  TenfastLease,
  TenfastLeaseSchema,
} from '../../../../common/adapters/tenfast/schemas'
import config from '../../../../common/config'
import { AdapterResult } from '../../adapters/types'

const baseUrl = config.tenfast.baseUrl
// const apiKey = config.tenfast.apiKey
const username = config.tenfast.username
const password = config.tenfast.password
let accessToken: string | undefined = undefined

// const axiosOptions = {
//   headers: {
//     'Content-type': 'application/json',
//     // 'api-token': apiKey,
//   },
// }

type SchemaError = { tag: 'schema-error'; error: ZodError }

const getAccessToken = async () => {
  const config = {
    method: 'get',
    url: `${baseUrl}/v1/auth`,
    headers: {
      'Content-Type': 'application/json',
    },
    auth: {
      username: username,
      password: password,
    },
  }

  console.log('getAccessToken config', config)
  const result = await axios(config)
  console.log('getAccessToken result.data', result.data)
  return result.data.token
}

const createHeaders = (accessToken: string) => {
  const headers = {
    // Authorization: 'Bearer ' + accessToken,
    'api-token': accessToken,
  }

  return headers
}

const getFromTenfast = async <T = any>(
  config: AxiosRequestConfig<any>
): Promise<AxiosResponse<T, any>> => {
  // console.log('accessToken', accessToken)
  // console.log('config', config)
  if (!accessToken) {
    accessToken = await getAccessToken()
  }
  // console.log('accessToken', accessToken)
  try {
    config.headers = createHeaders(accessToken ?? '')

    return await axios(config)
  } catch (error) {
    const axiosErr = error as AxiosError
    // console.log('axiosErr.response?.status', axiosErr.response?.status)
    if (axiosErr.response?.status === 401) {
      // console.log('axiosErr.response?', axiosErr.response)
      accessToken = await getAccessToken()
      return await getFromTenfast(config)
    }

    throw error
  }
}

export const createLease = async (
  contactCode: string,
  rentalObjectCode: string,
  fromDate: Date,
  companyCode: string
): Promise<
  AdapterResult<
    any,
    | 'could-not-find-template'
    | 'could-not-retrieve-contact'
    | 'could-not-find-rental-object'
    | 'lease-could-not-be-created'
    | 'unknown'
  >
> => {
  //TODO: Choose template depending on type of contract / rental object, ex extern bilplats/poängfri bilplats
  //TODO: Create schema and type for lease template
  const template = await getLeaseTemplate('6012d3ffe095ca4e36525235')
  if (!template) {
    return { ok: false, err: 'could-not-find-template' }
  }

  console.log('template', template)

  const tenant = await getTenantByContactCode(contactCode)
  if (!tenant.ok) {
    return { ok: false, err: 'could-not-retrieve-contact' }
  } else if (!tenant.data) {
    //TODO: Create tenant in tenFAST
    //behöver all data för tenant som krävs....
  }

  console.log('tenant', tenant)
  //TODO: Get rental object ID and hyror
  const rentalObject = await getRentalObject(rentalObjectCode)

  if (!rentalObject) {
    return { ok: false, err: 'could-not-find-rental-object' }
  }

  console.log('rentalObject', rentalObject)

  try {
    //TODO: Add Article property once tenfast added it to staging env
    const createLeaseRequestData = TenfastCreateLeaseRequestSchema.parse({
      hyresgaster: [tenant.data?._id],
      hyresobjekt: [rentalObject._id],
      avtalsbyggare: true,
      hyror: [
        {
          article: rentalObject.article,
          amount: rentalObject.hyra,
          vat: 0,
          label: 'Hyra', //TODO:varifrån kommer denna?
        },
        ...rentalObject.hyror,
      ],
      startDate: new Date().toISOString(),
      endDate: new Date(
        new Date().setFullYear(new Date().getFullYear() + 1)
      ).toISOString(),
      aviseringsTyp: 'none',
      uppsagningstid: '1m',
      forskottAvisering: '1m',
      betalningsOffset: '1d',
      betalasForskott: false,
      vatEnabled: true,
      originalTemplate: '6012d3ffe095ca4e36525235',
      template: template,
      method: 'manual',
      aviseringsFrekvens: '1m',
    })

    const leaseResponse = await getFromTenfast({
      method: 'post',
      url: `${baseUrl}/v1/hyresvard/avtal`,
      data: createLeaseRequestData,
      // ...axiosOptions,
    })
    if (leaseResponse.status !== 201) {
      //todo:tolka ut mer specifika fel från tenfast
      return { ok: false, err: 'lease-could-not-be-created' }
    }

    return { ok: true, data: leaseResponse.data }
  } catch (err) {
    logger.error({ error: err }, 'Lease could not be created in tenFAST')
    return { ok: false, err: 'lease-could-not-be-created' }
  }
}

export const getRentalObject = async (
  rentalObjectCode: string
): Promise<TenfastRentalObject | null> => {
  try {
    const rentalObjectResponse = await getFromTenfast({
      method: 'get',
      url: `${baseUrl}/v1/hyresvard/hyresobjekt?filter[externalId]=${rentalObjectCode}`,
      // ...axiosOptions,
    })

    const parsedRentalObjectResponse =
      TenfastRentalObjectByRentalObjectCodeResponseSchema.safeParse(
        rentalObjectResponse.data
      )
    if (!parsedRentalObjectResponse.success) {
      throw new Error(
        'Failed to parse Tenfast response',
        parsedRentalObjectResponse.error
      )
    }

    return parsedRentalObjectResponse.data.records[0] ?? null
  } catch (err: any) {
    logger.error(
      { error: err },
      'Rental Object could not be retrieved from tenFAST'
    )
    return null
  }
}

export const getLeaseTemplate = async (leaseId: string) => {
  try {
    const templateResponse = await getFromTenfast({
      method: 'get',
      url: `${baseUrl}/v1/hyresvard/avtalsmallar/${leaseId}`,
      // ...axiosOptions,
    })
    return templateResponse.data
  } catch (err: any) {
    logger.error(
      { error: err },
      'Lease templete could not be retrieved from tenFAST'
    )
    return
  }
}

export const getTenantByContactCode = async (
  contactCode: string
): Promise<AdapterResult<TenfastTenant | null, string>> => {
  try {
    const tenantResponse = await getFromTenfast({
      method: 'get',
      url: `${baseUrl}/v1/hyresvard/hyresgaster?filter[externalId]=${contactCode}`,
      // ...axiosOptions,
    })
    if (tenantResponse.status !== 200) {
      return { ok: false, err: tenantResponse.statusText }
    }

    const parsedTenantResponse =
      TenfastTenantByContactCodeResponseSchema.safeParse(tenantResponse.data)
    if (!parsedTenantResponse.success) {
      throw new Error(
        'Failed to parse Tenfast response',
        parsedTenantResponse.error
      )
    }

    return {
      ok: true,
      data: parsedTenantResponse.data.records[0] ?? null,
    }
  } catch (err: any) {
    logger.error(err)
    return { ok: false, err: err.statusCode }
  }
}

type GetLeasesFilters = {
  type: ('active' | 'upcoming' | 'terminated')[]
}

const defaultFilters: GetLeasesFilters = { type: ['active'] }

export async function getLeasesByTenantId(
  tenantId: string,
  filters: GetLeasesFilters = defaultFilters
): Promise<AdapterResult<TenfastLease[], 'unknown' | SchemaError>> {
  try {
    const res = await getFromTenfast({
      method: 'get',
      url: `${baseUrl}/v1/hyresvard/hyresgaster/${tenantId}/avtal?populate=hyresgaster`,
    })

    // Not sure we want to fail completely here if parsing fails
    const leases = TenfastLeaseSchema.array().safeParse(res.data)

    if (!leases.success) {
      logger.error(
        { error: JSON.stringify(leases.error, null, 2) },
        'Failed to parse Tenfast response'
      )

      return { ok: false, err: { tag: 'schema-error', error: leases.error } }
    }

    return {
      ok: true,
      data: filterByType(leases.data, filters.type),
    }
  } catch (err) {
    logger.error(mapHttpError(err), 'tenfast-adapter.getLeasesByTenantId')
    return { ok: false, err: 'unknown' }
  }
}

// prettier-ignore
function filterByType(leases: TenfastLease[], types: GetLeasesFilters['type']) {
  const now = new Date()
  return types.reduce(
    (acc, type) =>
      acc.filter((l) =>
        match(type)
          .with('active', () => l.startDate < now && l.endDate && l.endDate > now)
          .with('upcoming', () => l.startDate > now)
          .with('terminated', () => l.cancellation.cancelled)
          .exhaustive()
      ),
    leases
  )
}

// TODO: maybe move to utilities and rework
function mapHttpError(err: unknown): { err: string } {
  if (err instanceof AxiosError) {
    return {
      err: JSON.stringify(
        {
          statusCode: err.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
        },
        null,
        2
      ),
    }
  } else {
    return { err: JSON.stringify(err, null, 2) }
  }
}
