import {
  formatDateForExcel,
  joinField,
  setExcelDownloadHeaders,
} from '../excel'

describe('formatDateForExcel', () => {
  it('should format Date object to YYYY-MM-DD', () => {
    const date = new Date('2024-03-15T12:00:00Z')
    expect(formatDateForExcel(date)).toBe('2024-03-15')
  })

  it('should format date string to YYYY-MM-DD', () => {
    expect(formatDateForExcel('2024-06-20')).toBe('2024-06-20')
  })

  it('should return empty string for null', () => {
    expect(formatDateForExcel(null)).toBe('')
  })

  it('should return empty string for undefined', () => {
    expect(formatDateForExcel(undefined)).toBe('')
  })

  it('should handle Date with time component', () => {
    const date = new Date('2024-12-25T23:59:59.999Z')
    expect(formatDateForExcel(date)).toBe('2024-12-26') // UTC+1 timezone
  })
})

describe('joinField', () => {
  it('should join array items with default separator', () => {
    const items = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }]
    expect(joinField(items, (i) => i.name)).toBe('Alice; Bob; Charlie')
  })

  it('should join array items with custom separator', () => {
    const items = [{ tag: 'urgent' }, { tag: 'review' }]
    expect(joinField(items, (i) => i.tag, ', ')).toBe('urgent, review')
  })

  it('should filter out null values', () => {
    const items = [{ name: 'Alice' }, { name: null }, { name: 'Charlie' }]
    expect(joinField(items, (i) => i.name)).toBe('Alice; Charlie')
  })

  it('should filter out undefined values', () => {
    const items = [
      { name: 'Alice' },
      { name: undefined },
      { name: 'Charlie' },
    ] as { name: string | undefined }[]
    expect(joinField(items, (i) => i.name)).toBe('Alice; Charlie')
  })

  it('should filter out empty strings', () => {
    const items = [{ name: 'Alice' }, { name: '' }, { name: 'Charlie' }]
    expect(joinField(items, (i) => i.name)).toBe('Alice; Charlie')
  })

  it('should return empty string for empty array', () => {
    expect(joinField([], (i: { name: string }) => i.name)).toBe('')
  })

  it('should handle single item', () => {
    const items = [{ value: 'only' }]
    expect(joinField(items, (i) => i.value)).toBe('only')
  })

  it('should handle array with all null/empty values', () => {
    const items = [{ name: null }, { name: '' }, { name: undefined }] as {
      name: string | null | undefined
    }[]
    expect(joinField(items, (i) => i.name)).toBe('')
  })
})

describe('setExcelDownloadHeaders', () => {
  it('should set correct Content-Type header', () => {
    const headers: Record<string, string> = {}
    const ctx = {
      set: (key: string, value: string) => {
        headers[key] = value
      },
      status: 0,
    }

    setExcelDownloadHeaders(ctx, 'test-report')

    expect(headers['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  })

  it('should set Content-Disposition with filename and date', () => {
    const headers: Record<string, string> = {}
    const ctx = {
      set: (key: string, value: string) => {
        headers[key] = value
      },
      status: 0,
    }

    setExcelDownloadHeaders(ctx, 'hyreskontrakt')

    expect(headers['Content-Disposition']).toMatch(
      /^attachment; filename="hyreskontrakt-\d{4}-\d{2}-\d{2}\.xlsx"$/
    )
  })

  it('should set status to 200', () => {
    const ctx = {
      set: jest.fn(),
      status: 0,
    }

    setExcelDownloadHeaders(ctx, 'report')

    expect(ctx.status).toBe(200)
  })
})

/**
 * Note: createExcelExport and createExcelFromPaginated use dynamic imports
 * (await import('exceljs')) for lazy-loading to improve cold-start performance.
 *
 * Jest doesn't support dynamic imports without --experimental-vm-modules flag.
 * These functions are tested via integration tests through the /leases/export endpoint.
 */
