import { ContactsRepository } from '@src/adapters/contact-adapter'
import { ContactWriter } from '@src/adapters/contact-writer'
import { ContactCategoryWriter } from '@src/adapters/contact-category-writer'
import {
  createContact,
  CreateContactDependencies,
  CreateContactRequest,
} from '@src/services/contacts-service/create-contact'

const VALID_NID = '199007292387'
const VALID_NID_FORMS = { twelveDigits: VALID_NID, tenDigits: '9007292387' }

const VALID_ORGANISATION_NUMBER = '5560160680'
const VALID_ORGANISATION_FORMS = {
  tenDigits: VALID_ORGANISATION_NUMBER,
  twelveDigits: `16${VALID_ORGANISATION_NUMBER}`,
}

const details = {
  addresses: [{ street: 'Storgatan 1', zipCode: '72212', city: 'Västerås' }],
  emailAddresses: [
    {
      emailAddress: 'test@example.com',
      type: 'private' as const,
      isPrimary: true,
    },
  ],
  phoneNumbers: [
    { phoneNumber: '0701234567', type: 'mobile' as const, isPrimary: true },
  ],
}

type IndividualRequest = Extract<CreateContactRequest, { type: 'individual' }>
type OrganisationRequest = Extract<
  CreateContactRequest,
  { type: 'organisation' }
>

const request = (
  overrides: Partial<IndividualRequest> = {}
): CreateContactRequest => ({
  type: 'individual',
  nationalId: VALID_NID,
  firstName: 'Test',
  lastName: 'Testsson',
  ...details,
  ...overrides,
})

const organisationRequest = (
  overrides: Partial<OrganisationRequest> = {}
): CreateContactRequest => ({
  type: 'organisation',
  organisationNumber: VALID_ORGANISATION_NUMBER,
  name: 'Testbolag Ett AB',
  category: 'F',
  ...details,
  ...overrides,
})

const repository = (
  overrides: Partial<ContactsRepository> = {}
): ContactsRepository =>
  ({
    existsByIdentityForms: jest.fn().mockResolvedValue(null),
    getByContactCode: jest.fn().mockResolvedValue(null),
    ...overrides,
  }) as unknown as ContactsRepository

const writer = (overrides: Partial<ContactWriter> = {}): ContactWriter => ({
  createContact: jest
    .fn()
    .mockResolvedValue({ ok: true, data: { contactCode: 'P069077' } }),
  ...overrides,
})

const categoryWriter = (
  overrides: Partial<ContactCategoryWriter> = {}
): ContactCategoryWriter => ({
  convertToOrganisation: jest
    .fn()
    .mockResolvedValue({ ok: true, data: { contactCode: 'F069077' } }),
  ...overrides,
})

const dependencies = (
  overrides: Partial<CreateContactDependencies> = {}
): CreateContactDependencies => ({
  contactsRepository: repository(),
  contactWriter: writer(),
  contactCategoryWriter: categoryWriter(),
  // No real backoff in unit tests.
  conversionRetry: { attempts: 3, delayMs: 0 },
  ...overrides,
})

/**
 * Repository whose identity lookup answers null for the duplicate check and
 * `recoveredCode` for the recovery lookup that follows a failed create.
 */
const recoveringRepository = (recoveredCode: string | null) =>
  repository({
    existsByIdentityForms: jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(recoveredCode),
  })

