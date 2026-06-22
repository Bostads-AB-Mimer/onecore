import { AxiosInstance } from 'axios'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { FULL_TEST_DATA_SET } from './data-set'

describe('/contacts/by-codes', () => {
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

  it('includes relatedContacts for each returned contact', async () => {
    const response = await httpClient.get('/contacts/by-codes', {
      params: { codes: 'P000555,P000333' },
    })

    expect(response.status).toBe(200)

    const byCode = Object.fromEntries(
      response.data.content.contacts.map(
        (c: { contactCode: string; relatedContacts: unknown }) => [
          c.contactCode,
          c.relatedContacts,
        ]
      )
    )

    expect(byCode['P000555']).toContainEqual({
      contactCode: 'P000444',
      role: 'administrator',
      fullName: 'McTestface Testy',
    })
    expect(byCode['P000333']).toEqual([])
  })
})
