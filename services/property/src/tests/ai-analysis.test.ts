import request from 'supertest'
import app from '../app'
import * as bergetAdapter from '../adapters/berget-adapter'
import * as componentCategoryAdapter from '../adapters/component-category-adapter'
import { logger } from '@onecore/utilities'

beforeEach(jest.restoreAllMocks)

describe('AI Analysis API', () => {
  describe('POST /components/analyze-image', () => {
    const validBase64Image =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD'
    const mockAnalysisResult = {
      componentCategory: 'Vitvara',
      componentType: 'Kylskåp',
      componentSubtype: 'Fristående 190-215 liter',
      manufacturer: 'Electrolux',
      model: 'ERF3300AOW',
      serialNumber: 'SN123456789',
      estimatedAge: '5-10 år',
      condition: 'Gott skick',
      specifications: 'Energiklass A++, Volym 343L',
      dimensions: '60x60x185 cm',
      warrantyMonths: 24,
      ncsCode: null,
      additionalInformation: null,
      confidence: 0.85,
    }

    it('returns 200 with analysis when image is valid', async () => {
      jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockResolvedValueOnce(mockAnalysisResult)

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({ image: validBase64Image })

      expect(res.status).toBe(200)
      expect(res.body.content).toMatchObject({
        componentCategory: 'Vitvara',
        componentType: 'Kylskåp',
        manufacturer: 'Electrolux',
        confidence: 0.85,
      })
    })

    it('accepts image payloads larger than the 1mb koa-body default', async () => {
      jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockResolvedValueOnce(mockAnalysisResult)

      // ~2MB base64 image — rejected with 413 before jsonLimit was raised
      const largeBase64Image = `data:image/jpeg;base64,${'A'.repeat(2_000_000)}`

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({ image: largeBase64Image })

      expect(res.status).toBe(200)
      expect(res.body.content.componentCategory).toBe('Vitvara')
    })

    it('returns 200 with analysis when both images provided', async () => {
      const analyzeSpy = jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockResolvedValueOnce(mockAnalysisResult)

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({
          image: validBase64Image,
          additionalImage: validBase64Image,
        })

      expect(res.status).toBe(200)
      expect(analyzeSpy).toHaveBeenCalledWith(
        validBase64Image,
        validBase64Image,
        undefined
      )
    })

    it('looks up the category and forwards its name and types to the analyzer', async () => {
      const infoSpy = jest.spyOn(logger, 'info')
      const categoryId = '11111111-1111-1111-1111-111111111111'
      const date = new Date()
      jest
        .spyOn(componentCategoryAdapter, 'getComponentCategoryById')
        .mockResolvedValueOnce({
          id: categoryId,
          categoryName: 'Vitvaror',
          description: '',
          createdAt: date,
          updatedAt: date,
          componentTypes: [
            {
              id: 't1',
              typeName: 'Kylskåp',
              categoryId,
              description: null,
              createdAt: date,
              updatedAt: date,
            },
            {
              id: 't2',
              typeName: 'Diskmaskin',
              categoryId,
              description: null,
              createdAt: date,
              updatedAt: date,
            },
          ],
        })
      const analyzeSpy = jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockResolvedValueOnce(mockAnalysisResult)

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({ image: validBase64Image, categoryId })

      expect(res.status).toBe(200)
      expect(analyzeSpy).toHaveBeenCalledWith(validBase64Image, undefined, {
        categoryName: 'Vitvaror',
        availableTypes: ['Kylskåp', 'Diskmaskin'],
      })
      expect(infoSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        'components.analyze-image: no dedicated prompt for category, using general prompt'
      )
    })

    it('logs when the selected category has no dedicated prompt', async () => {
      const infoSpy = jest.spyOn(logger, 'info')
      const categoryId = '44444444-4444-4444-4444-444444444444'
      const date = new Date()
      jest
        .spyOn(componentCategoryAdapter, 'getComponentCategoryById')
        .mockResolvedValueOnce({
          id: categoryId,
          categoryName: 'VVS',
          description: '',
          createdAt: date,
          updatedAt: date,
          componentTypes: [],
        })
      jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockResolvedValueOnce(mockAnalysisResult)

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({ image: validBase64Image, categoryId })

      expect(res.status).toBe(200)
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ categoryName: 'VVS' }),
        'components.analyze-image: no dedicated prompt for category, using general prompt'
      )
    })

    it('falls back to the general prompt when categoryId is unknown', async () => {
      jest
        .spyOn(componentCategoryAdapter, 'getComponentCategoryById')
        .mockResolvedValueOnce(null)
      const analyzeSpy = jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockResolvedValueOnce(mockAnalysisResult)

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({
          image: validBase64Image,
          categoryId: '22222222-2222-2222-2222-222222222222',
        })

      expect(res.status).toBe(200)
      expect(analyzeSpy).toHaveBeenCalledWith(
        validBase64Image,
        undefined,
        undefined
      )
    })

    it('falls back to the general prompt when the category lookup fails', async () => {
      jest
        .spyOn(componentCategoryAdapter, 'getComponentCategoryById')
        .mockRejectedValueOnce(new Error('db connection refused'))
      const analyzeSpy = jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockResolvedValueOnce(mockAnalysisResult)

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({
          image: validBase64Image,
          categoryId: '33333333-3333-3333-3333-333333333333',
        })

      expect(res.status).toBe(200)
      expect(res.body.content).toMatchObject({
        componentCategory: 'Vitvara',
        componentType: 'Kylskåp',
        confidence: 0.85,
      })
      expect(analyzeSpy).toHaveBeenCalledWith(
        validBase64Image,
        undefined,
        undefined
      )
      // The DB error must not leak to the client
      expect(JSON.stringify(res.body)).not.toContain('db connection refused')
    })

    it('returns 400 when image is missing', async () => {
      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({})

      expect(res.status).toBe(400)
    })

    it('returns 400 when image is empty string', async () => {
      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({ image: '' })

      expect(res.status).toBe(400)
    })

    it('returns 401 when API key is invalid', async () => {
      jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockRejectedValueOnce(new Error('Invalid Berget AI API key'))

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({ image: validBase64Image })

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Invalid Berget AI API key')
    })

    it('returns 429 when rate limit exceeded', async () => {
      jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockRejectedValueOnce(new Error('Berget AI rate limit exceeded'))

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({ image: validBase64Image })

      expect(res.status).toBe(429)
      expect(res.body.error).toBe('Berget AI rate limit exceeded')
    })

    it('returns 504 when request times out', async () => {
      jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockRejectedValueOnce(new Error('Berget AI request timeout'))

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({ image: validBase64Image })

      expect(res.status).toBe(504)
      expect(res.body.error).toBe('Berget AI request timeout')
    })

    it('returns 500 for other errors', async () => {
      jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockRejectedValueOnce(new Error('AI analysis failed: network error'))

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({ image: validBase64Image })

      expect(res.status).toBe(500)
      expect(res.body.error).toContain('AI analysis failed')
    })

    it('handles null/unknown fields in response gracefully', async () => {
      const sparseResult = {
        componentCategory: 'Vitvara',
        componentType: null,
        componentSubtype: null,
        manufacturer: null,
        model: null,
        serialNumber: null,
        estimatedAge: null,
        condition: null,
        specifications: null,
        dimensions: null,
        warrantyMonths: null,
        ncsCode: null,
        additionalInformation: null,
        confidence: 0.3,
      }

      jest
        .spyOn(bergetAdapter, 'analyzeComponentImage')
        .mockResolvedValueOnce(sparseResult)

      const res = await request(app.callback())
        .post('/components/analyze-image')
        .send({ image: validBase64Image })

      expect(res.status).toBe(200)
      expect(res.body.content.componentCategory).toBe('Vitvara')
      expect(res.body.content.componentType).toBeNull()
      expect(res.body.content.confidence).toBe(0.3)
    })
  })
})
