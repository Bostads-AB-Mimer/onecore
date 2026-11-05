import { AxiosInstance } from 'axios'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'

// P000555 has both a phone number and an email seeded, plus a förvaltare
// (P000444), so the by-phone-number and by-email-address lookups can assert
// that relatedContacts is surfaced on contacts returned by those endpoints.
describe('contact lookup by phone/email surfaces relatedContacts', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  beforeAll(async () => {
    testApp = await makeTestAppFixture({
      dataSet: FULL_TEST_DATA_SET,
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

  it('GET /contacts/by-phone-number includes relatedContacts', async () => {
    const response = await httpClient.get(
      '/contacts/by-phone-number/0738419906'
    )

    expect(response.status).toBe(200)
    const contact = response.data.content.contacts.find(
      (c: { contactCode: string }) => c.contactCode === 'P000555'
    )
    expect(contact).toBeDefined()
    expect(contact.relatedContacts).toContainEqual({
      contactCode: 'P000444',
      role: 'administrator',
      fullName: 'McTestface Testy',
      firstName: 'Testy',
      lastName: 'McTestface',
    })
  })

  it('GET /contacts/by-email-address includes relatedContacts', async () => {
    const response = await httpClient.get(
      '/contacts/by-email-address/fiktiv.personsson@test.example.se'
    )

    expect(response.status).toBe(200)
    const contact = response.data.content.contacts.find(
      (c: { contactCode: string }) => c.contactCode === 'P000555'
    )
    expect(contact).toBeDefined()
    expect(contact.relatedContacts).toContainEqual({
      contactCode: 'P000444',
      role: 'administrator',
      fullName: 'McTestface Testy',
      firstName: 'Testy',
      lastName: 'McTestface',
    })
  })
})
