import { leasing, LeaseStatus } from '@onecore/types'
import { logger } from '@onecore/utilities'
import type { ContactOrganisation } from '@onecore/contacts/domain'

import { contactsAdapter } from '../../../adapters/contacts-adapter'
import * as factory from '../../../../test/factories'
import {
  toHomeInsuranceContactFields,
  toLeasingHomeInsuranceQuery,
  withHomeInsuranceContacts,
} from '../helpers/home-insurance'
import { HomeInsuranceListQuerySchema } from '../schemas/home-insurance'

const buildItem = (
  overrides: Partial<leasing.HomeInsuranceListItem> = {}
): leasing.HomeInsuranceListItem => ({
  leaseId: '705-001-01-0101/1',
  leaseStatus: 'G',
  leaseStage: LeaseStatus.Current,
  leaseFromDate: '2024-01-01',
  leaseToDate: null,
  rentalObjectCode: '705-001-01-0101',
  numberOfRooms: 2,
  squareMeters: 55,
  address: 'Testgatan 1',
  postalCode: '72216',
  city: 'Västerås',
  rowId: 'row-1',
  rowFromDate: '2024-01-01',
  rowToDate: null,
  monthlyAmount: 80,
  articleText: 'Hemförsäkring',
  contactCode: 'P100001',
  isCompany: false,
  ...overrides,
})

const individual = (contactCode: string) =>
  factory.domainContact.build({
    contactCode,
    communication: {
      phoneNumbers: [
        { phoneNumber: '0700000001', type: 'mobile', isPrimary: false },
        { phoneNumber: '0700000002', type: 'mobile', isPrimary: true },
      ],
      emailAddresses: [
        { emailAddress: 'knut@example.com', type: 'private', isPrimary: true },
      ],
      specialAttention: false,
    },
  })

const blank = {
  fullName: null,
  nationalIdNumber: null,
  phoneNumber: null,
  email: null,
}

afterEach(jest.restoreAllMocks)

describe(toHomeInsuranceContactFields, () => {
  it('takes the name, personnummer and primary phone and email', () => {
    expect(toHomeInsuranceContactFields(individual('P1'))).toEqual({
      fullName: 'Kansen, Knut',
      nationalIdNumber: '199001011234',
      phoneNumber: '0700000002',
      email: 'knut@example.com',
    })
  })

  it('blanks all four fields for a protected identity', () => {
    const contact = { ...individual('P1'), protectedIdentity: true }
    expect(toHomeInsuranceContactFields(contact)).toEqual(blank)
  })

  it('blanks all four fields for a missing contact', () => {
    expect(toHomeInsuranceContactFields(undefined)).toEqual(blank)
  })

  it('takes the name and organisation number of a company', () => {
    const company: ContactOrganisation = {
      type: 'organisation',
      contactCode: 'F1',
      contactKey: 'k-f1',
      protectedIdentity: false,
      organisation: { name: 'Bolaget AB', organisationNumber: '5560000000' },
      communication: {
        phoneNumbers: [],
        emailAddresses: [],
        specialAttention: false,
      },
      addresses: [],
    }
    expect(toHomeInsuranceContactFields(company)).toEqual({
      fullName: 'Bolaget AB',
      nationalIdNumber: '5560000000',
      phoneNumber: null,
      email: null,
    })
  })
})

describe(withHomeInsuranceContacts, () => {
  it('fills in the fields with the phone and email asked for', async () => {
    const getByContactCodeBatch = jest
      .fn()
      .mockResolvedValue({ ok: true, data: [individual('P100001')] })

    const result = await withHomeInsuranceContacts([buildItem()], {
      contacts: { getByContactCodeBatch },
    })

    expect(getByContactCodeBatch).toHaveBeenCalledWith(['P100001'], {
      includePhone: true,
      includeEmail: true,
    })
    expect(result[0]).toMatchObject({
      rowId: 'row-1',
      fullName: 'Kansen, Knut',
      email: 'knut@example.com',
    })
  })

  it('blanks every row when the contacts service fails', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation()
    const getByContactCodeBatch = jest
      .fn()
      .mockResolvedValue({ ok: false, err: 'unknown', statusCode: 500 })

    const result = await withHomeInsuranceContacts([buildItem()], {
      contacts: { getByContactCodeBatch },
    })

    expect(result[0]).toMatchObject(blank)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})

describe(toLeasingHomeInsuranceQuery, () => {
  const parse = (query: Record<string, string>) =>
    HomeInsuranceListQuerySchema.parse(query)

  it('sends other text as q, without contactCodes', async () => {
    const lookup = jest.spyOn(contactsAdapter, 'getByNationalId')

    const result = await toLeasingHomeInsuranceQuery(
      parse({ q: ' Testgatan ' })
    )

    expect(lookup).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      query: expect.objectContaining({ q: 'Testgatan' }),
    })
    expect(result.ok && result.query.contactCodes).toBeUndefined()
  })

  it('sends an empty contactCodes for a personnummer with no contact', async () => {
    jest
      .spyOn(contactsAdapter, 'getByNationalId')
      .mockResolvedValue({ ok: false, err: 'not-found', statusCode: 404 })

    const result = await toLeasingHomeInsuranceQuery(
      parse({ q: '199001011234' })
    )

    expect(result).toEqual({
      ok: true,
      query: expect.objectContaining({ q: undefined, contactCodes: [] }),
    })
  })
})
