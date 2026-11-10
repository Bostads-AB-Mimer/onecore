import { Invoice } from '@onecore/types'
import { logger } from '@onecore/utilities'

import * as xledgerAdapter from '@src/services/common/adapters/xledger-adapter'
import * as tenfastAdapter from '@src/common/adapters/tenfast/tenfast-adapter'
import * as xpandAdapter from '@src/services/invoice-service/adapters/xpand-db-adapter'
import { getInvoicesByContactCode } from '@src/services/invoice-service/service'

import * as factory from '@test/factories'

const parsed = (invoice: Invoice) => ({ invoice })

const contactCode = 'P123456'
const coHolderContactCode = 'P999999'

const xledgerInvoice = (params: Partial<Invoice>) =>
  factory.invoice.build({ source: 'next', invoiceRows: [], ...params })

const xpandInvoice = (params: Partial<Invoice>) =>
  factory.invoice.build({ source: 'legacy', invoiceRows: [], ...params })

describe(getInvoicesByContactCode, () => {
  let getXledgerInvoices: jest.SpyInstance
  let getTenfastInvoices: jest.SpyInstance
  let getXpandInvoices: jest.SpyInstance
  let getXpandInvoiceRows: jest.SpyInstance
  let getXledgerInvoicesByNumber: jest.SpyInstance

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()

    getXledgerInvoices = jest
      .spyOn(xledgerAdapter, 'getInvoicesByContactCode')
      .mockResolvedValue([])
    getTenfastInvoices = jest
      .spyOn(tenfastAdapter, 'getInvoicesByContactCode')
      .mockResolvedValue([])
    getXpandInvoices = jest
      .spyOn(xpandAdapter, 'getInvoicesByContactCode')
      .mockResolvedValue(undefined)
    getXpandInvoiceRows = jest
      .spyOn(xpandAdapter, 'getInvoiceRows')
      .mockResolvedValue([])
    getXledgerInvoicesByNumber = jest
      .spyOn(xledgerAdapter, 'getInvoicesByInvoiceNumbers')
      .mockResolvedValue([])
  })

  it('attaches Xpand invoice rows to an invoice that is not in Tenfast', async () => {
    // Arrange
    const invoice = xledgerInvoice({ invoiceId: '552000000001' })
    const rows = factory.invoiceRow.buildList(2, {
      invoiceNumber: '552000000001',
    })
    getXledgerInvoices.mockResolvedValueOnce([parsed(invoice)])
    getXpandInvoices.mockResolvedValueOnce([
      xpandInvoice({ invoiceId: '552000000001' }),
    ])
    getXpandInvoiceRows.mockResolvedValueOnce(rows)

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(getXpandInvoiceRows).toHaveBeenCalledWith('001', ['552000000001'])
    expect(result).toHaveLength(1)
    expect(result[0].invoiceRows).toEqual(rows)
  })

  it('keeps the rows and period from Tenfast for an invoice that is in Tenfast', async () => {
    // Arrange
    const invoiceId = '552000000001'
    const tenfastRows = factory.invoiceRow.buildList(1, {
      invoiceNumber: invoiceId,
      invoiceRowText: 'Tenfast row',
    })
    const tenfastInvoice = factory.invoice.build({
      invoiceId,
      source: 'next',
      fromDate: new Date('2026-10-01T00:00:00.000Z'),
      toDate: new Date('2026-10-31T00:00:00.000Z'),
      invoiceRows: tenfastRows,
    })
    getXledgerInvoices.mockResolvedValueOnce([
      parsed(
        xledgerInvoice({
          invoiceId,
          fromDate: new Date('2026-09-01T00:00:00.000Z'),
          toDate: new Date('2026-09-30T00:00:00.000Z'),
        })
      ),
    ])
    getTenfastInvoices.mockResolvedValueOnce([parsed(tenfastInvoice)])
    getXpandInvoices.mockResolvedValueOnce([
      xpandInvoice({
        invoiceId,
        fromDate: new Date('2026-08-01T00:00:00.000Z'),
        toDate: new Date('2026-08-31T00:00:00.000Z'),
      }),
    ])
    getXpandInvoiceRows.mockResolvedValue(
      factory.invoiceRow.buildList(1, { invoiceNumber: invoiceId })
    )

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].invoiceRows).toEqual(tenfastRows)
    expect(result[0].fromDate).toEqual(tenfastInvoice.fromDate)
    expect(result[0].toDate).toEqual(tenfastInvoice.toDate)
    expect(getXpandInvoiceRows).not.toHaveBeenCalledWith(
      '001',
      expect.arrayContaining([invoiceId])
    )
  })

  it('uses the period from Xpand for an Xledger invoice that is not in Tenfast', async () => {
    // Arrange
    const invoiceId = '552000000001'
    const fromXpand = xpandInvoice({
      invoiceId,
      fromDate: new Date('2025-03-01T00:00:00.000Z'),
      toDate: new Date('2025-03-31T00:00:00.000Z'),
    })
    getXledgerInvoices.mockResolvedValueOnce([
      parsed(
        xledgerInvoice({
          invoiceId,
          fromDate: new Date('2025-02-01T00:00:00.000Z'),
          toDate: new Date('2025-02-28T00:00:00.000Z'),
        })
      ),
    ])
    getXpandInvoices.mockResolvedValueOnce([fromXpand])

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(result[0].fromDate).toEqual(fromXpand.fromDate)
    expect(result[0].toDate).toEqual(fromXpand.toDate)
    expect(result[0].source).toBe('next')
  })

  it("appends the contact's own Xpand-only invoices with their Xpand rows", async () => {
    // Arrange
    const ownInvoice = xpandInvoice({
      invoiceId: '552000000002',
      reference: contactCode,
    })
    const rows = factory.invoiceRow.buildList(1, {
      invoiceNumber: '552000000002',
    })
    getXledgerInvoices.mockResolvedValueOnce([
      parsed(xledgerInvoice({ invoiceId: '552000000001' })),
    ])
    getXpandInvoices.mockResolvedValueOnce([ownInvoice])
    getXpandInvoiceRows.mockResolvedValueOnce(rows)

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(result.map((invoice) => invoice.invoiceId)).toEqual([
      '552000000001',
      '552000000002',
    ])
    expect(result[1]).toEqual(
      expect.objectContaining({ source: 'legacy', invoiceRows: rows })
    )
    // Invoices billed to the contact itself that are missing in Xledger
    // predate Xledger, so they are not looked up there.
    expect(getXledgerInvoicesByNumber).not.toHaveBeenCalled()
  })

  it('treats an Xpand invoice as the contact’s own regardless of contact code casing', async () => {
    // Arrange
    getXpandInvoices.mockResolvedValueOnce([
      xpandInvoice({ invoiceId: '552000000002', reference: 'P123456' }),
    ])

    // Act
    const result = await getInvoicesByContactCode('p123456 ')

    // Assert
    expect(result).toHaveLength(1)
    expect(getXledgerInvoicesByNumber).not.toHaveBeenCalled()
  })

  // MIM-1160: invoices found via a shared lease belong to another paying
  // contact, so the contact-scoped Xledger lookup misses them.
  it('appends a household invoice billed to the co-holder, enriched from Xledger by invoice number', async () => {
    // Arrange
    const sentToDebtCollection = new Date('2026-05-01T00:00:00.000Z')
    const householdInvoice = xpandInvoice({
      invoiceId: '552012345678',
      reference: coHolderContactCode,
      leaseIds: ['924-033-01-0201/10'],
      transactionTypeName: 'HYRA',
      fromDate: new Date('2026-01-01T00:00:00.000Z'),
      toDate: new Date('2026-01-31T00:00:00.000Z'),
    })
    const rows = factory.invoiceRow.buildList(1, {
      invoiceNumber: '552012345678',
    })
    getXpandInvoices.mockResolvedValueOnce([householdInvoice])
    getXledgerInvoicesByNumber.mockResolvedValueOnce([
      parsed(
        xledgerInvoice({
          invoiceId: '552012345678',
          reference: coHolderContactCode,
          sentToDebtCollection,
          remainingAmount: 1234,
          // The Xledger transform has no lease context and generates a
          // placeholder transaction type name.
          leaseIds: [],
          transactionTypeName: 'a-generated-uuid',
          fromDate: new Date('2026-02-01T00:00:00.000Z'),
          toDate: new Date('2026-02-28T00:00:00.000Z'),
        })
      ),
    ])
    getXpandInvoiceRows.mockResolvedValueOnce(rows)

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(getXledgerInvoicesByNumber).toHaveBeenCalledWith(['552012345678'])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(
      expect.objectContaining({
        invoiceId: '552012345678',
        source: 'next',
        // The paying contact, so the credit check in core does not count it
        // against the co-holder.
        reference: coHolderContactCode,
        // Xledger owns payment and debt collection data...
        sentToDebtCollection,
        remainingAmount: 1234,
        // ...but the lease context and period come from Xpand.
        leaseIds: ['924-033-01-0201/10'],
        transactionTypeName: 'HYRA',
        fromDate: householdInvoice.fromDate,
        toDate: householdInvoice.toDate,
        invoiceRows: rows,
      })
    )
  })

  it('returns one household invoice when several Xpand rows share its invoice number', async () => {
    // Arrange
    getXpandInvoices.mockResolvedValueOnce([
      xpandInvoice({
        invoiceId: '552012345678',
        reference: coHolderContactCode,
        amount: 7000,
      }),
      xpandInvoice({
        invoiceId: '552012345678',
        reference: coHolderContactCode,
        amount: 500,
      }),
    ])
    getXledgerInvoicesByNumber.mockResolvedValueOnce([
      parsed(xledgerInvoice({ invoiceId: '552012345678', amount: 7500 })),
    ])

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(7500)
  })

  it('marks a household invoice as an expected loss when Xledger only has a loss row for it', async () => {
    // Arrange
    getXpandInvoices.mockResolvedValueOnce([
      xpandInvoice({
        invoiceId: '552012345678',
        reference: coHolderContactCode,
      }),
    ])
    // A loss is recorded as a transaction on account 1529.
    getXledgerInvoicesByNumber.mockResolvedValueOnce([
      parsed(
        xledgerInvoice({ invoiceId: '552012345678', accountCode: '1529' })
      ),
    ])

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(
      expect.objectContaining({ source: 'legacy', expectedLoss: true })
    )
  })

  it('returns the household invoice from Xpand when the Xledger enrichment fails', async () => {
    // Arrange
    const householdInvoice = xpandInvoice({
      invoiceId: '552012345678',
      reference: coHolderContactCode,
    })
    getXpandInvoices.mockResolvedValueOnce([householdInvoice])
    getXledgerInvoicesByNumber.mockRejectedValueOnce(
      new Error('xledger unavailable')
    )

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(result).toEqual([householdInvoice])
    expect(logger.warn).toHaveBeenCalledWith(
      { contactCode },
      expect.stringContaining('could not enrich household invoices')
    )
  })

  it('returns the Xledger and Tenfast invoices when the Xpand lookup fails', async () => {
    // Arrange
    getXledgerInvoices.mockResolvedValueOnce([
      parsed(xledgerInvoice({ invoiceId: '552000000001' })),
    ])
    getTenfastInvoices.mockResolvedValueOnce([
      parsed(factory.invoice.build({ invoiceId: '552000000003' })),
    ])
    getXpandInvoices.mockRejectedValueOnce(new Error('xpand unavailable'))

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(result.map((invoice) => invoice.invoiceId)).toEqual([
      '552000000001',
      '552000000003',
    ])
    expect(logger.warn).toHaveBeenCalledWith(
      { contactCode },
      expect.stringContaining('Xpand invoices unavailable')
    )
  })

  it('returns the invoices with their existing rows when the Xpand row lookup fails', async () => {
    // Arrange
    const invoice = xledgerInvoice({ invoiceId: '552000000001' })
    getXledgerInvoices.mockResolvedValueOnce([parsed(invoice)])
    getXpandInvoiceRows.mockRejectedValueOnce(new Error('xpand unavailable'))

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(result).toEqual([invoice])
    expect(logger.warn).toHaveBeenCalledWith(
      { contactCode },
      expect.stringContaining('Xpand invoice rows unavailable')
    )
  })

  it('does not query Xpand for rows when the Xpand invoice lookup failed', async () => {
    // Arrange
    getXledgerInvoices.mockResolvedValueOnce([
      parsed(xledgerInvoice({ invoiceId: '552000000001' })),
    ])
    getXpandInvoices.mockRejectedValueOnce(new Error('xpand unavailable'))

    // Act
    await getInvoicesByContactCode(contactCode)

    // Assert
    expect(getXpandInvoiceRows).not.toHaveBeenCalled()
  })

  describe('when Xpand does not answer', () => {
    afterEach(() => {
      jest.useRealTimers()
    })

    it('returns the Xledger and Tenfast invoices after the timeout and logs an error', async () => {
      // Arrange
      jest.useFakeTimers()
      const invoice = xledgerInvoice({ invoiceId: '552000000001' })
      getXledgerInvoices.mockResolvedValueOnce([parsed(invoice)])
      getXpandInvoices.mockReturnValueOnce(new Promise(() => {}))

      // Act
      const resultPromise = getInvoicesByContactCode(contactCode)
      await jest.advanceTimersByTimeAsync(15_000)
      const result = await resultPromise

      // Assert
      expect(result).toEqual([invoice])
      expect(getXpandInvoiceRows).not.toHaveBeenCalled()
      expect(logger.error).toHaveBeenCalledWith(
        { contactCode, timeoutMs: 15_000 },
        expect.stringContaining('Xpand invoices timed out')
      )
    })

    it('keeps the rows an invoice already has when the Xpand row lookup times out', async () => {
      // Arrange
      jest.useFakeTimers()
      const invoice = xledgerInvoice({
        invoiceId: '552000000001',
        invoiceRows: factory.invoiceRow.buildList(1, {
          invoiceNumber: '552000000001',
        }),
      })
      getXledgerInvoices.mockResolvedValueOnce([parsed(invoice)])
      getXpandInvoiceRows.mockReturnValueOnce(new Promise(() => {}))

      // Act
      const resultPromise = getInvoicesByContactCode(contactCode)
      await jest.advanceTimersByTimeAsync(15_000)
      const result = await resultPromise

      // Assert
      expect(result).toEqual([invoice])
      expect(logger.error).toHaveBeenCalledWith(
        { contactCode, timeoutMs: 15_000 },
        expect.stringContaining('Xpand invoice rows timed out')
      )
    })
  })

  it('returns each invoice once when it is in Xledger, Tenfast and Xpand', async () => {
    // Arrange
    const inAllSources = '552000000001'
    const inTenfastAndXpand = '552000000002'
    getXledgerInvoices.mockResolvedValueOnce([
      parsed(xledgerInvoice({ invoiceId: inAllSources })),
    ])
    getTenfastInvoices.mockResolvedValueOnce([
      parsed(factory.invoice.build({ invoiceId: inAllSources })),
      parsed(factory.invoice.build({ invoiceId: inTenfastAndXpand })),
    ])
    getXpandInvoices.mockResolvedValueOnce([
      xpandInvoice({ invoiceId: inAllSources }),
      xpandInvoice({ invoiceId: inTenfastAndXpand }),
      xpandInvoice({
        invoiceId: inTenfastAndXpand,
        reference: coHolderContactCode,
      }),
    ])

    // Act
    const result = await getInvoicesByContactCode(contactCode)

    // Assert
    expect(result.map((invoice) => invoice.invoiceId)).toEqual([
      inAllSources,
      inTenfastAndXpand,
    ])
    expect(getXledgerInvoicesByNumber).not.toHaveBeenCalled()
  })
})
