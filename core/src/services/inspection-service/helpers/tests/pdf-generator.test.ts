import { generateInspectionProtocolPdf } from '../pdf-generator'
import { DetailedXpandInspectionFactory } from '../../../../../test/factories/inspection'
import type { DetailedInspection } from '../../schemas'

describe('generateInspectionProtocolPdf', () => {
  // Helper to create a valid DetailedInspection with lease and residence
  const createInspection = (overrides = {}): DetailedInspection =>
    ({
      ...DetailedXpandInspectionFactory.build(overrides),
      lease: null,
      residence: null,
    }) as unknown as DetailedInspection

  describe('input validation', () => {
    it('should throw error when inspection is null', async () => {
      await expect(generateInspectionProtocolPdf(null as any)).rejects.toThrow(
        'Invalid inspection: inspection object is null or undefined'
      )
    })

    it('should throw error when inspection is undefined', async () => {
      await expect(
        generateInspectionProtocolPdf(undefined as any)
      ).rejects.toThrow(
        'Invalid inspection: inspection object is null or undefined'
      )
    })

    it('should throw error when inspection ID is missing', async () => {
      const inspection = createInspection({ id: '' })
      await expect(generateInspectionProtocolPdf(inspection)).rejects.toThrow(
        'Invalid inspection: missing required ID'
      )
    })

    it('should throw error when inspection date is missing', async () => {
      const inspection = createInspection({
        date: undefined as any,
      })
      await expect(generateInspectionProtocolPdf(inspection)).rejects.toThrow(
        'Invalid inspection: missing required date'
      )
    })

    it('should throw error when inspection address is missing', async () => {
      const inspection = createInspection({
        address: undefined as any,
      })
      await expect(generateInspectionProtocolPdf(inspection)).rejects.toThrow(
        'Invalid inspection: missing required address'
      )
    })
  })

  describe('successful PDF generation', () => {
    it('should return a Buffer when given valid inspection data', async () => {
      const inspection = createInspection()
      const result = await generateInspectionProtocolPdf(inspection)

      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should generate valid PDF with correct magic bytes', async () => {
      const inspection = createInspection()
      const result = await generateInspectionProtocolPdf(inspection)

      // Check for PDF magic bytes
      const pdfHeader = result.toString('utf-8', 0, 5)
      expect(pdfHeader).toBe('%PDF-')

      // Check for EOF marker
      const pdfEnd = result.toString('utf-8', result.length - 6, result.length)
      expect(pdfEnd).toBe('%%EOF\n')
    })

    it('should handle inspection with empty rooms', async () => {
      const inspection = createInspection({
        rooms: [],
      })
      const result = await generateInspectionProtocolPdf(inspection)

      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle inspection with rooms but no remarks', async () => {
      const inspection = createInspection({
        rooms: [
          {
            room: 'Kök',
            remarks: [],
          },
        ],
      })
      const result = await generateInspectionProtocolPdf(inspection)

      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle inspection with multiple rooms and remarks', async () => {
      const inspection = createInspection({
        rooms: [
          {
            room: 'Living Room',
            remarks: [
              {
                remarkId: 'R1',
                location: 'Living Room',
                buildingComponent: 'Wall',
                notes: 'Some damage',
                remarkGrade: 2,
                remarkStatus: 'Open',
                cost: 500,
                invoice: true,
                quantity: 1,
                isMissing: false,
                fixedDate: new Date().toISOString(),
                workOrderCreated: false,
                workOrderStatus: null,
              },
            ],
          },
          {
            room: 'Bedroom',
            remarks: [],
          },
        ],
      })
      const result = await generateInspectionProtocolPdf(inspection)

      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('includeCosts option', () => {
    it('should generate valid PDF with includeCosts: false', async () => {
      const inspection = createInspection({
        rooms: [
          {
            room: 'Kök',
            remarks: [
              {
                remarkId: 'R1',
                location: 'Kök',
                buildingComponent: 'Golv',
                notes: 'Repor i golvet',
                remarkGrade: 2,
                remarkStatus: 'Open',
                cost: 1500,
                invoice: true,
                quantity: 1,
                isMissing: false,
                fixedDate: new Date().toISOString(),
                workOrderCreated: false,
                workOrderStatus: null,
              },
            ],
          },
        ],
      })
      const result = await generateInspectionProtocolPdf(inspection, {
        includeCosts: false,
      })

      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBeGreaterThan(0)

      const pdfHeader = result.toString('utf-8', 0, 5)
      expect(pdfHeader).toBe('%PDF-')
    })

    it('should not contain cost-related text when includeCosts is false', async () => {
      const inspection = createInspection({
        rooms: [
          {
            room: 'Kök',
            remarks: [
              {
                remarkId: 'R1',
                location: 'Kök',
                buildingComponent: 'Golv',
                notes: 'Repor i golvet',
                remarkGrade: 2,
                remarkStatus: 'Open',
                cost: 1500,
                invoice: true,
                quantity: 1,
                isMissing: false,
                fixedDate: new Date().toISOString(),
                workOrderCreated: false,
                workOrderStatus: null,
              },
            ],
          },
        ],
      })
      const result = await generateInspectionProtocolPdf(inspection, {
        includeCosts: false,
      })
      const pdfContent = result.toString('utf-8')

      expect(pdfContent).not.toContain('Kostnad (Kr)')
      expect(pdfContent).not.toContain('SUMMA')
      expect(pdfContent).not.toContain('vad det kommer kosta')
    })

    it('should generate a larger PDF when includeCosts is true (includes cost column and summary)', async () => {
      const inspection = createInspection({
        rooms: [
          {
            room: 'Kök',
            remarks: [
              {
                remarkId: 'R1',
                location: 'Kök',
                buildingComponent: 'Golv',
                notes: 'Repor i golvet',
                remarkGrade: 2,
                remarkStatus: 'Open',
                cost: 1500,
                invoice: true,
                quantity: 1,
                isMissing: false,
                fixedDate: new Date().toISOString(),
                workOrderCreated: false,
                workOrderStatus: null,
              },
            ],
          },
        ],
      })
      const withCosts = await generateInspectionProtocolPdf(inspection, {
        includeCosts: true,
      })
      const withoutCosts = await generateInspectionProtocolPdf(inspection, {
        includeCosts: false,
      })

      // PDF with costs should be larger than without (extra column + summary row)
      expect(withCosts.length).toBeGreaterThan(withoutCosts.length)
    })

    it('should default to including costs when no options provided', async () => {
      const inspection = createInspection({
        rooms: [
          {
            room: 'Kök',
            remarks: [
              {
                remarkId: 'R1',
                location: 'Kök',
                buildingComponent: 'Golv',
                notes: 'Repor i golvet',
                remarkGrade: 2,
                remarkStatus: 'Open',
                cost: 1500,
                invoice: true,
                quantity: 1,
                isMissing: false,
                fixedDate: new Date().toISOString(),
                workOrderCreated: false,
                workOrderStatus: null,
              },
            ],
          },
        ],
      })
      const defaultResult = await generateInspectionProtocolPdf(inspection)
      const withCosts = await generateInspectionProtocolPdf(inspection, {
        includeCosts: true,
      })

      // Default should produce same size as explicit includeCosts: true
      expect(defaultResult.length).toBe(withCosts.length)
    })
  })
})
