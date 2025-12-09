import createClient from 'openapi-fetch'
import { logger } from '@onecore/utilities'
import config from '../../common/config'
import { AdapterResult } from '../types'
import {
  CreateWorkOrderResponse,
  CreateWorkOrderResponseSchema,
} from '../../services/work-order-service/schemas'
import { components, paths } from './generated/api-types'

export type OdooWorkOrder = components['schemas']['WorkOrder']
export type XpandWorkOrder = components['schemas']['XpandWorkOrder']
export type XpandWorkOrderDetails =
  components['schemas']['XpandWorkOrderDetails']

const client = () =>
  createClient<paths>({
    baseUrl: config.workOrderService.url,
    headers: {
      'Content-Type': 'application/json',
    },
  })

export const getWorkOrdersByContactCode = async (
  contactCode: string
): Promise<AdapterResult<OdooWorkOrder[], 'unknown'>> => {
  try {
    const fetchResponse = await client().GET(
      '/workOrders/contactCode/{contactCode}',
      {
        params: { path: { contactCode } },
      }
    )

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data.content?.workOrders) {
      throw 'missing-content'
    }

    return {
      ok: true,
      data: fetchResponse.data.content.workOrders,
    }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.getWorkOrdersByContactCode')
    return { ok: false, err: 'unknown' }
  }
}

export const getWorkOrdersByRentalPropertyId = async (
  rentalPropertyId: string
): Promise<AdapterResult<OdooWorkOrder[], 'unknown'>> => {
  try {
    const fetchResponse = await client().GET(
      '/workOrders/residenceId/{residenceId}',
      {
        params: { path: { residenceId: rentalPropertyId } },
      }
    )

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data.content?.workOrders) {
      throw 'missing-content'
    }

    return {
      ok: true,
      data: fetchResponse.data.content.workOrders,
    }
  } catch (error) {
    logger.error(
      { error },
      'work-order-adapter.getWorkOrdersByRentalPropertyId'
    )
    return { ok: false, err: 'unknown' }
  }
}

export const getWorkOrdersByPropertyId = async (
  propertyId: string
): Promise<AdapterResult<OdooWorkOrder[], 'unknown'>> => {
  try {
    const fetchResponse = await client().GET(
      '/workOrders/propertyId/{propertyId}',
      {
        params: { path: { propertyId } },
      }
    )

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data?.content?.workOrders) {
      throw 'missing-content'
    }

    return {
      ok: true,
      data: fetchResponse.data.content.workOrders,
    }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.getWorkOrdersByPropertyId')
    return { ok: false, err: 'unknown' }
  }
}

export const getXpandWorkOrdersByContactCode = async (
  contactCode: string,
  {
    skip = 0,
    limit = 100,
    sortAscending,
  }: { skip?: number; limit?: number; sortAscending?: boolean } = {}
): Promise<AdapterResult<XpandWorkOrder[], 'unknown'>> => {
  try {
    const fetchResponse = await client().GET(
      '/workOrders/xpand/contactCode/{contactCode}',
      {
        params: {
          path: { contactCode },
          query: { skip, limit, sortAscending },
        },
      }
    )

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data?.content?.workOrders) {
      throw 'missing-content'
    }

    return {
      ok: true,
      data: fetchResponse.data.content.workOrders as XpandWorkOrder[],
    }
  } catch (error) {
    logger.error(
      { error },
      'work-order-adapter.getXpandWorkOrdersByContactCode'
    )

    return { ok: false, err: 'unknown' }
  }
}

export const getXpandWorkOrdersByRentalPropertyId = async (
  rentalPropertyId: string,
  {
    skip = 0,
    limit = 100,
    sortAscending,
  }: { skip?: number; limit?: number; sortAscending?: boolean } = {}
): Promise<AdapterResult<XpandWorkOrder[], 'unknown'>> => {
  try {
    const fetchResponse = await client().GET(
      '/workOrders/xpand/residenceId/{residenceId}',
      {
        params: {
          path: { residenceId: rentalPropertyId },
          query: { skip, limit, sortAscending },
        },
      }
    )

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data.content?.workOrders) {
      throw 'missing-content'
    }

    return {
      ok: true,
      data: fetchResponse.data?.content.workOrders,
    }
  } catch (error) {
    logger.error(
      { error },
      'work-order-adapter.getXpandWorkOrdersByRentalPropertyId'
    )

    return { ok: false, err: 'unknown' }
  }
}

