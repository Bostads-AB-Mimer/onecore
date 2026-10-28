import { AxiosInstance } from 'axios'
import { connect, makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'
import { ContactIndividualSchema } from '@src/services/contacts-service/schema'

describe('/contacts/:contactCode', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  const DATA_SET = FULL_TEST_DATA_SET

  beforeAll(async () => {
    testApp = await makeTestAppFixture({
      dataSet: DATA_SET,
    })
    await testApp.start()
    httpClient = testApp.makeClient()
  })

  afterAll(async () => {
    if (testApp) {
      await testApp.stop()
      testApp = undefined
    }
  })

  describe('Individual', () => {
    it('should fetch P000333, who has 1 of each contact detail type', async () => {
      // When
      const response = await httpClient.get('/contacts/P000333')

      // Then
      expect(response.data).toEqual({
        _links: {
          self: expect.any(Object),
          link: expect.any(Object),
        },
        content: expect.any(Object),
      })

      const parseResult = ContactIndividualSchema.safeParse(
        response.data.content
      )
      if (!parseResult.success) {
        console.error('Does not match schema', response.data.content)
        console.dir(parseResult.error, { depth: null })
      }
      expect(parseResult.success).toBe(true)

      expect(parseResult.data).toEqual({
        contactCode: 'P000333',
        contactKey: '_0J4157CCC',
        type: 'individual',
        protectedIdentity: false,
        personal: {
          birthDate: null,
          firstName: '',
          lastName: '',
          fullName: 'Fiktivsson Exempel',
          nationalId: null,
        },
        relatedContacts: [],
        communication: {
          emailAddresses: [],
          phoneNumbers: [
            {
              phoneNumber: 'redacted',
              isPrimary: false,
              type: 'unspecified',
            },
          ],
          specialAttention: false,
        },
        addresses: [
          {
            city: 'Västerås',
            country: '',
            full: 'Exempelvägen 79 A, 722 99, Västerås',
            region: 'SE',
            street: 'Exempelvägen 79 A',
            zipCode: '722 99',
          },
        ],
      })
    })
  })

  describe('relatedContacts', () => {
    it('includes the förvaltare on a contact that has one', async () => {
      const response = await httpClient.get('/contacts/P000555')

      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toContainEqual({
        contactCode: 'P000444',
        role: 'administrator',
        fullName: 'McTestface Testy',
        firstName: 'Testy',
        lastName: 'McTestface',
      })
    })

    it('is an empty array for a contact with no guardian relations', async () => {
      const response = await httpClient.get('/contacts/P000333')

      expect(response.status).toBe(200)
      expect(response.data.content.relatedContacts).toEqual([])
    })
  })

  describe('protected identity', () => {
    // Lease fixtures for P000999 (protected, no relations) are added per test
    // and removed again, so the seeded data set stays untouched.
    const LEASE_KEY = '_OBJPROT001    '
    const RELATION_KEY = '_AVKPROT001    '
    const DAY_MS = 24 * 60 * 60 * 1000

    const addLease = async (
      contactCode: string,
      { fdate, tdate }: { fdate: Date; tdate: Date | null }
    ) => {
      const pool = await connect()
      try {
        await pool
          .request()
          .input('leaseKey', LEASE_KEY)
          .input('relationKey', RELATION_KEY)
          .input('contactCode', contactCode)
          .input('fdate', fdate)
          .input('tdate', tdate).query(`
            INSERT INTO hyobj (keyhyobj, hyobjben, sistadeb) VALUES (@leaseKey, 'PROT-1', NULL);
            INSERT INTO hyavk (keyhyavk, keyhyobj, keycmctc, keyhyakt, fdate, tdate)
            SELECT @relationKey, @leaseKey, keycmctc, 'INNEHAVARE', @fdate, @tdate
            FROM cmctc WHERE cmctckod = @contactCode;
          `)
      } finally {
        await pool.close()
      }
    }

    afterEach(async () => {
      const pool = await connect()
      try {
        await pool
          .request()
          .input('leaseKey', LEASE_KEY)
          .input('relationKey', RELATION_KEY).query(`
            DELETE FROM hyavk WHERE keyhyavk = @relationKey;
            DELETE FROM hyobj WHERE keyhyobj = @leaseKey;
          `)
      } finally {
        await pool.close()
      }
    })

    const fetchContact = async (contactCode: string) => {
      const response = await httpClient.get(`/contacts/${contactCode}`)
      expect(response.status).toBe(200)
      return response.data.content
    }

    it('redacts a protected identity that is neither tenant nor invoice recipient', async () => {
      const contact = await fetchContact('P000999')

      expect(contact.protectedIdentity).toBe(true)
      expect(contact.personal.fullName).toBe('redacted')
      expect(contact.personal.nationalId).toBe('redacted')
      expect(contact.addresses).toEqual([])
    })

    it('does not redact a protected annan fakturamottagare', async () => {
      // P000888 is the recipient on an active annan_fakturamottagare relation.
      const contact = await fetchContact('P000888')

      expect(contact.protectedIdentity).toBe(true)
      expect(contact.personal.fullName).toBe('Testovic Faksimilo')
    })

    it('does not redact a protected tenant on a current lease', async () => {
      await addLease('P000999', { fdate: new Date('2020-01-01'), tdate: null })

      const contact = await fetchContact('P000999')

      expect(contact.protectedIdentity).toBe(true)
      expect(contact.personal.fullName).toBe('Hittepåberg Mollgan')
    })

    it('does not redact a protected tenant on an upcoming lease', async () => {
      await addLease('P000999', {
        fdate: new Date(Date.now() + 30 * DAY_MS),
        tdate: null,
      })

      const contact = await fetchContact('P000999')

      expect(contact.personal.fullName).toBe('Hittepåberg Mollgan')
    })

    it('does not redact a protected tenant whose lease ended within 60 days', async () => {
      await addLease('P000999', {
        fdate: new Date('2020-01-01'),
        tdate: new Date(Date.now() - 30 * DAY_MS),
      })

      const contact = await fetchContact('P000999')

      expect(contact.personal.fullName).toBe('Hittepåberg Mollgan')
    })

    it('redacts a protected former tenant whose lease ended over 60 days ago', async () => {
      await addLease('P000999', {
        fdate: new Date('2020-01-01'),
        tdate: new Date(Date.now() - 90 * DAY_MS),
      })

      const contact = await fetchContact('P000999')

      expect(contact.protectedIdentity).toBe(true)
      expect(contact.personal.fullName).toBe('redacted')
    })
  })
})
