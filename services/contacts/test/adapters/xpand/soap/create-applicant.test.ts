import { CreateContactInput } from '@src/adapters/contact-writer'
import { XpandSoapConfig } from '@src/common/config'
import {
  buildCreateApplicantEnvelope,
  parseCreateApplicantResponse,
} from '@src/adapters/xpand/soap/create-applicant'

const config: XpandSoapConfig = {
  url: 'https://xpand.example/Incit/Service/External/ServiceCatalogue',
  username: 'user',
  password: 'pass',
  messageCulture: '1053',
  companyCode: '001',
  timeoutMs: 30000,
}

const input = (
  overrides: Partial<CreateContactInput> = {}
): CreateContactInput => ({
  nationalId: '199007292387',
  firstName: 'Test',
  lastName: 'Testsson',
  addresses: [
    {
      street: 'Storgatan 1',
      zipCode: '72212',
      city: 'Västerås',
      country: 'Sverige',
    },
  ],
  emailAddresses: [{ emailAddress: 'test@example.com', isPrimary: true }],
  phoneNumbers: [
    { phoneNumber: '0701234567', type: 'mobile', isPrimary: true },
  ],
  credentials: {
    name: '199007292387',
    email: 'test@example.com',
    password: 'generated-secret',
  },
  ...overrides,
})

/**
 * The prefixed element names directly inside MainApplicant08352, in document
 * order. The prefix is part of what is asserted: a member in the wrong
 * namespace is silently skipped by DataContractSerializer, which is exactly
 * the failure mode that let the first live call fail — a name-only assertion
 * could not see it.
 */
const applicantFieldOrder = (xml: string): string[] => {
  const open = '<inc:MainApplicant08352>'
  const body = xml.slice(
    xml.indexOf(open) + open.length,
    xml.indexOf('</inc:MainApplicant08352>')
  )

  const names: string[] = []
  let depth = 0

  for (const [, closing, prefix, name] of body.matchAll(
    /<(\/?)([a-z]+):([A-Za-z0-9]+)>/g
  )) {
    if (closing) {
      depth -= 1
      continue
    }
    if (depth === 0) names.push(`${prefix}:${name}`)
    depth += 1
  }

  return names
}