describe('createContact', () => {
  it('returns the contact code on success', async () => {
    const result = await createContact(dependencies(), request())

    expect(result).toMatchObject({
      ok: true,
      data: {
        contactCode: 'P069077',
        conversion: { status: 'not-applicable' },
      },
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
      dependencies({
        contactsRepository: repository({
          existsByIdentityForms: jest.fn().mockResolvedValue('P012345'),
        }),
        contactWriter,
      }),
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
    const existsByIdentityForms = jest.fn().mockResolvedValue('P012345')

    await createContact(
      dependencies({
        contactsRepository: repository({ existsByIdentityForms }),
      }),
      request({ nationalId: '900729-2387' })
    )

    // Normalised before lookup, so notation cannot cause a missed duplicate.
    expect(existsByIdentityForms).toHaveBeenCalledWith(VALID_NID_FORMS)
  })

  it('rejects an invalid national id', async () => {
    const contactWriter = writer()
    const result = await createContact(
      dependencies({ contactWriter }),
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

    const result = await createContact(dependencies(), request({ nationalId }))

    expect(result).toMatchObject({ ok: false, err: 'invalid-national-id' })
  })

  it('never returns the generated password', async () => {
    const result = await createContact(dependencies(), request())

    expect(JSON.stringify(result)).not.toContain('password')
  })

  it('sends the identity number as the web account username', async () => {
    const contactWriter = writer()
    await createContact(dependencies({ contactWriter }), request())

    expect(contactWriter.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        party: {
          kind: 'person',
          nationalId: VALID_NID,
          firstName: 'Test',
          lastName: 'Testsson',
        },
        credentials: expect.objectContaining({
          name: VALID_NID,
          email: 'test@example.com',
          password: expect.any(String),
        }),
      })
    )
  })

  it('never converts an individual', async () => {
    const contactCategoryWriter = categoryWriter()
    await createContact(dependencies({ contactCategoryWriter }), request())

    expect(contactCategoryWriter.convertToOrganisation).not.toHaveBeenCalled()
  })

  /**
   * A malformed response may mean the contact was created but its code was
   * unreadable. Recovering the code — through the same database lookup the
   * duplicate check uses — turns the worst failure mode into a normal success;
   * retrying would duplicate or be blocked by the duplicate check.
   */
  it('recovers the contact code after an unreadable response', async () => {
    const result = await createContact(
      dependencies({
        contactsRepository: recoveringRepository('P099999'),
        contactWriter: writer({
          createContact: jest
            .fn()
            .mockResolvedValue({ ok: false, err: 'xpand-malformed-response' }),
        }),
      }),
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
      dependencies({
        contactsRepository: recoveringRepository('P099999'),
        contactWriter: writer({
          createContact: jest
            .fn()
            .mockResolvedValue({ ok: false, err: 'xpand-unavailable' }),
        }),
      }),
      request()
    )

    expect(result).toMatchObject({ ok: true, data: { contactCode: 'P099999' } })
  })

  it('keeps the transport failure when nothing can be recovered', async () => {
    const result = await createContact(
      dependencies({
        contactsRepository: recoveringRepository(null),
        contactWriter: writer({
          createContact: jest
            .fn()
            .mockResolvedValue({ ok: false, err: 'xpand-unavailable' }),
        }),
      }),
      request()
    )

    expect(result).toMatchObject({ ok: false, err: 'xpand-unavailable' })
  })

  it('does not attempt recovery when the request was rejected', async () => {
    const existsByIdentityForms = jest.fn().mockResolvedValue(null)

    const result = await createContact(
      dependencies({
        contactsRepository: repository({ existsByIdentityForms }),
        contactWriter: writer({
          createContact: jest.fn().mockResolvedValue({
            ok: false,
            err: 'xpand-rejected',
            detail: 'Personnumret är felaktigt',
          }),
        }),
      }),
      request()
    )

    // Nothing was created, so there is nothing to recover — and looking would
    // risk adopting an unrelated contact that happens to share the number. The
    // single call is the duplicate check that precedes the write.
    expect(existsByIdentityForms).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ ok: false, err: 'xpand-rejected' })
  })

  it('still succeeds when reading the contact back fails', async () => {
    const result = await createContact(
      dependencies({
        contactsRepository: repository({
          getByContactCode: jest.fn().mockRejectedValue(new Error('db down')),
        }),
      }),
      request()
    )

    expect(result).toMatchObject({
      ok: true,
      data: { contactCode: 'P069077', contact: null },
    })
  })
})

