import { logger } from '@onecore/utilities'

import * as factory from '../../test/factories'
import { lookUpContactsFailClosed } from './contact-lookup'

afterEach(jest.restoreAllMocks)

describe(lookUpContactsFailClosed, () => {
  it('looks each distinct code up once and finds it ignoring case and blanks', async () => {
    const contact = factory.domainContact.build({ contactCode: 'P100001' })
    const getByContactCodeBatch = jest
      .fn()
      .mockResolvedValue({ ok: true, data: [contact] })

    const contactFor = await lookUpContactsFailClosed(
      ['P100001', 'p100001 ', null, undefined, ''],
      { includeAddress: true },
      'test',
      { contacts: { getByContactCodeBatch } }
    )

    expect(getByContactCodeBatch).toHaveBeenCalledTimes(1)
    expect(getByContactCodeBatch).toHaveBeenCalledWith(['P100001'], {
      includeAddress: true,
    })
    expect(contactFor(' p100001')).toBe(contact)
    expect(contactFor(null)).toBeUndefined()
  })

  it('never gives a contact with a protected identity', async () => {
    const getByContactCodeBatch = jest.fn().mockResolvedValue({
      ok: true,
      data: [
        {
          ...factory.domainContact.build({ contactCode: 'P100001' }),
          protectedIdentity: true,
        },
      ],
    })

    const contactFor = await lookUpContactsFailClosed(
      ['P100001'],
      undefined,
      'test',
      { contacts: { getByContactCodeBatch } }
    )

    expect(contactFor('P100001')).toBeUndefined()
  })

  it('gives no contact at all when the lookup fails or throws, and logs it', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation()
    const failing = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, err: 'unknown', statusCode: 500 })
      .mockRejectedValueOnce(new Error('timeout'))

    for (let i = 0; i < 2; i++) {
      const contactFor = await lookUpContactsFailClosed(
        ['P100001'],
        undefined,
        'test',
        { contacts: { getByContactCodeBatch: failing } }
      )
      expect(contactFor('P100001')).toBeUndefined()
    }
    expect(errorSpy).toHaveBeenCalledTimes(2)
  })

  it('logs the codes the contacts service has no record of', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation()
    const getByContactCodeBatch = jest
      .fn()
      .mockResolvedValue({ ok: true, data: [] })

    const contactFor = await lookUpContactsFailClosed(
      ['P100002'],
      undefined,
      'test',
      { contacts: { getByContactCodeBatch } }
    )

    expect(contactFor('P100002')).toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(
      { contactCodes: ['P100002'] },
      expect.stringContaining('test')
    )
  })
})