describe('buildCreateApplicantEnvelope', () => {
  /**
   * The load-bearing test. WCF's DataContractSerializer expects members
   * base-class-first then alphabetically within each level, and answers a
   * re-ordered body with a silent validation failure. Without this assertion,
   * adding a field on the wrong line would not surface until someone tried to
   * register a real customer.
   */
  it('emits applicant fields in the order the contract requires', () => {
    expect(
      applicantFieldOrder(buildCreateApplicantEnvelope(config, input()))
    ).toEqual([
      // ContactRoleBaseDataContractOfApplicantEntity, alphabetical
      'data:Addresses',
      'data:BirthDate',
      'data:CivicNumber',
      'data:ContactCategoryCode',
      'data:ContactCode',
      'data:FirstName',
      'data:IsActive',
      'data:IsNaturalPerson',
      'data:IsPresystemLocked',
      'data:LastName',
      'data:PreferredContactMethod',
      // ApplicantDataContract
      'data:Credentials',
      // CreateApplicantDataContract08352, alphabetical
      'data:EmailAddresses',
      'data:PhoneNumbers',
    ])
  })

  it('declares the data-contract namespace and keeps wrapper members out of it', () => {
    const xml = buildCreateApplicantEnvelope(config, input())

    expect(xml).toContain('xmlns:data="http://incit.xpand.eu/data/"')
    // Wrapper members stay in the service parameter namespace.
    expect(xml).toContain('<inc:CompanyCode>')
    expect(xml).toContain('<inc:MainApplicant08352>')
    expect(xml).toContain('<inc:MessageCulture>')
    // Nothing inside the applicant may fall back to inc: — the serializer
    // would skip it silently.
    const open = '<inc:MainApplicant08352>'
    const applicant = xml.slice(
      xml.indexOf(open) + open.length,
      xml.indexOf('</inc:MainApplicant08352>')
    )
    expect(applicant).not.toContain('<inc:')
    expect(applicant).not.toContain('</inc:')
  })

  it('sends the request wrapper members in their declared order', () => {
    const xml = buildCreateApplicantEnvelope(config, input())

    expect(xml.indexOf('<inc:CompanyCode>')).toBeLessThan(
      xml.indexOf('<inc:MainApplicant08352>')
    )
    expect(xml.indexOf('</inc:MainApplicant08352>')).toBeLessThan(
      xml.indexOf('<inc:MessageCulture>')
    )
  })

  it('uses the interface-prefixed action URI from the WSDL', () => {
    expect(buildCreateApplicantEnvelope(config, input())).toContain(
      'http://incit.xpand.eu/service/ICreateApplicant08352/CreateApplicant08352'
    )
  })

  it('marks the contact as a natural person in the P category', () => {
    const xml = buildCreateApplicantEnvelope(config, input())

    expect(xml).toContain(
      '<data:ContactCategoryCode>P</data:ContactCategoryCode>'
    )
    expect(xml).toContain('<data:IsNaturalPerson>true</data:IsNaturalPerson>')
    expect(xml).toContain(
      '<data:IsPresystemLocked>false</data:IsPresystemLocked>'
    )
  })

  it('derives the birth date from the national id', () => {
    expect(buildCreateApplicantEnvelope(config, input())).toContain(
      '<data:BirthDate>1990-07-29T00:00:00</data:BirthDate>'
    )
  })

  /**
   * The service runs in a UTC container. 22:30 UTC on 2 September is already
   * 00:30 on 3 September in Stockholm, and the address must carry the Swedish
   * date — regardless of the time zone the process or the test runner is in.
   */
  it('stamps FromDate with the Swedish calendar date, not the process one', () => {
    const lateEvening = new Date('2026-09-02T22:30:00Z')
    expect(
      buildCreateApplicantEnvelope(config, input(), lateEvening)
    ).toContain('<data:FromDate>2026-09-03T00:00:00</data:FromDate>')

    const midday = new Date('2026-09-02T10:00:00Z')
    expect(buildCreateApplicantEnvelope(config, input(), midday)).toContain(
      '<data:FromDate>2026-09-02T00:00:00</data:FromDate>'
    )
  })

  /**
   * A coordination number stores its day offset by 60, so 1990-07-29 is written
   * as ...0789.... Slicing the digits produces day 89, which is not a date —
   * Xpand rejects the whole envelope, making these customers uncreatable.
   */
  it('derives the birth date of a coordination number', () => {
    expect(
      buildCreateApplicantEnvelope(
        config,
        input({ nationalId: '199007890016' })
      )
    ).toContain('<data:BirthDate>1990-07-29T00:00:00</data:BirthDate>')
  })

  /**
   * Guards against serialising local midnight through UTC, which stamps the
   * previous day for every timezone ahead of it — Sweden's included.
   */
  it('stamps FromDate with today’s local date', () => {
    const now = new Date()
    const expected = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')

    expect(buildCreateApplicantEnvelope(config, input())).toContain(
      `<data:FromDate>${expected}T00:00:00</data:FromDate>`
    )
  })

  it('uppercases city and country, as the registration flow does', () => {
    const xml = buildCreateApplicantEnvelope(config, input())

    expect(xml).toContain('<data:City>VÄSTERÅS</data:City>')
    expect(xml).toContain('<data:Country>SVERIGE</data:Country>')
  })

  it('defaults country to Sweden when none is given', () => {
    const xml = buildCreateApplicantEnvelope(
      config,
      input({
        addresses: [
          { street: 'Storgatan 1', zipCode: '72212', city: 'Västerås' },
        ],
      })
    )

    expect(xml).toContain('<data:Country>SVERIGE</data:Country>')
  })

  it('sends c/o as PostalAddress2, the registration flow convention', () => {
    const xml = buildCreateApplicantEnvelope(
      config,
      input({
        addresses: [
          {
            street: 'Storgatan 1',
            zipCode: '72212',
            city: 'Västerås',
            careOf: 'Anna Andersson',
          },
        ],
      })
    )

    expect(xml).toContain(
      '<data:PostalAddress2>Anna Andersson</data:PostalAddress2>'
    )
    // Alphabetical member order: directly after PostalAddress.
    expect(xml.indexOf('<data:PostalAddress>')).toBeLessThan(
      xml.indexOf('<data:PostalAddress2>')
    )
    expect(xml.indexOf('<data:PostalAddress2>')).toBeLessThan(
      xml.indexOf('<data:ZipCode>')
    )
  })

  it('omits PostalAddress2 entirely when no c/o is given', () => {
    expect(buildCreateApplicantEnvelope(config, input())).not.toContain(
      'PostalAddress2'
    )
  })

  it('sends both the type key and its caption for phone numbers', () => {
    const xml = buildCreateApplicantEnvelope(
      config,
      input({
        phoneNumbers: [
          { phoneNumber: '021123456', type: 'home', isPrimary: false },
          { phoneNumber: '0701234567', type: 'mobile', isPrimary: true },
        ],
      })
    )

    expect(xml).toContain('<data:PhoneTypeKey>telhem</data:PhoneTypeKey>')
    expect(xml).toContain(
      '<data:PhoneTypeCaption>Telefon (hem)</data:PhoneTypeCaption>'
    )
    expect(xml).toContain('<data:PhoneTypeKey>mobil</data:PhoneTypeKey>')
    expect(xml).toContain(
      '<data:PhoneTypeCaption>Mobiltelefon</data:PhoneTypeCaption>'
    )
  })

  it('never emits household data', () => {
    const xml = buildCreateApplicantEnvelope(config, input())

    // Household size is ONECore data, stored in the leasing application
    // profile. Xpand's legacy field is deliberately left at its default.
    expect(xml).not.toContain('NumberOfAdults')
    expect(xml).not.toContain('NumberOfChildren')
    expect(xml).not.toContain('<data:Details>')
  })

  it('escapes free text so a name with an ampersand cannot break the envelope', () => {
    const xml = buildCreateApplicantEnvelope(
      config,
      input({ lastName: 'Firma A & B <AB>' })
    )

    expect(xml).toContain(
      '<data:LastName>Firma A &amp; B &lt;AB&gt;</data:LastName>'
    )
    expect(xml).not.toContain('& B')
  })
})

