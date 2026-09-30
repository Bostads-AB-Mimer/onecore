import {
  transformWorkOrder,
  transformMessages,
} from '../../../adapters/odoo-adapter/utils'
import * as factory from '../../factories'

describe('odoo-adapter utils', () => {
  describe('transformWorkOrder', () => {
    const odooWorkOrderMock = factory.odooWorkOrder.build()

    it('should transform a work order correctly', () => {
      const result = transformWorkOrder(odooWorkOrderMock)

      expect(result).toHaveProperty('AccessCaption')
      expect(result).toHaveProperty('Caption')
      expect(result).toHaveProperty('Code')
      expect(result).toHaveProperty('ContactCode')
      expect(result).toHaveProperty('Description')
      expect(result).toHaveProperty('DetailsCaption')
      expect(result).toHaveProperty('ExternalResource')
      expect(result).toHaveProperty('Id')
      expect(result).toHaveProperty('LastChanged')
      expect(result).toHaveProperty('Priority')
      expect(result).toHaveProperty('Registered')
      expect(result).toHaveProperty('RentalObjectCode')
      expect(result).toHaveProperty('Status')
      expect(result).toHaveProperty('HiddenFromMyPages')
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
    const odooWorkOrderMessageMock = factory.odooWorkOrderMessage.buildList(2)

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

    // A tenant on Mina sidor is answered by an organisation, never by a named
    // handläggare. Odoo works out the label when the message is written and
    // stores it on the message; this adapter only carries it across.
    it('should use the sender Odoo captured for the tenant, not the author name', () => {
      const result = transformMessages([
        factory.odooWorkOrderMessage.build({
          message_type: 'tenant_mail',
          author_id: [7, 'Bostads AB Mimer, Sebastian Handläggare'],
          onecore_tenant_author_name: 'Mimer',
        }),
      ])

      expect(result[0].author).toBe('Mimer')
    })

    it('should keep an external contractor sender whole', () => {
      const result = transformMessages([
        factory.odooWorkOrderMessage.build({
          message_type: 'tenant_my_pages',
          author_id: [9, 'Bostads AB Mimer, Erik Entreprenör'],
          onecore_tenant_author_name: 'Mimers Leverantör - VVS Service AB',
        }),
      ])

      expect(result[0].author).toBe('Mimers Leverantör - VVS Service AB')
    })

    // Odoo leaves the field empty on from_tenant — the tenant wrote it, and
    // Mina sidor labels their own messages "Du" regardless of what we send.
    it('should keep naming the author on a message the tenant wrote', () => {
      const result = transformMessages([
        factory.odooWorkOrderMessage.build({
          message_type: 'from_tenant',
          author_id: [3, 'Bostads AB Mimer, Anna Hyresgäst'],
          onecore_tenant_author_name: false,
        }),
      ])

      expect(result[0].author).toBe('Anna Hyresgäst')
    })

    // Belt and braces for a message written before the Odoo upgrade that the
    // backfill missed: falling back to author_id here would put a handläggare's
    // name in front of a tenant, which is the whole bug.
    it('should fall back to Mimer on an outbound message Odoo left unlabelled', () => {
      const result = transformMessages([
        factory.odooWorkOrderMessage.build({
          message_type: 'failed_tenant_sms',
          author_id: [7, 'Bostads AB Mimer, Sebastian Handläggare'],
          onecore_tenant_author_name: false,
        }),
      ])

      expect(result[0].author).toBe('Mimer')
    })
  })
})