export const getXpandWorkOrdersByPropertyId = async (
  propertyId: string,
  {
    skip = 0,
    limit = 100,
    sortAscending,
  }: { skip?: number; limit?: number; sortAscending?: boolean } = {}
): Promise<AdapterResult<XpandWorkOrder[], 'unknown'>> => {
  try {
    const fetchResponse = await client().GET(
      '/workOrders/xpand/propertyId/{propertyId}',
      {
        params: {
          path: { propertyId },
          query: { skip, limit, sortAscending },
        },
      }
    )

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data?.content?.workOrders) {
      throw 'missing-content'
    }

    return {
      ok: true,
      data: fetchResponse.data.content.workOrders,
    }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.getXpandWorkOrdersByPropertyId')

    return { ok: false, err: 'unknown' }
  }
}

export const getWorkOrdersByBuildingId = async (
  buildingId: string
): Promise<AdapterResult<OdooWorkOrder[], 'unknown'>> => {
  try {
    const fetchResponse = await client().GET(
      '/workOrders/buildingId/{buildingId}',
      {
        params: { path: { buildingId } },
      }
    )

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data?.content?.workOrders) {
      throw 'missing-content'
    }

    return {
      ok: true,
      data: fetchResponse.data.content.workOrders,
    }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.getWorkOrdersByBuildingId')
    return { ok: false, err: 'unknown' }
  }
}

export const getXpandWorkOrdersByBuildingId = async (
  buildingId: string,
  {
    skip = 0,
    limit = 100,
    sortAscending,
  }: { skip?: number; limit?: number; sortAscending?: boolean } = {}
): Promise<AdapterResult<XpandWorkOrder[], 'unknown'>> => {
  try {
    const fetchResponse = await client().GET(
      '/workOrders/xpand/buildingId/{buildingId}',
      {
        params: {
          path: { buildingId },
          query: { skip, limit, sortAscending },
        },
      }
    )

    if (fetchResponse.error) {
      throw fetchResponse.error
    }

    if (!fetchResponse.data?.content?.workOrders) {
      throw 'missing-content'
    }

    return {
      ok: true,
      data: fetchResponse.data.content.workOrders,
    }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.getXpandWorkOrdersByBuildingId')

    return { ok: false, err: 'unknown' }
  }
}

export const getXpandWorkOrderDetails = async (
  workOrderCode: string
): Promise<AdapterResult<XpandWorkOrderDetails, 'not-found' | 'unknown'>> => {
  try {
    const fetchResponse = await client().GET('/workOrders/xpand/{code}', {
      params: { path: { code: workOrderCode } },
    })

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    if (fetchResponse.data?.content) {
      return {
        ok: true,
        data: fetchResponse.data.content,
      }
    }

    return { ok: false, err: 'unknown' }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.getXpandWorkOrderDetails')
    return { ok: false, err: 'unknown' }
  }
}

export const createWorkOrder = async (
  CreateWorkOrder: components['schemas']['CreateWorkOrderBody']
): Promise<AdapterResult<CreateWorkOrderResponse, string>> => {
  try {
    const fetchResponse = await client().POST('/workOrders', {
      body: CreateWorkOrder,
    })
    if (fetchResponse.data?.content?.newWorkOrderId !== undefined) {
      const parsed = CreateWorkOrderResponseSchema.safeParse(
        fetchResponse.data.content
      )

      if (!parsed.success) {
        return { ok: false, err: 'schema-error' }
      }

      return {
        ok: true,
        data: parsed.data,
      }
    }

    if (fetchResponse.error) {
      return { ok: false, err: fetchResponse.error.error ?? 'Unknown error' }
    }

    return { ok: false, err: 'unknown' }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.createWorkOrder')
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    return { ok: false, err: errorMessage }
  }
}

export const updateWorkOrder = async (
  workOrderId: string,
  message: string
): Promise<AdapterResult<string, string>> => {
  try {
    const fetchResponse = await client().POST(
      '/workOrders/{workOrderId}/update',
      {
        body: { message },
        params: { path: { workOrderId } },
      }
    )
    if (fetchResponse.data?.content?.message) {
      return {
        ok: true,
        data: fetchResponse.data.content.message,
      }
    }

    return { ok: false, err: 'unknown' }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.updateWorkOrder')
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    return { ok: false, err: errorMessage }
  }
}

export const closeWorkOrder = async (
  workOrderId: string
): Promise<AdapterResult<string, string>> => {
  try {
    const fetchResponse = await client().POST(
      '/workOrders/{workOrderId}/close',
      {
        params: { path: { workOrderId } },
      }
    )
    if (fetchResponse.data?.content?.message) {
      return {
        ok: true,
        data: fetchResponse.data.content.message,
      }
    }

    return { ok: false, err: 'unknown' }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.closeWorkOrder')
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    return { ok: false, err: errorMessage }
  }
}
