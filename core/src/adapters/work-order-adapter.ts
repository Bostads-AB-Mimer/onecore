import { loggedAxios as axios, logger } from 'onecore-utilities'
import config from '../common/config'
import { WorkOrder, CreateWorkOrder } from 'onecore-types'
import { AdapterResult } from './types'
import {
  CoreWorkOrder,
  CoreWorkOrderSchemaArray,
} from '../services/work-order-service/schemas'

export const getWorkOrdersByContactCode = async (
  contactCode: string
): Promise<AdapterResult<CoreWorkOrder[], 'schema-error' | 'unknown'>> => {
  try {
    const res = await axios.get<{ content: { workOrders: WorkOrder[] } }>(
      `${config.workOrderService.url}/workOrders/contactCode/${contactCode}`
    )
    const parsed = CoreWorkOrderSchemaArray.safeParse(
      res.data.content.workOrders
    )
    if (!parsed.success) {
      logger.error(
        { error: parsed.error },
        'work-order-adapter.getWorkOrdersByRentalPropertyId'
      )
      return { ok: false, err: 'schema-error' }
    }

    return {
      ok: true,
      data: parsed.data,
    }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.getWorkOrdersByContactCode')
    return { ok: false, err: 'unknown' }
  }
}

export const getWorkOrdersByRentalPropertyId = async (
  rentalPropertyId: string
): Promise<AdapterResult<CoreWorkOrder[], 'schema-error' | 'unknown'>> => {
  try {
    const res = await axios.get<{ content: { workOrders: WorkOrder[] } }>(
      `${config.workOrderService.url}/workOrders/residenceId/${rentalPropertyId}`
    )
    const parsed = CoreWorkOrderSchemaArray.safeParse(
      res.data.content.workOrders
    )
    if (!parsed.success) {
      logger.error(
        { error: parsed.error },
        'work-order-adapter.getWorkOrdersByRentalPropertyId'
      )
      return { ok: false, err: 'schema-error' }
    }

    return {
      ok: true,
      data: parsed.data,
    }
  } catch (error) {
    logger.error(
      { error },
      'work-order-adapter.getWorkOrdersByRentalPropertyId'
    )
    return { ok: false, err: 'unknown' }
  }
}

export const createWorkOrder = async (
  CreateWorkOrder: CreateWorkOrder
): Promise<AdapterResult<{ newWorkOrderId: number }, string>> => {
  try {
    const res = await axios.post(
      `${config.workOrderService.url}/workOrders`,
      CreateWorkOrder,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    return { ok: true, data: res.data.content }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.createWorkOrder')
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    return { ok: false, err: errorMessage }
  }
}

export const updateWorkOrder = async (
  workOrderId: number,
  message: string
): Promise<AdapterResult<string, string>> => {
  try {
    const res = await axios.post(
      `${config.workOrderService.url}/workOrders/${workOrderId}/update`,
      {
        message: message,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    return { ok: true, data: res.data.content }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.updateWorkOrder')
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    return { ok: false, err: errorMessage }
  }
}

export const closeWorkOrder = async (
  workOrderId: number
): Promise<AdapterResult<string, string>> => {
  try {
    const res = await axios.post(
      `${config.workOrderService.url}/workOrders/${workOrderId}/close`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    return { ok: true, data: res.data.content }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.closeWorkOrder')
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    return { ok: false, err: errorMessage }
  }
}
