import * as tenantLeaseAdapter from '../../../adapters/xpand/tenant-lease-adapter'

jest.mock('knex', () => () => ({
  raw: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereRaw: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  whereNotNull: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  orderByRaw: jest.fn().mockReturnThis(),
  then: jest
    .fn()
    // 1) hyavk ANNANFM junction rows
    .mockImplementationOnce((cb) =>
      cb([{ leaseId: '123-456-78/1', contactKey: '_FMKEY1' }])
    )
    // 2) contact rows for the recipient
    .mockImplementationOnce((cb) =>
      cb([
        {
          contactCode: 'P004531',
          firstName: 'Faktura ',
          lastName: 'Mottagare ',
          fullName: 'Faktura Mottagare ',
          nationalRegistrationNumber: '121212121212',
          birthDate: '1212-12-12',
          street: 'Gatvägen 1 ',
          postalCode: '12345 ',
          city: null,
          emailAddress: 'noreply@mimer.nu ',
          keycmobj: '99999',
          contactKey: '_FMKEY1',
          queueName: null,
          queueTime: null,
          protectedIdentity: null,
          deceased: null,
          emigrated: null,
          noAdvertising: null,
        },
      ])
    )
    // 3) phone numbers for that contact
    .mockImplementationOnce((cb) => cb([])),
}))

describe('getOtherInvoiceRecipientsByLeaseIds', () => {
  it('groups ANNANFM recipients by leaseId', async () => {
    const result = await tenantLeaseAdapter.getOtherInvoiceRecipientsByLeaseIds([
      '123-456-78/1',
    ])

    const recipients = result.get('123-456-78/1')
    expect(recipients).toHaveLength(1)
    expect(recipients?.[0].contactCode).toBe('P004531')
    expect(recipients?.[0].fullName).toBe('Faktura Mottagare')
    expect(recipients?.[0].isTenant).toBe(false)
  })

  it('returns an empty map for no lease ids', async () => {
    const result = await tenantLeaseAdapter.getOtherInvoiceRecipientsByLeaseIds(
      []
    )
    expect(result.size).toBe(0)
  })

  it('excludes RENSAD_GDPR contacts', async () => {
    jest.resetModules()
    jest.doMock('knex', () => () => ({
      raw: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereRaw: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderByRaw: jest.fn().mockReturnThis(),
      then: jest
        .fn()
        // 1) junction rows
        .mockImplementationOnce((cb) =>
          cb([{ leaseId: '123-456-78/1', contactKey: '_GDPRKEY' }])
        )
        // 2) contact rows -> RENSAD_GDPR, must be skipped
        .mockImplementationOnce((cb) =>
          cb([
            {
              contactCode: 'RENSAD_GDPR',
              keycmobj: '99999',
              contactKey: '_GDPRKEY',
              protectedIdentity: null,
              deceased: null,
              emigrated: null,
              noAdvertising: null,
            },
          ])
        ),
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const adapter = require('../../../adapters/xpand/tenant-lease-adapter')
    const result = await adapter.getOtherInvoiceRecipientsByLeaseIds([
      '123-456-78/1',
    ])

    expect(result.size).toBe(0)
  })

  it('groups multiple recipients on the same lease', async () => {
    jest.resetModules()

    const contactRow = (code: string, key: string) => ({
      contactCode: code,
      firstName: 'Faktura ',
      lastName: 'Mottagare ',
      fullName: `Mottagare ${code} `,
      nationalRegistrationNumber: '121212121212',
      birthDate: '1212-12-12',
      street: 'Gatvägen 1 ',
      postalCode: '12345 ',
      city: null,
      emailAddress: 'noreply@mimer.nu ',
      keycmobj: '99999',
      contactKey: key,
      queueName: null,
      queueTime: null,
      protectedIdentity: null,
      deceased: null,
      emigrated: null,
      noAdvertising: null,
    })

    jest.doMock('knex', () => () => ({
      raw: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereRaw: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderByRaw: jest.fn().mockReturnThis(),
      then: jest
        .fn()
        // 1) junction rows: two recipients on the same lease
        .mockImplementationOnce((cb) =>
          cb([
            { leaseId: '123-456-78/1', contactKey: '_K1' },
            { leaseId: '123-456-78/1', contactKey: '_K2' },
          ])
        )
        // 2) contact rows for _K1
        .mockImplementationOnce((cb) => cb([contactRow('P000001', '_K1')]))
        // 3) contact rows for _K2
        .mockImplementationOnce((cb) => cb([contactRow('P000002', '_K2')]))
        // 4) phones for _K1
        .mockImplementationOnce((cb) => cb([]))
        // 5) phones for _K2
        .mockImplementationOnce((cb) => cb([])),
    }))

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const adapter = require('../../../adapters/xpand/tenant-lease-adapter')
    const result = await adapter.getOtherInvoiceRecipientsByLeaseIds([
      '123-456-78/1',
    ])

    const recipients = result.get('123-456-78/1')
    expect(recipients).toHaveLength(2)
    expect(recipients?.map((r: { contactCode: string }) => r.contactCode).sort()).toEqual([
      'P000001',
      'P000002',
    ])
  })
})
