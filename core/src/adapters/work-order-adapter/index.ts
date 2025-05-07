import createClient from 'openapi-fetch'
import { logger } from 'onecore-utilities'
import config from '../../common/config'
import { AdapterResult } from '../types'
import {
  CoreWorkOrder,
  CoreWorkOrderSchemaArray,
  CreateWorkOrderResponse,
  CreateWorkOrderResponseSchema,
} from '../../services/work-order-service/schemas'
import { components, paths } from './generated/api-types'

const client = () =>
  createClient<paths>({
    baseUrl: config.workOrderService.url,
    headers: {
      'Content-Type': 'application/json',
    },
  })

export const getWorkOrdersByContactCode = async (
  contactCode: string
): Promise<AdapterResult<CoreWorkOrder[], 'schema-error' | 'unknown'>> => {
  try {
    const fetchResponse = await client().GET(
      '/workOrders/contactCode/{contactCode}',
      {
        params: { path: { contactCode } },
      }
    )
    if (fetchResponse.data?.content?.workOrders) {
      const parsed = CoreWorkOrderSchemaArray.safeParse(
        fetchResponse.data.content.workOrders
      )
      if (!parsed.success) {
        return { ok: false, err: 'schema-error' }
      }

      return {
        ok: true,
        data: parsed.data,
      }
    }

    return { ok: false, err: 'unknown' }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.getWorkOrdersByContactCode')
    return { ok: false, err: 'unknown' }
  }
}

export const getWorkOrdersByRentalPropertyId = async (
  rentalPropertyId: string
): Promise<AdapterResult<CoreWorkOrder[], 'schema-error' | 'unknown'>> => {
  try {
    const fetchResponse = await client().GET(
      '/workOrders/residenceId/{residenceId}',
      {
        params: { path: { residenceId: rentalPropertyId } },
      }
    )
    if (fetchResponse.data?.content?.workOrders) {
      const parsed = CoreWorkOrderSchemaArray.safeParse(
        fetchResponse.data.content.workOrders
      )
      if (!parsed.success) {
        return { ok: false, err: 'schema-error' }
      }

      return {
        ok: true,
        data: parsed.data,
      }
    }

    return { ok: false, err: 'unknown' }
  } catch (error) {
    logger.error(
      { error },
      'work-order-adapter.getWorkOrdersByRentalPropertyId'
    )
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