describe('parseCreateApplicantResponse', () => {
  it('returns the generated contact code on success', () => {
    expect(
      parseCreateApplicantResponse({
        CreateNewEntityResult: {
          Success: true,
          ObjectDescription: 'P069077',
          Message: '',
        },
      })
    ).toEqual({ ok: true, data: { contactCode: 'P069077' } })
  })

  it('accepts Success rendered as a string', () => {
    expect(
      parseCreateApplicantResponse({
        CreateNewEntityResult: {
          Success: 'true',
          ObjectDescription: 'P069077',
        },
      })
    ).toEqual({ ok: true, data: { contactCode: 'P069077' } })
  })

  it('reports a rejection with Xpand’s own message', () => {
    const result = parseCreateApplicantResponse({
      CreateNewEntityResult: {
        Success: false,
        Message: 'Personnumret är felaktigt',
      },
    })

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      err: 'xpand-rejected',
      detail: 'Personnumret är felaktigt',
    })
  })

  /**
   * Success without a contact code means the contact exists but we cannot name
   * it. Treating it as a plain failure would invite a retry, which would either
   * duplicate the contact or be blocked by the duplicate check — so it must be
   * distinguishable, and the caller recovers the code instead.
   */
  it('treats a success without a contact code as malformed, not failed', () => {
    expect(
      parseCreateApplicantResponse({
        CreateNewEntityResult: { Success: true, ObjectDescription: '' },
      })
    ).toEqual({ ok: false, err: 'xpand-malformed-response' })
  })

  it('reports a missing result element as malformed', () => {
    expect(parseCreateApplicantResponse({})).toEqual({
      ok: false,
      err: 'xpand-malformed-response',
    })
  })
})
