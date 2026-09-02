import { ContactsRepository } from '@src/adapters/contact-adapter'
import { ContactWriter } from '@src/adapters/contact-writer'
import {
  createContact,
  CreateContactRequest,
} from '@src/services/contacts-service/create-contact'

const VALID_NID = '199007292387'

const request = (
  overrides: Partial<CreateContactRequest> = {}
): CreateContactRequest => ({
  nationalId: VALID_NID,
  firstName: 'Test',
  lastName: 'Testsson',
  addresses: [{ street: 'Storgatan 1', zipCode: '72212', city: 'Västerås' }],
  emailAddresses: [
    { emailAddress: 'test@example.com', type: 'private', isPrimary: true },
  ],
  phoneNumbers: [
    { phoneNumber: '0701234567', type: 'mobile', isPrimary: true },
  ],
  ...overrides,
})

const repository = (
  overrides: Partial<ContactsRepository> = {}
): ContactsRepository =>
  ({
    existsByNationalIdNumber: jest.fn().mockResolvedValue(null),
    getByContactCode: jest.fn().mockResolvedValue(null),
    ...overrides,
  }) as unknown as ContactsRepository

const writer = (overrides: Partial<ContactWriter> = {}): ContactWriter => ({
  createContact: jest
    .fn()
    .mockResolvedValue({ ok: true, data: { contactCode: 'P069077' } }),
  findContactCodeByNationalId: jest
    .fn()
    .mockResolvedValue({ ok: true, data: { contactCode: null } }),
  ...overrides,
})

describe('createContact', () => {
  it('returns the contact code on success', async () => {
    const result = await createContact(
      { contactsRepository: repository(), contactWriter: writer() },
      request()
    )

    expect(result).toMatchObject({
      ok: true,
      data: { contactCode: 'P069077' },
    })
  })

  /**
   * The load-bearing safety check. Creating a contact cannot be undone, the
   * upstream system does not reject duplicates itself, and ~4 400 duplicated
   * identity numbers already exist in the data.
   */
  it('refuses a duplicate without ever calling the writer', async () => {
    const contactWriter = writer()
    const result = await createContact(
      {
        contactsRepository: repository({
          existsByNationalIdNumber: jest.fn().mockResolvedValue('P012345'),
        }),
        contactWriter,
      },
      request()
    )

    expect(result).toEqual({
      ok: false,
      err: 'duplicate-contact',
      detail: 'P012345',
    })
    expect(contactWriter.createContact).not.toHaveBeenCalled()
  })

  it('matches an existing contact stored in ten-digit form', async () => {
    const existsByNationalIdNumber = jest.fn().mockResolvedValue('P012345')

    await createContact(
      {
        contactsRepository: repository({ existsByNationalIdNumber }),
        contactWriter: writer(),
      },
      request({ nationalId: '900729-2387' })
    )

    // Normalised before lookup, so notation cannot cause a missed duplicate.
    expect(existsByNationalIdNumber).toHaveBeenCalledWith(VALID_NID)
  })

  it('rejects an invalid national id', async () => {
    const contactWriter = writer()
    const result = await createContact(
      { contactsRepository: repository(), contactWriter },
      request({ nationalId: '199007292388' })
    )

    expect(result).toMatchObject({ ok: false, err: 'invalid-national-id' })
    expect(contactWriter.createContact).not.toHaveBeenCalled()
  })

  it('rejects someone under sixteen', async () => {
    const thisYear = new Date().getFullYear()
    // Build a checksum-valid number for a child born five years ago.
    const young = `${thisYear - 5}0101`
    const nine = young.slice(2) + '123'
    let sum = 0
    for (let i = 0; i < 9; i++) {
      let d = Number(nine[i]) * (i % 2 === 0 ? 2 : 1)
      if (d > 9) d -= 9
      sum += d
    }
    const nationalId = `${young}123${(10 - (sum % 10)) % 10}`

    const result = await createContact(
      { contactsRepository: repository(), contactWriter: writer() },
      request({ nationalId })
    )

    expect(result).toMatchObject({ ok: false, err: 'invalid-national-id' })
  })

  it('never returns the generated password', async () => {
    const result = await createContact(
      { contactsRepository: repository(), contactWriter: writer() },
      request()
    )

    expect(JSON.stringify(result)).not.toContain('password')
  })

  it('sends the identity number as the web account username', async () => {
    const contactWriter = writer()
    await createContact(
      { contactsRepository: repository(), contactWriter },
      request()
    )

    expect(contactWriter.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: expect.objectContaining({
          name: VALID_NID,
          email: 'test@example.com',
          password: expect.any(String),
        }),
      })
    )
  })

  /**
   * A malformed response may mean the contact was created but its code was
   * unreadable. Recovering the code turns the worst failure mode into a normal
   * success; retrying would duplicate or be blocked by the duplicate check.
   */
  it('recovers the contact code after an unreadable response', async () => {
    const result = await createContact(
      {
        contactsRepository: repository(),
        contactWriter: writer({
          createContact: jest
            .fn()
            .mockResolvedValue({ ok: false, err: 'xpand-malformed-response' }),
          findContactCodeByNationalId: jest
            .fn()
            .mockResolvedValue({ ok: true, data: { contactCode: 'P099999' } }),
        }),
      },
      request()
    )

    expect(result).toMatchObject({ ok: true, data: { contactCode: 'P099999' } })
  })

  /**
   * A timeout may strike after Xpand has committed the write, so a transport
   * failure is as ambiguous as an unreadable response and gets the same
   * recovery. When nothing is found, the original failure stands.
   */
  it('recovers the contact code after a transport failure', async () => {
    const result = await createContact(
      {
        contactsRepository: repository(),
        contactWriter: writer({
          createContact: jest
            .fn()
            .mockResolvedValue({ ok: false, err: 'xpand-unavailable' }),
          findContactCodeByNationalId: jest
            .fn()
            .mockResolvedValue({ ok: true, data: { contactCode: 'P099999' } }),
        }),
      },
      request()
    )

    expect(result).toMatchObject({ ok: true, data: { contactCode: 'P099999' } })
  })

  it('keeps the transport failure when nothing can be recovered', async () => {
    const result = await createContact(
      {
        contactsRepository: repository(),
        contactWriter: writer({
          createContact: jest
            .fn()
            .mockResolvedValue({ ok: false, err: 'xpand-unavailable' }),
          findContactCodeByNationalId: jest
            .fn()
            .mockResolvedValue({ ok: true, data: { contactCode: null } }),
        }),
      },
      request()
    )

    expect(result).toMatchObject({ ok: false, err: 'xpand-unavailable' })
  })

  it('does not attempt recovery when the request was rejected', async () => {
    const findContactCodeByNationalId = jest.fn()

    const result = await createContact(
      {
        contactsRepository: repository(),
        contactWriter: writer({
          createContact: jest.fn().mockResolvedValue({
            ok: false,
            err: 'xpand-rejected',
            detail: 'Personnumret är felaktigt',
          }),
          findContactCodeByNationalId,
        }),
      },
      request()
    )

    // Nothing was created, so there is nothing to recover — and looking would
    // risk adopting an unrelated contact that happens to share the number.
    expect(findContactCodeByNationalId).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: false, err: 'xpand-rejected' })
  })

  it('still succeeds when reading the contact back fails', async () => {
    const result = await createContact(
      {
        contactsRepository: repository({
          getByContactCode: jest.fn().mockRejectedValue(new Error('db down')),
        }),
        contactWriter: writer(),
      },
      request()
    )

    expect(result).toMatchObject({
      ok: true,
      data: { contactCode: 'P069077', contact: null },
    })
  })
})
