import request from 'supertest'
import app from '../app'
import * as bergetAdapter from '../adapters/berget-adapter'

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
        validBase64Image
      )
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
