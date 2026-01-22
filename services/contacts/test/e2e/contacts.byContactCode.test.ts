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
    it('should fetch P184660, who has 1 of each contact detail type', async () => {
      // When
      const response = await httpClient.get('/contacts/P184660')

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
        contactCode: 'P184660',
        contactKey: '_6QB0ZX3T658SQP',
        type: 'individual',
        personal: {
          birthDate: '1988-02-03T01:00:00.000Z',
          firstName: 'Bellatrix',
          fullName: 'Julaftonsson Bellatrix',
          lastName: 'Julaftonsson',
          nationalRegistrationNumber: '810218877181',
        },
        communication: {
          emailAddresses: [
            {
              emailAddress: 'ola@korv.mock-domain.se',
              isPrimary: true,
              type: 'unspecified',
            },
          ],
          phoneNumbers: [
            {
              phoneNumber: '0737948111',
              isPrimary: false,
              type: 'unspecified',
            },
          ],
          specialAttention: false,
        },
        addresses: [
          {
            city: 'STOCKHOLM',
            country: 'SVERIGE',
            full: 'Kängurutorp 34D, 11667, STOCKHOLM, SVERIGE',
            region: 'SE',
            street: 'Kängurutorp 34D',
            zipCode: '11667',
          },
        ],
      })
    })
  })
})
