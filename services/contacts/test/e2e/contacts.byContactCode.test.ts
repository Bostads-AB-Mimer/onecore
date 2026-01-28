import { AxiosInstance } from 'axios'
import { makeTestAppFixture, TestApp } from './app-fixture'
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
        personal: {
          birthDate: null,
          firstName: '',
          lastName: '',
          fullName: 'Fiktivsson Exempel',
          nationalId: null,
        },
        communication: {
          emailAddresses: [],
          phoneNumbers: [
            {
              phoneNumber: '199574  84',
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
})
