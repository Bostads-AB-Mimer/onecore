import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import * as inspectionAdapter from '../../../adapters/inspection-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import * as pdfGenerator from '../helpers/pdf-generator'
import { routes } from '../index'
import bodyParser from 'koa-bodyparser'
import * as schemas from '../schemas'
import { INSPECTION_STATUS_FILTER } from '../schemas'
import {
  DetailedXpandInspectionFactory,
  XpandInspectionFactory,
} from '../../../../test/factories/inspection'
import { LeaseFactory } from '../../../../test/factories/lease'
import { ResidenceByRentalIdDetailsFactory } from '../../../../test/factories/residence-details'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('inspection-service index', () => {
  beforeEach(() => {
    jest.spyOn(leasingAdapter, 'getLeases').mockResolvedValue({})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET /inspections (combined)', () => {
    const mockInternalInspections = XpandInspectionFactory.buildList(1, {
      id: 'INT-1',
    })
    const mockXpandInspections = XpandInspectionFactory.buildList(1, {
      id: 'XPN-1',
    })

    const mockInternalPaginatedResponse = {
      content: mockInternalInspections,
      _meta: { totalRecords: 1, page: 1, limit: 25, count: 1 },
      _links: [],
    }

    const mockXpandPaginatedResponse = {
      content: mockXpandInspections,
      _meta: { totalRecords: 1, page: 1, limit: 25, count: 1 },
      _links: [
        { href: '/inspections/xpand?page=1&limit=25', rel: 'self' as const },
      ],
    }

    it('should return merged inspections from both sources with source field', async () => {
      jest
        .spyOn(inspectionAdapter, 'getInternalInspections')
        .mockResolvedValue({ ok: true, data: mockInternalPaginatedResponse })
      jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({ ok: true, data: mockXpandPaginatedResponse })

      const res = await request(app.callback()).get('/inspections')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(2)
      expect(res.body.content[0].source).toBe('internal')
      expect(res.body.content[0].id).toBe('INT-1')
      expect(res.body.content[1].source).toBe('xpand')
      expect(res.body.content[1].id).toBe('XPN-1')
      expect(res.body._meta.totalRecords).toBe(2)
    })

    it('should return only xpand results when internal fails', async () => {
      jest
        .spyOn(inspectionAdapter, 'getInternalInspections')
        .mockResolvedValue({ ok: false, err: 'unknown' })
      jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({ ok: true, data: mockXpandPaginatedResponse })

      const res = await request(app.callback()).get('/inspections')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
      expect(res.body.content[0].source).toBe('xpand')
    })

    it('should return only internal results when xpand fails', async () => {
      jest
        .spyOn(inspectionAdapter, 'getInternalInspections')
        .mockResolvedValue({ ok: true, data: mockInternalPaginatedResponse })
      jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get('/inspections')

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
      expect(res.body.content[0].source).toBe('internal')
    })

    it('should return 400 on invalid query params', async () => {
      const res = await request(app.callback()).get('/inspections?page=invalid')

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid query parameters')
    })
  })

  describe('GET /inspections/residence/:residenceId (combined)', () => {
    const mockInternalInspections = XpandInspectionFactory.buildList(1, {
      id: 'INT-1',
    })
    const mockXpandInspections = XpandInspectionFactory.buildList(1, {
      id: 'XPN-1',
    })

    it('should return merged inspections from both sources with source field', async () => {
      jest
        .spyOn(inspectionAdapter, 'getInternalInspectionsByResidenceId')
        .mockResolvedValue({ ok: true, data: mockInternalInspections })
      jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({ ok: true, data: mockXpandInspections })

      const res = await request(app.callback()).get(
        '/inspections/residence/residence-123'
      )

      expect(res.status).toBe(200)
      expect(res.body.content.inspections).toHaveLength(2)
      expect(res.body.content.inspections[0].source).toBe('internal')
      expect(res.body.content.inspections[1].source).toBe('xpand')
    })

    it('should return only xpand results when internal fails', async () => {
      jest
        .spyOn(inspectionAdapter, 'getInternalInspectionsByResidenceId')
        .mockResolvedValue({ ok: false, err: 'unknown' })
      jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({ ok: true, data: mockXpandInspections })

      const res = await request(app.callback()).get(
        '/inspections/residence/residence-123'
      )

      expect(res.status).toBe(200)
      expect(res.body.content.inspections).toHaveLength(1)
      expect(res.body.content.inspections[0].source).toBe('xpand')
    })

    it('should return only internal results when xpand fails', async () => {
      jest
        .spyOn(inspectionAdapter, 'getInternalInspectionsByResidenceId')
        .mockResolvedValue({ ok: true, data: mockInternalInspections })
      jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({ ok: false, err: 'unknown' })

      const res = await request(app.callback()).get(
        '/inspections/residence/residence-123'
      )

      expect(res.status).toBe(200)
      expect(res.body.content.inspections).toHaveLength(1)
      expect(res.body.content.inspections[0].source).toBe('internal')
    })
  })

  describe('GET /inspections/xpand', () => {
    const mockInspections = XpandInspectionFactory.buildList(2)

    const mockPaginatedResponse = {
      content: mockInspections,
      _meta: { totalRecords: 2, page: 1, limit: 25, count: 2 },
      _links: [
        { href: '/inspections/xpand?page=1&limit=25', rel: 'self' as const },
      ],
    }

    it('should return paginated inspections from Xpand', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: mockPaginatedResponse,
        })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('content')
      expect(res.body).toHaveProperty('_meta')
      expect(res.body).toHaveProperty('_links')
      expect(res.body.content).toHaveLength(2)
      expect(res.body._meta.totalRecords).toBe(2)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        statusFilter: undefined,
        sortAscending: undefined,
        inspector: undefined,
        address: undefined,
      })
    })

    it('should handle pagination and status filter parameters', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: {
            content: [mockInspections[0]],
            _meta: { totalRecords: 10, page: 2, limit: 5, count: 1 },
            _links: [],
          },
        })

      const res = await request(app.callback()).get(
        `/inspections/xpand?page=2&limit=5&statusFilter=${INSPECTION_STATUS_FILTER.ONGOING}&sortAscending=true`
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveLength(1)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        statusFilter: INSPECTION_STATUS_FILTER.ONGOING,
        sortAscending: true,
        inspector: undefined,
        address: undefined,
      })
    })

    it('should handle statusFilter=completed', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: {
            content: mockInspections,
            _meta: { totalRecords: 2, page: 1, limit: 25, count: 2 },
            _links: [],
          },
        })

      const res = await request(app.callback()).get(
        `/inspections/xpand?statusFilter=${INSPECTION_STATUS_FILTER.COMPLETED}`
      )

      expect(res.status).toBe(200)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        statusFilter: INSPECTION_STATUS_FILTER.COMPLETED,
        sortAscending: undefined,
        inspector: undefined,
        address: undefined,
      })
    })

    it('should return 400 on invalid query params', async () => {
      const res = await request(app.callback()).get(
        '/inspections/xpand?page=invalid'
      )

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Invalid query parameters')
    })

    it('should return 500 if adapter returns error', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: false,
          err: 'unknown',
        })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(getXpandInspectionsSpy).toHaveBeenCalled()
    })

    it('should return 500 if adapter throws error', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockRejectedValue(new Error('Network error'))

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getXpandInspectionsSpy).toHaveBeenCalled()
    })

    it('should parse sortAscending as boolean from string', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: mockPaginatedResponse,
        })

      const resTrue = await request(app.callback()).get(
        '/inspections/xpand?sortAscending=true'
      )

      expect(resTrue.status).toBe(200)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        statusFilter: undefined,
        sortAscending: true,
        inspector: undefined,
        address: undefined,
      })

      getXpandInspectionsSpy.mockClear()

      const resFalse = await request(app.callback()).get(
        '/inspections/xpand?sortAscending=false'
      )

      expect(resFalse.status).toBe(200)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        statusFilter: undefined,
        sortAscending: false,
        inspector: undefined,
        address: undefined,
      })
    })

    it('should validate response contains inspections in content array', async () => {
      jest.spyOn(inspectionAdapter, 'getXpandInspections').mockResolvedValue({
        ok: true,
        data: mockPaginatedResponse,
      })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.content)).toBe(true)
      expect(() =>
        schemas.XpandInspectionSchema.array().parse(res.body.content)
      ).not.toThrow()
    })

    it('should pass inspector query param to adapter', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: mockPaginatedResponse,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand?inspector=John%20Doe'
      )

      expect(res.status).toBe(200)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        statusFilter: undefined,
        sortAscending: undefined,
        inspector: 'John Doe',
        address: undefined,
      })
    })

    it('should pass address query param to adapter', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: mockPaginatedResponse,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand?address=Main%20Street%201'
      )

      expect(res.status).toBe(200)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        statusFilter: undefined,
        sortAscending: undefined,
        inspector: undefined,
        address: 'Main Street 1',
      })
    })

    it('should pass both inspector and address filters together', async () => {
      const getXpandInspectionsSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspections')
        .mockResolvedValue({
          ok: true,
          data: mockPaginatedResponse,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand?inspector=John%20Doe&address=Main%20Street%201'
      )

      expect(res.status).toBe(200)
      expect(getXpandInspectionsSpy).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        statusFilter: undefined,
        sortAscending: undefined,
        inspector: 'John Doe',
        address: 'Main Street 1',
      })
    })

    it('should return empty array when no inspections found', async () => {
      jest.spyOn(inspectionAdapter, 'getXpandInspections').mockResolvedValue({
        ok: true,
        data: {
          content: [],
          _meta: { totalRecords: 0, page: 1, limit: 25, count: 0 },
          _links: [],
        },
      })

      const res = await request(app.callback()).get('/inspections/xpand')

      expect(res.status).toBe(200)
      expect(res.body.content).toEqual([])
      expect(res.body._meta.totalRecords).toBe(0)
    })
  })

  describe('GET /inspections/xpand/residence/:residenceId', () => {
    const mockInspections = XpandInspectionFactory.buildList(2)

    it('should return inspections for a specific residence ID', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: true,
          data: mockInspections,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('inspections')
      expect(res.body.content.inspections).toHaveLength(2)
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalledWith(
        'residence-123',
        undefined
      )
    })

    it('should pass statusFilter to adapter when provided', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: true,
          data: mockInspections,
        })

      const res = await request(app.callback()).get(
        `/inspections/xpand/residence/residence-123?statusFilter=${INSPECTION_STATUS_FILTER.ONGOING}`
      )

      expect(res.status).toBe(200)
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalledWith(
        'residence-123',
        INSPECTION_STATUS_FILTER.ONGOING
      )
    })

    it('should return 404 when no inspections found for residence ID', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: false,
          err: 'not-found',
          statusCode: 404,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('not-found')
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalledWith(
        'residence-123',
        undefined
      )
    })

    it('should return 500 if adapter returns error', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: false,
          err: 'unknown',
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalled()
    })

    it('should return 500 if adapter throws error', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockRejectedValue(new Error('Network error'))

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalled()
    })

    it('should validate response schema matches XpandInspectionSchema', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: true,
          data: mockInspections,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(200)
      expect(() =>
        schemas.XpandInspectionSchema.array().parse(
          res.body.content.inspections
        )
      ).not.toThrow()
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalled()
    })

    it('should return empty array when no inspections found for residence', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: true,
          data: [],
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-123'
      )

      expect(res.status).toBe(200)
      expect(res.body.content.inspections).toEqual([])
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalled()
    })

    it('should handle special characters in residence ID', async () => {
      const getXpandInspectionsByResidenceIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionsByResidenceId')
        .mockResolvedValue({
          ok: true,
          data: mockInspections,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/residence/residence-abc-123'
      )

      expect(res.status).toBe(200)
      expect(getXpandInspectionsByResidenceIdSpy).toHaveBeenCalledWith(
        'residence-abc-123',
        undefined
      )
    })
  })

  describe('GET /inspections/xpand/:inspectionId', () => {
    const mockDetailedInspection = DetailedXpandInspectionFactory.build()
    const mockLease = LeaseFactory.build()
    const mockResidence = ResidenceByRentalIdDetailsFactory.build()

    it('should return inspection for a specific inspection ID', async () => {
      const getXpandInspectionByIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionById')
        .mockResolvedValue({
          ok: true,
          data: mockDetailedInspection,
        })

      jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

      jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValue({
          ok: true,
          data: mockResidence,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/inspection-123'
      )

      expect(res.status).toBe(200)
      expect(res.body.content).toHaveProperty('id')
      expect(res.body.content).toHaveProperty('lease')
      expect(res.body.content).toHaveProperty('residence')
      expect(getXpandInspectionByIdSpy).toHaveBeenCalledWith('inspection-123')
    })

    it('should return 404 when inspection not found for inspection ID', async () => {
      const getXpandInspectionByIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionById')
        .mockResolvedValue({
          ok: false,
          err: 'not-found',
          statusCode: 404,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/inspection-123'
      )

      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('not-found')
      expect(getXpandInspectionByIdSpy).toHaveBeenCalledWith('inspection-123')
    })

    it('should return 500 if adapter returns error', async () => {
      const getXpandInspectionByIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionById')
        .mockResolvedValue({
          ok: false,
          err: 'unknown',
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/inspection-123'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(getXpandInspectionByIdSpy).toHaveBeenCalled()
    })

    it('should return 500 if adapter throws error', async () => {
      const getXpandInspectionByIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionById')
        .mockRejectedValue(new Error('Network error'))

      const res = await request(app.callback()).get(
        '/inspections/xpand/inspection-123'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getXpandInspectionByIdSpy).toHaveBeenCalled()
    })

    it('should validate response schema matches XpandInspectionSchema', async () => {
      const getXpandInspectionByIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionById')
        .mockResolvedValue({
          ok: true,
          data: mockDetailedInspection,
        })

      jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

      jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValue({
          ok: true,
          data: mockResidence,
        })

      const res = await request(app.callback()).get(
        '/inspections/xpand/inspection-123'
      )

      expect(res.status).toBe(200)
      expect(() =>
        schemas.DetailedXpandInspectionSchema.parse(res.body.content)
      ).not.toThrow()
      expect(getXpandInspectionByIdSpy).toHaveBeenCalled()
    })
  })

  describe('GET /inspections/xpand/:inspectionId/pdf', () => {
    it('should return PDF buffer for a specific inspection ID', async () => {
      const mockDetailedInspection = DetailedXpandInspectionFactory.build()
      const mockLease = LeaseFactory.build()
      const mockResidence = ResidenceByRentalIdDetailsFactory.build()
      const mockPdfBuffer = Buffer.from('%PDF-1.4...')

      const getXpandInspectionByIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionById')
        .mockResolvedValue({
          ok: true,
          data: mockDetailedInspection,
        })

      const getLeaseSpy = jest
        .spyOn(leasingAdapter, 'getLease')
        .mockResolvedValue(mockLease)

      const getResidenceByRentalIdSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValue({
          ok: true,
          data: mockResidence,
        })

      const generateInspectionProtocolPdfSpy = jest
        .spyOn(pdfGenerator, 'generateInspectionProtocolPdf')
        .mockResolvedValue(mockPdfBuffer)

      const res = await request(app.callback()).get(
        '/inspections/xpand/inspection-123/pdf'
      )

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('application/json')
      expect(res.body.content).toHaveProperty('pdfBase64')
      expect(res.body.content.pdfBase64).toBe(mockPdfBuffer.toString('base64'))
      expect(getXpandInspectionByIdSpy).toHaveBeenCalledWith('inspection-123')
      expect(generateInspectionProtocolPdfSpy).toHaveBeenCalledWith(
        expect.anything(),
        { includeCosts: true }
      )
    })

    it('should return 500 if PDF generation fails', async () => {
      const mockDetailedInspection = DetailedXpandInspectionFactory.build()
      const mockLease = LeaseFactory.build()
      const mockResidence = ResidenceByRentalIdDetailsFactory.build()

      const getXpandInspectionByIdSpy = jest
        .spyOn(inspectionAdapter, 'getXpandInspectionById')
        .mockResolvedValue({
          ok: true,
          data: mockDetailedInspection,
        })

      const getLeaseSpy = jest
        .spyOn(leasingAdapter, 'getLease')
        .mockResolvedValue(mockLease)

      const getResidenceByRentalIdSpy = jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValue({
          ok: true,
          data: mockResidence,
        })

      const generateInspectionProtocolPdfSpy = jest
        .spyOn(pdfGenerator, 'generateInspectionProtocolPdf')
        .mockRejectedValue(new Error('PDF generation error'))

      const res = await request(app.callback()).get(
        '/inspections/xpand/inspection-123/pdf'
      )

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toBe('Internal server error')
      expect(getXpandInspectionByIdSpy).toHaveBeenCalledWith('inspection-123')
      expect(generateInspectionProtocolPdfSpy).toHaveBeenCalled()
    })

    it('should generate PDF without costs when includeCosts=false', async () => {
      const mockDetailedInspection = DetailedXpandInspectionFactory.build()
      const mockLease = LeaseFactory.build()
      const mockResidence = ResidenceByRentalIdDetailsFactory.build()
      const mockPdfBuffer = Buffer.from('%PDF-1.4...')

      jest
        .spyOn(inspectionAdapter, 'getXpandInspectionById')
        .mockResolvedValue({
          ok: true,
          data: mockDetailedInspection,
        })

      jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

      jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValue({
          ok: true,
          data: mockResidence,
        })

      const generateInspectionProtocolPdfSpy = jest
        .spyOn(pdfGenerator, 'generateInspectionProtocolPdf')
        .mockResolvedValue(mockPdfBuffer)

      const res = await request(app.callback()).get(
        '/inspections/xpand/inspection-123/pdf?includeCosts=false'
      )

      expect(res.status).toBe(200)
      expect(generateInspectionProtocolPdfSpy).toHaveBeenCalledWith(
        expect.anything(),
        { includeCosts: false }
      )
    })

    it('should generate PDF with costs by default when includeCosts is not specified', async () => {
      const mockDetailedInspection = DetailedXpandInspectionFactory.build()
      const mockLease = LeaseFactory.build()
      const mockResidence = ResidenceByRentalIdDetailsFactory.build()
      const mockPdfBuffer = Buffer.from('%PDF-1.4...')

      jest
        .spyOn(inspectionAdapter, 'getXpandInspectionById')
        .mockResolvedValue({
          ok: true,
          data: mockDetailedInspection,
        })

      jest.spyOn(leasingAdapter, 'getLease').mockResolvedValue(mockLease)

      jest
        .spyOn(propertyBaseAdapter, 'getResidenceByRentalId')
        .mockResolvedValue({
          ok: true,
          data: mockResidence,
        })

      const generateInspectionProtocolPdfSpy = jest
        .spyOn(pdfGenerator, 'generateInspectionProtocolPdf')
        .mockResolvedValue(mockPdfBuffer)

      const res = await request(app.callback()).get(
        '/inspections/xpand/inspection-123/pdf'
      )

      expect(res.status).toBe(200)
      expect(generateInspectionProtocolPdfSpy).toHaveBeenCalledWith(
        expect.anything(),
        { includeCosts: true }
      )
    })
  })
})
