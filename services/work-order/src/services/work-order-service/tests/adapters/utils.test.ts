import { transformWorkOrder, transformMessages } from '../../adapters/utils'
import { OdooWorkOrder, WorkOrder, OdooWorkOrderMessage } from 'onecore-types'
import * as factory from '../factories'

describe('utils', () => {
  describe('transformWorkOrder', () => {
    const odooWorkOrderMock: OdooWorkOrder = factory.odooWorkOrder.build()

    it('should transform a work order correctly', () => {
      const result = transformWorkOrder(odooWorkOrderMock) as WorkOrder

      expect(result).toHaveProperty('AccessCaption')
      expect(result).toHaveProperty('Caption')
      expect(result).toHaveProperty('Code')
      expect(result).toHaveProperty('ContactCode')
      expect(result).toHaveProperty('Description')
      expect(result).toHaveProperty('DetailsCaption')
      expect(result).toHaveProperty('ExternalResource')
      expect(result).toHaveProperty('Id')
      expect(result).toHaveProperty('LastChange')
      expect(result).toHaveProperty('Priority')
      expect(result).toHaveProperty('Registered')
      expect(result).toHaveProperty('RentalObjectCode')
      expect(result).toHaveProperty('Status')
      expect(result).toHaveProperty('UseMasterKey')
      expect(result).toHaveProperty('WorkOrderRows')

      expect(result.WorkOrderRows).toBeInstanceOf(Array)
      expect(result.WorkOrderRows[0]).toHaveProperty('Description')
      expect(result.WorkOrderRows[0]).toHaveProperty('LocationCode')
      expect(result.WorkOrderRows[0]).toHaveProperty('EquipmentCode')

      // Check that some properties contain expected substrings
      expect(result.Description).toContain('Ärendebeskrivning')
      expect(result.Description).toContain('Kund nås enklast mellan')
      expect(result.Description).toContain('på telefonnummer')
    })
  })

  describe('transformMessages', () => {
    const odooWorkOrderMessageMock: OdooWorkOrderMessage[] =
      factory.odooWorkOrderMessage.buildList(2)

    it('should transform messages correctly', () => {
      const result = transformMessages(odooWorkOrderMessageMock)

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBe(2)

      result.forEach((message) => {
        expect(message).toHaveProperty('id')
        expect(message).toHaveProperty('body')
        expect(message).toHaveProperty('messageType')
        expect(message).toHaveProperty('author')
        expect(message).toHaveProperty('createDate')
      })

      expect(result[0].id).toBe(1)
      expect(result[0].body).toBe('Hej, här är ett meddelande från kunden')
      expect(result[0].messageType).toBe('from_tenant')
      expect(result[0].author).toBe('Kund')
    })
  })
})
