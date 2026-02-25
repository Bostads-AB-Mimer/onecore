import { AxiosInstance } from 'axios'
import { makeTestAppFixture, TestApp } from './app-fixture'
import { filterDataSet, FULL_TEST_DATA_SET } from './data-set'

describe('/contacts', () => {
  let testApp: TestApp | undefined
  let httpClient: AxiosInstance

  // Slice of full data set containing a subset with a known uneven length,
  // so pagination tests can test end-of-set page without being sensitive
  // to if and when the full test set grows in size.
  const DATA_SET = FULL_TEST_DATA_SET.slice(0, 16)
  const INDIVIDUAL_SET = filterDataSet(DATA_SET, { type: 'individual' })
  const ORGANISATION_SET = filterDataSet(DATA_SET, { type: 'organisation' })

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

  describe('No parameters', () => {
    it('should fetch a page(size=10) of contacts when no query parameters are provided', async () => {
      // When
      const response = await httpClient.get('/contacts/')

      // Then
      expect(response.data).toEqual({
        _links: {
          self: expect.any(Object),
          link: expect.any(Object),
        },
        content: {
          contacts: expect.any(Array),
        },
      })

      const { contacts } = response.data.content

      expect(contacts.map((c: any) => c.contactCode)).toEqual(
        DATA_SET.slice(0, 10)
      )
    })
  })

  describe('Pagination', () => {
    describe('No filter', () => {
      it.each([
        {
          page: 0,
          pageSize: 5,
          expectedContactCodes: DATA_SET.slice(0, 5),
        },
        {
          page: 2,
          pageSize: 5,
          expectedContactCodes: DATA_SET.slice(10, 15),
        },
        {
          page: 4,
          pageSize: 5,
          expectedContactCodes: DATA_SET.slice(20, 25),
        },
        {
          page: 0,
          pageSize: 10,
          expectedContactCodes: DATA_SET.slice(0, 10),
        },
        {
          page: 1,
          pageSize: 10,
          expectedContactCodes: DATA_SET.slice(10, 20),
        },
        {
          page: 0,
          pageSize: 20,
          expectedContactCodes: DATA_SET.slice(0, 20),
        },
        {
          page: 1,
          pageSize: 20,
          expectedContactCodes: DATA_SET.slice(20, 40),
        },
        {
          page: 2,
          pageSize: 20,
          expectedContactCodes: DATA_SET.slice(40, 43),
        },
        {
          page: 0,
          pageSize: 100,
          expectedContactCodes: DATA_SET,
        },
      ])(
        'should fetch page $page of size $pageSize',
        async ({ page, pageSize, expectedContactCodes }) => {
          // When
          const queryString = [
            typeof page === 'number' ? `page=${page}` : null,
            typeof pageSize === 'number' ? `pageSize=${pageSize}` : null,
          ]
            .filter(Boolean)
            .join('&')
          const response = await httpClient.get(
            '/contacts' + (queryString.length ? `?${queryString}` : '')
          )

          // Then
          const { contacts } = response.data.content

          expect(contacts.map((c: any) => c.contactCode)).toEqual(
            expectedContactCodes
          )
        }
      )
    })

    describe('with type=individual', () => {
      it.each([
        {
          page: 0,
          pageSize: 5,
          expectedContactCodes: INDIVIDUAL_SET.slice(0, 5),
          resultSize: 5,
        },
        {
          page: 1,
          pageSize: 5,
          expectedContactCodes: INDIVIDUAL_SET.slice(5, 10),
          resultSize: 5,
        },
        {
          page: 2,
          pageSize: 5,
          expectedContactCodes: INDIVIDUAL_SET.slice(10, 15),
          resultSize: 1,
        },
        {
          page: 4,
          pageSize: 5,
          expectedContactCodes: INDIVIDUAL_SET.slice(20, 25),
          resultSize: 0,
        },
        {
          page: 0,
          pageSize: 10,
          expectedContactCodes: INDIVIDUAL_SET.slice(0, 10),
          resultSize: 10,
        },
        {
          page: 1,
          pageSize: 10,
          expectedContactCodes: INDIVIDUAL_SET.slice(10, 20),
          resultSize: 1,
        },
        {
          page: 0,
          pageSize: 20,
          expectedContactCodes: INDIVIDUAL_SET.slice(0, 20),
          resultSize: 11,
        },
        {
          page: 1,
          pageSize: 20,
          expectedContactCodes: INDIVIDUAL_SET.slice(20, 40),
          resultSize: 0,
        },
        {
          page: 2,
          pageSize: 20,
          expectedContactCodes: INDIVIDUAL_SET.slice(40, 43),
          resultSize: 0,
        },
        {
          page: 0,
          pageSize: 100,
          expectedContactCodes: INDIVIDUAL_SET,
          resultSize: 11,
        },
      ])(
        'should fetch page $page of size $pageSize containing individuals only',
        async ({ page, pageSize, expectedContactCodes, resultSize }) => {
          // When
          const response = await httpClient.get('/contacts', {
            params: {
              page,
              pageSize,
              type: 'individual',
            },
          })

          // Then
          const { contacts } = response.data.content

          expect(
            contacts.map((c: any) => ({
              contactCode: c.contactCode,
              type: c.type,
            }))
          ).toEqual(
            expectedContactCodes.map((cc) => ({
              contactCode: cc,
              type: 'individual',
            }))
          )
          expect(contacts.length).toEqual(resultSize)
        }
      )
    })

    describe('with type=organisation', () => {
      it.each([
        {
          page: 0,
          pageSize: 5,
          expectedContactCodes: ORGANISATION_SET.slice(0, 5),
          resultSize: 4,
        },
        {
          page: 2,
          pageSize: 5,
          expectedContactCodes: ORGANISATION_SET.slice(10, 15),
          resultSize: 0,
        },
        {
          page: 4,
          pageSize: 5,
          expectedContactCodes: ORGANISATION_SET.slice(20, 25),
          resultSize: 0,
        },
        {
          page: 0,
          pageSize: 10,
          expectedContactCodes: ORGANISATION_SET.slice(0, 10),
          resultSize: 4,
        },
        {
          page: 1,
          pageSize: 10,
          expectedContactCodes: ORGANISATION_SET.slice(10, 15),
          resultSize: 0,
        },
        {
          page: 0,
          pageSize: 20,
          expectedContactCodes: ORGANISATION_SET.slice(0, 15),
          resultSize: 4,
        },
        {
          page: 1,
          pageSize: 20,
          expectedContactCodes: ORGANISATION_SET.slice(20, 40),
          resultSize: 0,
        },
        {
          page: 2,
          pageSize: 20,
          expectedContactCodes: ORGANISATION_SET.slice(40, 43),
          resultSize: 0,
        },
        {
          page: 0,
          pageSize: 100,
          expectedContactCodes: ORGANISATION_SET,
          resultSize: 4,
        },
      ])(
        'should fetch page $page of size $pageSize containing individuals only',
        async ({ page, pageSize, expectedContactCodes, resultSize }) => {
          // When
          const response = await httpClient.get('/contacts', {
            params: {
              page,
              pageSize,
              type: 'organisation',
            },
          })

          // Then
          const { contacts } = response.data.content

          expect(
            contacts.map((c: any) => ({
              contactCode: c.contactCode,
              type: c.type,
            }))
          ).toEqual(
            expectedContactCodes.map((cc) => ({
              contactCode: cc,
              type: 'organisation',
            }))
          )
          expect(contacts.length).toEqual(resultSize)
        }
      )
    })
  })
})
