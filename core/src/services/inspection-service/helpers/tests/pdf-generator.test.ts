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
      await expect(
        generateInspectionProtocolPdf(null as any)
      ).rejects.toThrow('Invalid inspection: inspection object is null or undefined')
    })

    it('should throw error when inspection is undefined', async () => {
      await expect(
        generateInspectionProtocolPdf(undefined as any)
      ).rejects.toThrow('Invalid inspection: inspection object is null or undefined')
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
})
