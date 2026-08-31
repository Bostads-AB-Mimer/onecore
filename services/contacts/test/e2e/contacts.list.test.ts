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
    it('should fetch a page(limit=20) of contacts when no query parameters are provided', async () => {
      // When
      const response = await httpClient.get('/contacts/')

      // Then
      expect(response.data).toEqual({
        content: expect.any(Array),
        _meta: expect.objectContaining({
          totalRecords: expect.any(Number),
          page: 1,
          limit: 20,
          count: expect.any(Number),
        }),
        _links: expect.any(Array),
      })

      expect(response.data.content.map((c: any) => c.contactCode)).toEqual(
        DATA_SET.slice(0, 16)
      )
    })
  })

  describe('Pagination', () => {
    describe('No filter', () => {
      it.each([
        {
          page: 1,
          limit: 5,
          expectedContactCodes: DATA_SET.slice(0, 5),
        },
        {
          page: 3,
          limit: 5,
          expectedContactCodes: DATA_SET.slice(10, 15),
        },
        {
          page: 5,
          limit: 5,
          expectedContactCodes: DATA_SET.slice(20, 25),
        },
        {
          page: 1,
          limit: 10,
          expectedContactCodes: DATA_SET.slice(0, 10),
        },
        {
          page: 2,
          limit: 10,
          expectedContactCodes: DATA_SET.slice(10, 20),
        },
        {
          page: 1,
          limit: 20,
          expectedContactCodes: DATA_SET.slice(0, 20),
        },
        {
          page: 2,
          limit: 20,
          expectedContactCodes: DATA_SET.slice(20, 40),
        },
        {
          page: 3,
          limit: 20,
          expectedContactCodes: DATA_SET.slice(40, 43),
        },
        {
          page: 1,
          limit: 100,
          expectedContactCodes: DATA_SET,
        },
      ])(
        'should fetch page $page of limit $limit',
        async ({ page, limit, expectedContactCodes }) => {
          // When
          const response = await httpClient.get('/contacts', {
            params: { page, limit },
          })

          // Then
          expect(response.data.content.map((c: any) => c.contactCode)).toEqual(
            expectedContactCodes
          )
        }
      )
    })

    describe('with type=individual', () => {
      it.each([
        {
          page: 1,
          limit: 5,
          expectedContactCodes: INDIVIDUAL_SET.slice(0, 5),
          resultSize: 5,
        },
        {
          page: 2,
          limit: 5,
          expectedContactCodes: INDIVIDUAL_SET.slice(5, 10),
          resultSize: 5,
        },
        {
          page: 3,
          limit: 5,
          expectedContactCodes: INDIVIDUAL_SET.slice(10, 15),
          resultSize: 1,
        },
        {
          page: 5,
          limit: 5,
          expectedContactCodes: INDIVIDUAL_SET.slice(20, 25),
          resultSize: 0,
        },
        {
          page: 1,
          limit: 10,
          expectedContactCodes: INDIVIDUAL_SET.slice(0, 10),
          resultSize: 10,
        },
        {
          page: 2,
          limit: 10,
          expectedContactCodes: INDIVIDUAL_SET.slice(10, 20),
          resultSize: 1,
        },
        {
          page: 1,
          limit: 20,
          expectedContactCodes: INDIVIDUAL_SET.slice(0, 20),
          resultSize: 11,
        },
        {
          page: 2,
          limit: 20,
          expectedContactCodes: INDIVIDUAL_SET.slice(20, 40),
          resultSize: 0,
        },
        {
          page: 3,
          limit: 20,
          expectedContactCodes: INDIVIDUAL_SET.slice(40, 43),
          resultSize: 0,
        },
        {
          page: 1,
          limit: 100,
          expectedContactCodes: INDIVIDUAL_SET,
          resultSize: 11,
        },
      ])(
        'should fetch page $page of limit $limit containing individuals only',
        async ({ page, limit, expectedContactCodes, resultSize }) => {
          // When
          const response = await httpClient.get('/contacts', {
            params: {
              page,
              limit,
              type: 'individual',
            },
          })

          // Then
          const { content } = response.data

          expect(
            content.map((c: any) => ({
              contactCode: c.contactCode,
              type: c.type,
            }))
          ).toEqual(
            expectedContactCodes.map((cc) => ({
              contactCode: cc,
              type: 'individual',
            }))
          )
          expect(content.length).toEqual(resultSize)
        }
      )
    })

    describe('with type=organisation', () => {
      it.each([
        {
          page: 1,
          limit: 5,
          expectedContactCodes: ORGANISATION_SET.slice(0, 5),
          resultSize: 4,
        },
        {
          page: 3,
          limit: 5,
          expectedContactCodes: ORGANISATION_SET.slice(10, 15),
          resultSize: 0,
        },
        {
          page: 5,
          limit: 5,
          expectedContactCodes: ORGANISATION_SET.slice(20, 25),
          resultSize: 0,
        },
        {
          page: 1,
          limit: 10,
          expectedContactCodes: ORGANISATION_SET.slice(0, 10),
          resultSize: 4,
        },
        {
          page: 2,
          limit: 10,
          expectedContactCodes: ORGANISATION_SET.slice(10, 15),
          resultSize: 0,
        },
        {
          page: 1,
          limit: 20,
          expectedContactCodes: ORGANISATION_SET.slice(0, 15),
          resultSize: 4,
        },
        {
          page: 2,
          limit: 20,
          expectedContactCodes: ORGANISATION_SET.slice(20, 40),
          resultSize: 0,
        },
        {
          page: 3,
          limit: 20,
          expectedContactCodes: ORGANISATION_SET.slice(40, 43),
          resultSize: 0,
        },
        {
          page: 1,
          limit: 100,
          expectedContactCodes: ORGANISATION_SET,
          resultSize: 4,
        },
      ])(
        'should fetch page $page of limit $limit containing organisations only',
        async ({ page, limit, expectedContactCodes, resultSize }) => {
          // When
          const response = await httpClient.get('/contacts', {
            params: {
              page,
              limit,
              type: 'organisation',
            },
          })

          // Then
          const { content } = response.data

          expect(
            content.map((c: any) => ({
              contactCode: c.contactCode,
              type: c.type,
            }))
          ).toEqual(
            expectedContactCodes.map((cc) => ({
              contactCode: cc,
              type: 'organisation',
            }))
          )
          expect(content.length).toEqual(resultSize)
        }
      )
    })
  })
})
