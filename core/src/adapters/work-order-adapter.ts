import { loggedAxios as axios, logger } from 'onecore-utilities'
import config from '../common/config'
import { WorkOrder, CreateWorkOrder } from 'onecore-types'
import { AdapterResult } from './types'

export const getWorkOrdersByContactCode = async (
  contactCode: string
): Promise<AdapterResult<WorkOrder[], string>> => {
  try {
    const res = await axios.get<{ content: WorkOrder[] }>(
      `${config.workOrderService.url}/workOrders/contactCode/${contactCode}`
    )

    return { ok: true, data: res.data.content }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.getWorkOrdersByContactCode')
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    return { ok: false, err: errorMessage }
  }
}

export const createWorkOrder = async (
  CreateWorkOrder: CreateWorkOrder
): Promise<AdapterResult<{ newWorkOrderId: number }, string>> => {
  try {
    const res = await axios.post(
      `${config.workOrderService.url}/workOrders`,
      CreateWorkOrder
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
      message
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
      `${config.workOrderService.url}/workOrders/${workOrderId}/close`
    )
    return { ok: true, data: res.data.content }
  } catch (error) {
    logger.error({ error }, 'work-order-adapter.closeWorkOrder')
    const errorMessage = error instanceof Error ? error.message : 'unknown'
    return { ok: false, err: errorMessage }
  }
}
