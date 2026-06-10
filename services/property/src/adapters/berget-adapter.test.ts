import axios from 'axios'
import { analyzeComponentImage } from './berget-adapter'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

beforeEach(jest.clearAllMocks)

const aiResponse = (content: string) => ({
  data: { choices: [{ message: { content } }] },
})

const validAnalysis = {
  componentCategory: 'Vitvaror',
  componentType: 'Kylskåp',
  componentSubtype: null,
  manufacturer: 'Bosch',
  model: 'KGN39VIDA',
  serialNumber: null,
  estimatedAge: '2-3 år',
  condition: 'Gott',
  specifications: null,
  dimensions: null,
  warrantyMonths: 24,
  ncsCode: null,
  additionalInformation: null,
  confidence: 0.85,
}

describe('analyzeComponentImage', () => {
  it('returns the parsed analysis for a valid AI response', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      aiResponse(JSON.stringify(validAnalysis))
    )

    const result = await analyzeComponentImage('base64data')

    expect(result).toEqual(validAnalysis)
  })

  it('parses JSON wrapped in markdown code fences', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      aiResponse('```json\n' + JSON.stringify(validAnalysis) + '\n```')
    )

    const result = await analyzeComponentImage('base64data')

    expect(result.componentType).toBe('Kylskåp')
  })

  it('clamps out-of-range confidence into [0, 1] and defaults missing confidence to 0', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      aiResponse(JSON.stringify({ ...validAnalysis, confidence: 1.4 }))
    )
    const clamped = await analyzeComponentImage('base64data')
    expect(clamped.confidence).toBe(1)

    const { confidence: _omitted, ...withoutConfidence } = validAnalysis
    mockedAxios.post.mockResolvedValueOnce(
      aiResponse(JSON.stringify(withoutConfidence))
    )
    const defaulted = await analyzeComponentImage('base64data')
    expect(defaulted.confidence).toBe(0)

    mockedAxios.post.mockResolvedValueOnce(
      aiResponse(JSON.stringify({ ...validAnalysis, confidence: -0.2 }))
    )
    const clampedNegative = await analyzeComponentImage('base64data')
    expect(clampedNegative.confidence).toBe(0)

    mockedAxios.post.mockResolvedValueOnce(
      aiResponse(JSON.stringify({ ...validAnalysis, confidence: '0.85' }))
    )
    const stringConfidence = await analyzeComponentImage('base64data')
    expect(stringConfidence.confidence).toBe(0)
  })

  it('rounds fractional warrantyMonths and nulls negative or non-numeric values', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      aiResponse(JSON.stringify({ ...validAnalysis, warrantyMonths: 24.6 }))
    )
    expect((await analyzeComponentImage('base64data')).warrantyMonths).toBe(25)

    mockedAxios.post.mockResolvedValueOnce(
      aiResponse(JSON.stringify({ ...validAnalysis, warrantyMonths: -3 }))
    )
    expect(
      (await analyzeComponentImage('base64data')).warrantyMonths
    ).toBeNull()

    mockedAxios.post.mockResolvedValueOnce(
      aiResponse(JSON.stringify({ ...validAnalysis, warrantyMonths: '24' }))
    )
    expect(
      (await analyzeComponentImage('base64data')).warrantyMonths
    ).toBeNull()
  })

  it('throws a curated error when the AI response does not match the schema', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      aiResponse(JSON.stringify({ ...validAnalysis, componentCategory: 123 }))
    )

    await expect(analyzeComponentImage('base64data')).rejects.toThrow(
      'AI response did not match the expected format'
    )
  })

  it('throws when the AI response contains no JSON', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      aiResponse('Jag kan tyvärr inte analysera den här bilden.')
    )

    await expect(analyzeComponentImage('base64data')).rejects.toThrow(
      'AI analysis failed: Could not parse JSON from AI response'
    )
  })

  it('throws the curated parse error when the extracted braces are not valid JSON', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      aiResponse('Resultat: {oops, not json}')
    )

    await expect(analyzeComponentImage('base64data')).rejects.toThrow(
      'AI analysis failed: Could not parse JSON from AI response'
    )
  })
})