describe('createContact for an organisation', () => {
  it('creates the contact as a person, converts it and returns the converted code', async () => {
    const contactWriter = writer()
    const contactCategoryWriter = categoryWriter()

    const result = await createContact(
      dependencies({ contactWriter, contactCategoryWriter }),
      organisationRequest()
    )

    expect(contactWriter.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        party: {
          kind: 'organisation',
          organisationNumber: VALID_ORGANISATION_NUMBER,
          name: 'Testbolag Ett AB',
        },
      })
    )
    expect(contactCategoryWriter.convertToOrganisation).toHaveBeenCalledWith({
      contactCode: 'P069077',
      category: 'F',
      name: 'Testbolag Ett AB',
    })
    expect(result).toMatchObject({
      ok: true,
      data: { contactCode: 'F069077', conversion: { status: 'done' } },
    })
  })

  it('reads the contact back under its converted code', async () => {
    const getByContactCode = jest.fn().mockResolvedValue(null)

    await createContact(
      dependencies({ contactsRepository: repository({ getByContactCode }) }),
      organisationRequest()
    )

    expect(getByContactCode).toHaveBeenCalledWith('F069077')
  })

  it('passes the requested category through', async () => {
    const contactCategoryWriter = categoryWriter({
      convertToOrganisation: jest
        .fn()
        .mockResolvedValue({ ok: true, data: { contactCode: 'K069077' } }),
    })

    const result = await createContact(
      dependencies({ contactCategoryWriter }),
      organisationRequest({ category: 'K', name: 'Västerås stad' })
    )

    expect(contactCategoryWriter.convertToOrganisation).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'K', name: 'Västerås stad' })
    )
    expect(result).toMatchObject({ ok: true, data: { contactCode: 'K069077' } })
  })

  /**
   * Decision: every organisation gets a web account, and its username is the
   * organisation number — the ten-digit form the organisation knows itself by.
   */
  it('uses the organisation number as the web account username', async () => {
    const contactWriter = writer()

    await createContact(
      dependencies({ contactWriter }),
      organisationRequest({ organisationNumber: '556016-0680' })
    )

    expect(contactWriter.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: expect.objectContaining({
          name: VALID_ORGANISATION_NUMBER,
        }),
      })
    )
  })

  it('rejects an invalid organisation number', async () => {
    const contactWriter = writer()

    const result = await createContact(
      dependencies({ contactWriter }),
      organisationRequest({ organisationNumber: '5560160681' })
    )

    expect(result).toMatchObject({
      ok: false,
      err: 'invalid-organisation-number',
    })
    expect(contactWriter.createContact).not.toHaveBeenCalled()
  })

  /**
   * A personal identity number is checksum-valid too. Accepting it here would
   * register a person as an organisation, with the name split cleared.
   */
  it('rejects a personal identity number given as an organisation number', async () => {
    const result = await createContact(
      dependencies(),
      organisationRequest({ organisationNumber: VALID_NID })
    )

    expect(result).toMatchObject({
      ok: false,
      err: 'invalid-organisation-number',
    })
  })

  it('refuses a duplicate organisation number without calling the writer', async () => {
    const existsByIdentityForms = jest.fn().mockResolvedValue('F012345')
    const contactWriter = writer()

    const result = await createContact(
      dependencies({
        contactsRepository: repository({ existsByIdentityForms }),
        contactWriter,
      }),
      organisationRequest({ organisationNumber: '556016-0680' })
    )

    expect(existsByIdentityForms).toHaveBeenCalledWith(VALID_ORGANISATION_FORMS)
    expect(result).toEqual({
      ok: false,
      err: 'duplicate-contact',
      detail: 'F012345',
    })
    expect(contactWriter.createContact).not.toHaveBeenCalled()
  })

  /**
   * The contact exists from the moment the create succeeds. A conversion that
   * keeps failing must therefore still be reported as a success, with the
   * person code and the failure spelled out — an error would invite a retry
   * that the duplicate check blocks.
   */
  it('returns the person code with a failed conversion after exhausting retries', async () => {
    const convertToOrganisation = jest
      .fn()
      .mockResolvedValue({ ok: false, err: 'xpand-db-error' })

    const result = await createContact(
      dependencies({
        contactCategoryWriter: categoryWriter({ convertToOrganisation }),
      }),
      organisationRequest()
    )

    expect(convertToOrganisation).toHaveBeenCalledTimes(3)
    expect(result).toEqual({
      ok: true,
      data: {
        contactCode: 'P069077',
        contact: null,
        conversion: { status: 'failed', error: 'xpand-db-error' },
      },
    })
  })

  it('succeeds when a retry of the conversion goes through', async () => {
    const convertToOrganisation = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, err: 'xpand-db-error' })
      .mockResolvedValueOnce({ ok: true, data: { contactCode: 'F069077' } })

    const result = await createContact(
      dependencies({
        contactCategoryWriter: categoryWriter({ convertToOrganisation }),
      }),
      organisationRequest()
    )

    expect(convertToOrganisation).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      ok: true,
      data: { contactCode: 'F069077', conversion: { status: 'done' } },
    })
  })

  /**
   * Only a database failure can come out differently on retry; the other
   * answers are deterministic and retrying them only delays the caseworker.
   */
  it.each(['unsupported-category', 'contact-not-found'])(
    'does not retry a %s answer',
    async (err) => {
      const convertToOrganisation = jest
        .fn()
        .mockResolvedValue({ ok: false, err })

      const result = await createContact(
        dependencies({
          contactCategoryWriter: categoryWriter({ convertToOrganisation }),
        }),
        organisationRequest()
      )

      expect(convertToOrganisation).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({
        ok: true,
        data: {
          contactCode: 'P069077',
          conversion: { status: 'failed', error: err },
        },
      })
    }
  )

  it('treats an already converted contact as done', async () => {
    const convertToOrganisation = jest
      .fn()
      .mockResolvedValue({ ok: false, err: 'already-converted' })

    const result = await createContact(
      dependencies({
        contactCategoryWriter: categoryWriter({ convertToOrganisation }),
      }),
      organisationRequest()
    )

    expect(convertToOrganisation).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ok: true,
      data: { contactCode: 'F069077', conversion: { status: 'done' } },
    })
  })

  /**
   * Recovery after an ambiguous failure finds the contact under its person
   * code, exactly as a clean create would have returned it — so the same
   * conversion follows.
   */
  it('converts a contact recovered under its person code', async () => {
    const contactCategoryWriter = categoryWriter({
      convertToOrganisation: jest
        .fn()
        .mockResolvedValue({ ok: true, data: { contactCode: 'F099999' } }),
    })

    const result = await createContact(
      dependencies({
        contactsRepository: recoveringRepository('P099999'),
        contactWriter: writer({
          createContact: jest
            .fn()
            .mockResolvedValue({ ok: false, err: 'xpand-unavailable' }),
        }),
        contactCategoryWriter,
      }),
      organisationRequest()
    )

    expect(contactCategoryWriter.convertToOrganisation).toHaveBeenCalledWith(
      expect.objectContaining({ contactCode: 'P099999' })
    )
    expect(result).toMatchObject({
      ok: true,
      data: { contactCode: 'F099999', conversion: { status: 'done' } },
    })
  })

  it('does not convert a contact recovered under an organisation code', async () => {
    const contactCategoryWriter = categoryWriter()

    const result = await createContact(
      dependencies({
        contactsRepository: recoveringRepository('F099999'),
        contactWriter: writer({
          createContact: jest
            .fn()
            .mockResolvedValue({ ok: false, err: 'xpand-malformed-response' }),
        }),
        contactCategoryWriter,
      }),
      organisationRequest()
    )

    expect(contactCategoryWriter.convertToOrganisation).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      ok: true,
      data: { contactCode: 'F099999', conversion: { status: 'done' } },
    })
  })
})
