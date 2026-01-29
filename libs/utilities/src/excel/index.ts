/**
 * Excel export utility for creating Excel files from data arrays
 * Uses ExcelJS for spreadsheet generation
 */

import type { PaginatedResponse } from '../pagination'

export interface ExcelColumn {
  /** Column header text displayed in first row */
  header: string
  /** Key used for mapping row data to this column */
  key: string
  /** Column width in characters (default: 15) */
  width?: number
  /** Optional Excel cell style */
  style?: {
    /** Number format string (e.g., 'yyyy-mm-dd' for dates) */
    numFmt?: string
  }
}

export interface ExcelExportOptions<T> {
  /** Name of the worksheet tab */
  sheetName: string
  /** Column definitions with headers and keys */
  columns: ExcelColumn[]
  /** Array of data items to export */
  data: T[]
  /** Function to transform each data item into a row object */
  rowMapper: (item: T) => Record<string, unknown>
  /** Optional header row styling (default: bold) */
  headerStyle?: {
    bold?: boolean
  }
}

/**
 * Create an Excel file from data using specified columns and row mapper
 *
 * @example
 * ```typescript
 * const buffer = await createExcelExport({
 *   sheetName: 'Users',
 *   columns: [
 *     { header: 'Name', key: 'name', width: 30 },
 *     { header: 'Email', key: 'email', width: 40 },
 *     { header: 'Created', key: 'created', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
 *   ],
 *   data: users,
 *   rowMapper: (user) => ({
 *     name: user.fullName,
 *     email: user.emailAddress,
 *     created: user.createdAt,
 *   }),
 * })
 * ```
 *
 * @param options - Export configuration
 * @returns Buffer containing the Excel file
 */
export async function createExcelExport<T>(
  options: ExcelExportOptions<T>
): Promise<Buffer> {
  const {
    sheetName,
    columns,
    data,
    rowMapper,
    headerStyle = { bold: true },
  } = options

  // Dynamic import to avoid loading ExcelJS on every request
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.default.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)

  // Set up columns with defaults
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 15,
    style: col.style,
  }))

  // Apply header styling
  if (headerStyle.bold) {
    worksheet.getRow(1).font = { bold: true }
  }

  // Add data rows using the rowMapper
  for (const item of data) {
    worksheet.addRow(rowMapper(item))
  }

  // Generate and return buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Format a date value for Excel export using Swedish locale
 * Returns empty string for null/undefined values
 *
 * @param date - Date value (string, Date, or null/undefined)
 * @returns Formatted date string (YYYY-MM-DD) or empty string
 */
export function formatDateForExcel(
  date: Date | string | null | undefined
): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('sv-SE')
}

/**
 * Join array items into a delimited string for Excel export
 * Filters out null/undefined values before joining
 *
 * @example
 * ```typescript
 * // Basic usage
 * joinField(contacts, c => c.name) // "John; Jane; Bob"
 *
 * // With custom separator
 * joinField(tags, t => t.label, ', ') // "urgent, review, pending"
 * ```
 *
 * @param items - Array of items to process
 * @param accessor - Function to extract the value from each item
 * @param separator - Delimiter between values (default: '; ')
 * @returns Joined string or empty string if no valid values
 */
export function joinField<T>(
  items: T[],
  accessor: (item: T) => string | null | undefined,
  separator = '; '
): string {
  return items
    .map(accessor)
    .filter((value): value is string => value != null && value !== '')
    .join(separator)
}

/**
 * Set standard HTTP response headers for Excel file download
 * Use this in route handlers to ensure consistent download behavior
 *
 * @example
 * ```typescript
 * const buffer = await exportToExcel(data)
 * setExcelDownloadHeaders(ctx, 'report')
 * ctx.body = buffer
 * ```
 *
 * @param ctx - Koa context object
 * @param filename - Base filename without extension or timestamp
 */
export function setExcelDownloadHeaders(
  ctx: { set: (key: string, value: string) => void; status: number },
  filename: string
): void {
  const timestamp = new Date().toISOString().split('T')[0]
  ctx.set(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  ctx.set(
    'Content-Disposition',
    `attachment; filename="${filename}-${timestamp}.xlsx"`
  )
  ctx.status = 200
}

/**
 * Create Excel export from a paginated endpoint using streaming
 * Writes rows incrementally as pages are fetched - keeps memory low
 *
 * Uses ExcelJS WorkbookWriter which flushes rows to buffer as they're committed,
 * rather than holding all data in memory.
 *
 * @example
 * ```typescript
 * const buffer = await createExcelFromPaginated(
 *   (page, limit) => searchLeases({ ...filters, page, limit }),
 *   {
 *     sheetName: 'Hyreskontrakt',
 *     columns: [
 *       { header: 'Kontraktsnummer', key: 'leaseId', width: 18 },
 *       { header: 'Hyresgäst', key: 'tenantName', width: 30 },
 *     ],
 *     rowMapper: (lease) => ({
 *       leaseId: lease.leaseId,
 *       tenantName: lease.tenantName,
 *     }),
 *     batchSize: 1000,
 *   }
 * )
 * ```
 *
 * @param fetcher - Function that fetches a single page (must accept page, limit params)
 * @param options - Excel export options plus optional batchSize (default: 500)
 * @returns Buffer containing the Excel file
 */
export async function createExcelFromPaginated<T>(
  fetcher: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
  options: Omit<ExcelExportOptions<T>, 'data'> & { batchSize?: number }
): Promise<Buffer> {
  const {
    sheetName,
    columns,
    rowMapper,
    headerStyle = { bold: true },
    batchSize = 500,
  } = options

  const ExcelJS = await import('exceljs')

  // Create streaming workbook writer (no stream option = uses internal StreamBuf)
  // useSharedStrings: false saves ~30% memory
  const workbook = new ExcelJS.default.stream.xlsx.WorkbookWriter({
    useStyles: true,
    useSharedStrings: false,
  })

  const worksheet = workbook.addWorksheet(sheetName)

  // Set up columns
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 15,
    style: col.style,
  }))

  // Style header row and commit it (must commit to flush to stream)
  if (headerStyle.bold) {
    worksheet.getRow(1).font = { bold: true }
  }
  worksheet.getRow(1).commit()

  // Fetch pages and write rows incrementally
  let page = 1
  let totalFetched = 0

  while (true) {
    const response = await fetcher(page, batchSize)

    // Write each row and commit immediately (flushes to stream buffer)
    for (const item of response.content) {
      const row = worksheet.addRow(rowMapper(item))
      row.commit()
    }

    totalFetched += response.content.length

    // Stop if we've fetched all records or got an empty page
    if (
      totalFetched >= response._meta.totalRecords ||
      response.content.length === 0
    ) {
      break
    }
    page++
  }

  // Commit worksheet and workbook (finalizes the stream)
  worksheet.commit()
  await workbook.commit()

  // Get buffer from internal StreamBuf
  // Cast needed because TypeScript types don't include the stream property
  const stream = (workbook as unknown as { stream: { read: () => Buffer } })
    .stream
  return stream.read()
}
