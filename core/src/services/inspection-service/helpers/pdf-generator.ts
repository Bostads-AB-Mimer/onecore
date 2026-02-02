import PDFDocument from 'pdfkit'
import type { DetailedInspection } from '../schemas'
import path from 'path'

// ============================================================================
// CONSTANTS
// ============================================================================

// Colors
const COLORS = {
  BLUE: '#0077BE',
  TABLE_HEADER: '#0088CC',
  LIGHT_GRAY: '#F5F5F5',
  BLACK: '#000000',
  WHITE: '#FFFFFF',
  BORDER_GRAY: '#CCCCCC',
  TEXT_GRAY: '#666666',
} as const

// Page Layout
const LAYOUT = {
  PAGE_SIZE: 'A4' as const,
  MARGIN: 40,
  LOGO_WIDTH: 180,
  FOOTER_MARGIN: 30,
  PAGE_BOTTOM_THRESHOLD: 80,
  PAGE_BOTTOM_THRESHOLD_SUMMARY: 60,
} as const

// Typography
const FONT_SIZES = {
  TINY: 8,
  SMALL: 9,
  MEDIUM: 10,
  LARGE: 12,
  X_LARGE: 14,
  TITLE: 28,
} as const

// Spacing
const SPACING = {
  CELL_PADDING_SMALL: 2,
  CELL_PADDING: 3,
  CELL_PADDING_MEDIUM: 4,
  CELL_PADDING_LARGE: 6,
  ROW_PADDING: 12,
  SECTION_GAP: 20,
  MOVE_DOWN_SMALL: 0.3,
  MOVE_DOWN_MEDIUM: 1,
  LABEL_VALUE_GAP: 2,
} as const

// Table Dimensions
const TABLE = {
  HEADER_HEIGHT: 20,
  MIN_CELL_HEIGHT: 25,
  MIN_ROW_HEIGHT: 20,
  BORDER_WIDTH: 0.5,
  SUMMARY_HEIGHT: 25,
} as const

// Remarks Table Column Widths
const REMARKS_COLUMNS = {
  ROOM: 60,
  COMPONENT: 90,
  DESCRIPTION: 180,
  ACTION: 110,
  COST: 70,
} as const

// Positions (Y coordinates)
const POSITIONS = {
  LOGO_TOP: 30,
  COMPANY_INFO_TOP: 75,
  TITLE_TOP: 160,
  ABOUT_SECTION_TOP: 210,
} as const

// Assets
const LOGO_PATH = path.join(
  process.cwd(),
  '../libs/assets/images/mimer-logo.png'
)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats a date string to Swedish locale format (YYYY-MM-DD)
 */
function formatSwedishDate(date: string | Date | undefined | null): string {
  if (!date) return ''
  try {
    return new Date(date).toLocaleDateString('sv-SE')
  } catch {
    return ''
  }
}

/**
 * Formats current date and time to Swedish locale format
 */
function formatSwedishDateTime(): string {
  const now = new Date()
  return `${now.toLocaleDateString('sv-SE')} ${now.toLocaleTimeString('sv-SE')}`
}

/**
 * Safely gets a string value or returns empty string
 */
function safeString(value: string | number | undefined | null): string {
  return value?.toString() ?? ''
}

/**
 * Calculates X position for column in remarks table
 */
function getRemarksColumnX(columnIndex: number): number {
  const cols = [
    LAYOUT.MARGIN,
    LAYOUT.MARGIN + REMARKS_COLUMNS.ROOM,
    LAYOUT.MARGIN + REMARKS_COLUMNS.ROOM + REMARKS_COLUMNS.COMPONENT,
    LAYOUT.MARGIN +
      REMARKS_COLUMNS.ROOM +
      REMARKS_COLUMNS.COMPONENT +
      REMARKS_COLUMNS.DESCRIPTION,
    LAYOUT.MARGIN +
      REMARKS_COLUMNS.ROOM +
      REMARKS_COLUMNS.COMPONENT +
      REMARKS_COLUMNS.DESCRIPTION +
      REMARKS_COLUMNS.ACTION,
  ]
  return cols[columnIndex] ?? LAYOUT.MARGIN
}

/**
 * Extracts inspection data into a structured format for display
 */
function extractInspectionData(inspection: DetailedInspection) {
  return {
    id: safeString(inspection.id),
    residenceId: safeString(inspection.residenceId),
    date: formatSwedishDate(inspection.date),
    address: safeString(inspection.address),
    leaseStartDate: formatSwedishDate(inspection.lease?.leaseStartDate),
    areaSize: safeString(inspection.residence?.areaSize),
    residenceType: safeString(inspection.residence?.type?.name),
    isFurnished: inspection.isFurnished ? 'Ja' : 'Nej',
    tenantPresent: inspection.isTenantPresent
      ? 'Ja'
      : inspection.isNewTenantPresent
        ? 'Ja'
        : 'Nej',
  }
}

/**
 * Checks if content fits on current page
 */
function fitsOnPage(
  doc: InstanceType<typeof PDFDocument>,
  currentY: number,
  contentHeight: number,
  bottomThreshold: number = LAYOUT.PAGE_BOTTOM_THRESHOLD
): boolean {
  return currentY + contentHeight <= doc.page.height - bottomThreshold
}

/**
 * Renders the header section with logo and company information
 */
function renderHeader(doc: InstanceType<typeof PDFDocument>): void {
  try {
    doc.image(LOGO_PATH, LAYOUT.MARGIN, POSITIONS.LOGO_TOP, {
      width: LAYOUT.LOGO_WIDTH,
    })
  } catch (error) {
    // If logo can't be loaded, continue without it
    console.error('Could not load logo:', error)
  }

  // Company information below logo
  doc
    .fontSize(FONT_SIZES.TINY)
    .fillColor(COLORS.BLACK)
    .font('Helvetica-Bold')
    .text('Bostads AB Mimer', LAYOUT.MARGIN, POSITIONS.COMPANY_INFO_TOP, {
      continued: true,
    })
    .font('Helvetica')
    .text(', Box 1170, 721 29 Västerås')

  doc
    .fontSize(FONT_SIZES.TINY)
    .text('Besöksadress: Gåsverksgatan 7', LAYOUT.MARGIN, doc.y)
    .text('Tel: 021-39 70 00', LAYOUT.MARGIN, doc.y)

  doc
    .fillColor(COLORS.BLUE)
    .text('Webb: ', LAYOUT.MARGIN, doc.y, { continued: true, underline: false })
    .fillColor(COLORS.BLUE)
    .text('www.mimer.nu', { link: 'https://www.mimer.nu', underline: true })
}

/**
 * Renders the footer with page numbers and generation timestamp on all pages
 */
function renderFooter(
  doc: InstanceType<typeof PDFDocument>,
  pageWidth: number
): void {
  // Force PDFKit to finalize pages before getting page range
  doc.flushPages()
  const pageRange = doc.bufferedPageRange()

  for (let i = 0; i < pageRange.count; i++) {
    doc.switchToPage(pageRange.start + i)
    const footerText = `Sida ${i + 1} av ${pageRange.count} • Genererad ${formatSwedishDateTime()}`

    doc
      .fontSize(FONT_SIZES.TINY)
      .fillColor(COLORS.TEXT_GRAY)
      .text(footerText, LAYOUT.MARGIN, doc.page.height - LAYOUT.FOOTER_MARGIN, {
        align: 'center',
        width: pageWidth,
        lineBreak: false,
      })
  }
}

/**
 * Draws the header row for the remarks table
 */
function drawRemarksTableHeader(
  doc: InstanceType<typeof PDFDocument>,
  currentY: number,
  pageWidth: number
): number {
  const colWidths = {
    room: REMARKS_COLUMNS.ROOM,
    component: REMARKS_COLUMNS.COMPONENT,
    description: REMARKS_COLUMNS.DESCRIPTION,
    action: REMARKS_COLUMNS.ACTION,
    cost: REMARKS_COLUMNS.COST,
  }

  // Header background
  doc
    .fillColor(COLORS.TABLE_HEADER)
    .rect(LAYOUT.MARGIN, currentY, pageWidth, TABLE.HEADER_HEIGHT)
    .fill()

  // Header text
  doc
    .fontSize(FONT_SIZES.SMALL)
    .fillColor(COLORS.WHITE)
    .font('Helvetica-Bold')
    .text(
      'Rum',
      getRemarksColumnX(0) + SPACING.CELL_PADDING_SMALL,
      currentY + 6,
      {
        width: colWidths.room,
      }
    )
    .text(
      'Byggnadsdel',
      getRemarksColumnX(1) + SPACING.CELL_PADDING_SMALL,
      currentY + 6,
      {
        width: colWidths.component,
      }
    )
    .text(
      'Beskrivning',
      getRemarksColumnX(2) + SPACING.CELL_PADDING_SMALL,
      currentY + 6,
      {
        width: colWidths.description,
      }
    )
    .text(
      'Åtgärd',
      getRemarksColumnX(3) + SPACING.CELL_PADDING_SMALL,
      currentY + 6,
      {
        width: colWidths.action,
      }
    )
    .text(
      'Kostnad (Kr)',
      getRemarksColumnX(4) + SPACING.CELL_PADDING_SMALL,
      currentY + 6,
      {
        width: colWidths.cost,
        align: 'right',
      }
    )

  return currentY + TABLE.HEADER_HEIGHT
}

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

/**
 * Generates a PDF buffer for an inspection protocol
 *
 * @param inspection - The detailed inspection data
 * @returns Promise that resolves to a PDF buffer
 * @throws Error if inspection data is invalid or PDF generation fails
 */
export async function generateInspectionProtocolPdf(
  inspection: DetailedInspection
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Validate inspection data
      if (!inspection) {
        throw new Error(
          'Invalid inspection: inspection object is null or undefined'
        )
      }
      if (!inspection.id) {
        throw new Error('Invalid inspection: missing required ID')
      }
      if (!inspection.date) {
        throw new Error('Invalid inspection: missing required date')
      }
      if (!inspection.address) {
        throw new Error('Invalid inspection: missing required address')
      }

      const doc = new PDFDocument({
        margin: LAYOUT.MARGIN,
        size: LAYOUT.PAGE_SIZE,
      })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', (err) => {
        console.error('PDF generation error:', err)
        reject(new Error(`PDF generation failed: ${err.message}`))
      })

      const pageWidth = doc.page.width - LAYOUT.MARGIN * 2
      const data = extractInspectionData(inspection)

      // Header with logo and company information
      renderHeader(doc)

      // Blue title
      doc
        .fontSize(FONT_SIZES.TITLE)
        .fillColor(COLORS.BLUE)
        .font('Helvetica-Bold')
        .text('BESIKTNINGSPROTOKOLL', LAYOUT.MARGIN, POSITIONS.TITLE_TOP)

      // "Om bostaden" section header
      doc
        .fontSize(FONT_SIZES.LARGE)
        .fillColor(COLORS.BLACK)
        .font('Helvetica-Bold')
        .text('Om bostaden', LAYOUT.MARGIN, POSITIONS.ABOUT_SECTION_TOP)
      doc.moveDown(SPACING.MOVE_DOWN_SMALL)

      // Information table
      const tableTop = doc.y
      const colWidths = [pageWidth / 3, pageWidth / 3, pageWidth / 3]

      // Row 1
      const row1Height = Math.max(
        calculateCellHeight(doc, colWidths[0], 'Besiktningsnummer:', data.id),
        calculateCellHeight(
          doc,
          colWidths[1],
          'Objektsnummer:',
          data.residenceId
        ),
        calculateCellHeight(
          doc,
          colWidths[2],
          'Besiktningsdatum och tid:',
          data.date
        )
      )
      drawTableCell(
        doc,
        LAYOUT.MARGIN,
        tableTop,
        colWidths[0],
        row1Height,
        'Besiktningsnummer:',
        data.id,
        true
      )
      drawTableCell(
        doc,
        LAYOUT.MARGIN + colWidths[0],
        tableTop,
        colWidths[1],
        row1Height,
        'Objektsnummer:',
        data.residenceId,
        true
      )
      drawTableCell(
        doc,
        LAYOUT.MARGIN + colWidths[0] + colWidths[1],
        tableTop,
        colWidths[2],
        row1Height,
        'Besiktningsdatum och tid:',
        data.date,
        true
      )

      // Row 2
      const row2Top = tableTop + row1Height
      const row2Height = Math.max(
        calculateCellHeight(doc, colWidths[0] * 2, 'Adress:', data.address),
        calculateCellHeight(
          doc,
          colWidths[2],
          'Inflyttningsdatum:',
          data.leaseStartDate
        )
      )
      drawTableCell(
        doc,
        LAYOUT.MARGIN,
        row2Top,
        colWidths[0] * 2,
        row2Height,
        'Adress:',
        data.address,
        true
      )
      drawTableCell(
        doc,
        LAYOUT.MARGIN + colWidths[0] * 2,
        row2Top,
        colWidths[2],
        row2Height,
        'Inflyttningsdatum:',
        data.leaseStartDate,
        true
      )

      // Row 3
      const row3Top = row2Top + row2Height
      const row3Height = Math.max(
        calculateCellHeight(
          doc,
          colWidths[0],
          'Lägenhetsstorlek:',
          data.areaSize
        ),
        calculateCellHeight(
          doc,
          colWidths[1],
          'Lägenhetstyp:',
          data.residenceType
        ),
        calculateCellHeight(
          doc,
          colWidths[2] / 2,
          'Möblerad under besiktning:',
          data.isFurnished
        ),
        calculateCellHeight(
          doc,
          colWidths[2] / 2,
          'Hyresgäst närvarande:',
          data.tenantPresent
        )
      )
      drawTableCell(
        doc,
        LAYOUT.MARGIN,
        row3Top,
        colWidths[0],
        row3Height,
        'Lägenhetsstorlek:',
        data.areaSize,
        false
      )
      drawTableCell(
        doc,
        LAYOUT.MARGIN + colWidths[0],
        row3Top,
        colWidths[1],
        row3Height,
        'Lägenhetstyp:',
        data.residenceType,
        false
      )
      drawTableCell(
        doc,
        LAYOUT.MARGIN + colWidths[0] + colWidths[1],
        row3Top,
        colWidths[2] / 2,
        row3Height,
        'Möblerad under besiktning:',
        data.isFurnished,
        false
      )
      drawTableCell(
        doc,
        LAYOUT.MARGIN + colWidths[0] + colWidths[1] + colWidths[2] / 2,
        row3Top,
        colWidths[2] / 2,
        row3Height,
        'Hyresgäst närvarande:',
        data.tenantPresent,
        false
      )

      doc.y = row3Top + row3Height + SPACING.SECTION_GAP

      // "Anmärkningar" section
      doc
        .fontSize(FONT_SIZES.X_LARGE)
        .fillColor(COLORS.BLACK)
        .font('Helvetica-Bold')
        .text('Anmärkningar', LAYOUT.MARGIN, doc.y)
      doc.moveDown(SPACING.MOVE_DOWN_SMALL)

      doc
        .fontSize(FONT_SIZES.SMALL)
        .font('Helvetica')
        .text(
          'Här beskriver vi vilka besiktningsanmärkningar som finns registrerade i vilket rum. Du ser även om du behöver åtgärda något samt vad det kommer kosta.',
          LAYOUT.MARGIN,
          doc.y,
          { width: pageWidth }
        )
      doc.moveDown(SPACING.MOVE_DOWN_MEDIUM)

      // Remarks table
      const remarksTableTop = doc.y
      drawRemarksTable(doc, inspection, remarksTableTop, pageWidth)

      // Footer with generation timestamp
      renderFooter(doc, pageWidth)

      doc.end()
    } catch (error) {
      console.error('Error generating inspection protocol PDF:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during PDF generation'
      reject(
        new Error(`Failed to generate inspection protocol: ${errorMessage}`)
      )
    }
  })
}

/**
 * Calculate the required height for a cell based on its content
 *
 * @param doc - PDFKit document instance
 * @param width - Cell width in points
 * @param label - Cell label text
 * @param value - Cell value text
 * @returns Calculated height in points
 */
function calculateCellHeight(
  doc: InstanceType<typeof PDFDocument>,
  width: number,
  label: string,
  value: string
): number {
  // Calculate label text height
  doc.fontSize(FONT_SIZES.TINY).font('Helvetica-Bold')
  const labelHeight = doc.heightOfString(label, {
    width: width - SPACING.CELL_PADDING_LARGE,
  })

  // Calculate value text height
  doc.fontSize(FONT_SIZES.TINY).font('Helvetica')
  const valueHeight = doc.heightOfString(value, {
    width: width - SPACING.CELL_PADDING_LARGE,
  })

  return Math.max(
    TABLE.MIN_CELL_HEIGHT,
    labelHeight +
      valueHeight +
      SPACING.CELL_PADDING_LARGE +
      SPACING.LABEL_VALUE_GAP
  )
}

/**
 * Draw a table cell with label and value
 *
 * @param doc - PDFKit document instance
 * @param x - X coordinate in points
 * @param y - Y coordinate in points
 * @param width - Cell width in points
 * @param height - Cell height in points
 * @param label - Cell label text (bold)
 * @param value - Cell value text
 * @param hasBottomBorder - Whether to draw a bottom border
 */
function drawTableCell(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  hasBottomBorder: boolean
) {
  // Draw border
  doc
    .strokeColor(COLORS.BLACK)
    .lineWidth(TABLE.BORDER_WIDTH)
    .rect(x, y, width, height)
    .stroke()

  // Draw label
  doc
    .fontSize(FONT_SIZES.TINY)
    .fillColor(COLORS.BLACK)
    .font('Helvetica-Bold')
    .text(label, x + SPACING.CELL_PADDING, y + SPACING.CELL_PADDING, {
      width: width - SPACING.CELL_PADDING * 2,
      lineBreak: true,
    })

  // Draw value (positioned below label)
  const labelHeight = doc.heightOfString(label, {
    width: width - SPACING.CELL_PADDING * 2,
  })
  doc
    .fontSize(FONT_SIZES.TINY)
    .font('Helvetica')
    .text(
      value,
      x + SPACING.CELL_PADDING,
      y + SPACING.CELL_PADDING + labelHeight + SPACING.LABEL_VALUE_GAP,
      {
        width: width - SPACING.CELL_PADDING * 2,
        lineBreak: true,
      }
    )

  // Bottom border if needed
  if (hasBottomBorder) {
    doc
      .strokeColor(COLORS.BLACK)
      .lineWidth(TABLE.BORDER_WIDTH)
      .moveTo(x, y + height)
      .lineTo(x + width, y + height)
      .stroke()
  }
}

/**
 * Calculate the required height for a table row based on its content
 *
 * @param doc - PDFKit document instance
 * @param colWidths - Column widths for each cell
 * @param room - Room name text
 * @param component - Building component text
 * @param description - Description text
 * @param action - Action/status text
 * @returns Calculated row height in points
 */
function calculateRowHeight(
  doc: InstanceType<typeof PDFDocument>,
  colWidths: {
    room: number
    component: number
    description: number
    action: number
    cost: number
  },
  room: string,
  component: string,
  description: string,
  action: string
): number {
  doc.fontSize(FONT_SIZES.TINY).font('Helvetica')

  // Calculate heights for each column
  const roomHeight = doc.heightOfString(room, {
    width: colWidths.room - SPACING.CELL_PADDING_MEDIUM,
  })
  const componentHeight = doc.heightOfString(component, {
    width: colWidths.component - SPACING.CELL_PADDING_MEDIUM,
  })
  const descriptionHeight = doc.heightOfString(description, {
    width: colWidths.description - SPACING.CELL_PADDING_MEDIUM,
  })
  const actionHeight = doc.heightOfString(action, {
    width: colWidths.action - SPACING.CELL_PADDING_MEDIUM,
  })

  // Return the maximum height plus padding
  return Math.max(
    TABLE.MIN_ROW_HEIGHT,
    Math.max(roomHeight, componentHeight, descriptionHeight, actionHeight) +
      SPACING.ROW_PADDING
  )
}

/**
 * Draw the remarks table with all inspection remarks
 *
 * @param doc - PDFKit document instance
 * @param inspection - The inspection data containing rooms and remarks
 * @param startY - Starting Y coordinate for the table
 * @param pageWidth - Available page width for the table
 */
function drawRemarksTable(
  doc: InstanceType<typeof PDFDocument>,
  inspection: DetailedInspection,
  startY: number,
  pageWidth: number
) {
  // Cache column widths to avoid recreating object
  const colWidths = {
    room: REMARKS_COLUMNS.ROOM,
    component: REMARKS_COLUMNS.COMPONENT,
    description: REMARKS_COLUMNS.DESCRIPTION,
    action: REMARKS_COLUMNS.ACTION,
    cost: REMARKS_COLUMNS.COST,
  }
  let currentY = startY

  // Draw header row
  currentY = drawRemarksTableHeader(doc, currentY, pageWidth)
  let totalCost = 0

  // Data rows - validate rooms data
  const rooms = inspection.rooms || []
  if (rooms.length === 0) {
    console.warn('No rooms found in inspection data')
  }

  rooms.forEach((room, roomIndex) => {
    if (!room.remarks || room.remarks.length === 0) {
      // Room with no remarks
      const rowHeight = calculateRowHeight(
        doc,
        colWidths,
        safeString(room.room),
        'Utan anmärkning',
        '',
        'OK'
      )

      if (!fitsOnPage(doc, currentY, rowHeight)) {
        doc.addPage()
        currentY = drawRemarksTableHeader(doc, LAYOUT.MARGIN, pageWidth)
      }

      // Alternating background
      if (roomIndex % 2 === 0) {
        doc
          .fillColor(COLORS.LIGHT_GRAY)
          .rect(LAYOUT.MARGIN, currentY, pageWidth, rowHeight)
          .fill()
      }

      drawTableRow(
        doc,
        LAYOUT.MARGIN,
        currentY,
        colWidths,
        rowHeight,
        safeString(room.room),
        'Utan anmärkning',
        '',
        'OK',
        0
      )
      currentY += rowHeight
    } else {
      // Room with remarks
      room.remarks.forEach((remark, remarkIndex) => {
        const rowHeight = calculateRowHeight(
          doc,
          colWidths,
          remarkIndex === 0 ? safeString(room.room) : '',
          safeString(remark.buildingComponent),
          safeString(remark.notes),
          safeString(remark.remarkStatus) || 'OK'
        )

        if (!fitsOnPage(doc, currentY, rowHeight)) {
          doc.addPage()
          currentY = drawRemarksTableHeader(doc, LAYOUT.MARGIN, pageWidth)
        }

        // Alternating background
        if ((roomIndex + remarkIndex) % 2 === 0) {
          doc
            .fillColor(COLORS.LIGHT_GRAY)
            .rect(LAYOUT.MARGIN, currentY, pageWidth, rowHeight)
            .fill()
        }

        const cost = remark.cost || 0
        totalCost += cost

        drawTableRow(
          doc,
          LAYOUT.MARGIN,
          currentY,
          colWidths,
          rowHeight,
          remarkIndex === 0 ? safeString(room.room) : '', // Only show room name on first remark
          safeString(remark.buildingComponent),
          safeString(remark.notes),
          safeString(remark.remarkStatus) || 'OK',
          cost
        )
        currentY += rowHeight
      })
    }
  })

  // Summary row
  if (
    !fitsOnPage(
      doc,
      currentY,
      TABLE.SUMMARY_HEIGHT,
      LAYOUT.PAGE_BOTTOM_THRESHOLD_SUMMARY
    )
  ) {
    doc.addPage()
    currentY = LAYOUT.MARGIN
  }

  doc
    .fillColor(COLORS.TABLE_HEADER)
    .rect(LAYOUT.MARGIN, currentY, pageWidth, TABLE.SUMMARY_HEIGHT)
    .fill()

  doc
    .fontSize(FONT_SIZES.MEDIUM)
    .fillColor(COLORS.WHITE)
    .font('Helvetica-Bold')
    .text('SUMMA', LAYOUT.MARGIN + SPACING.CELL_PADDING_SMALL, currentY + 6)
    .text(
      totalCost.toString(),
      getRemarksColumnX(4) + SPACING.CELL_PADDING_SMALL,
      currentY + 6,
      { width: colWidths.cost - SPACING.CELL_PADDING_MEDIUM, align: 'right' }
    )
}

/**
 * Draw a table row in the remarks table
 *
 * @param doc - PDFKit document instance
 * @param x - Starting X coordinate
 * @param y - Starting Y coordinate
 * @param colWidths - Column widths for each cell
 * @param height - Row height in points
 * @param room - Room name text
 * @param component - Building component text
 * @param description - Description text
 * @param action - Action/status text
 * @param cost - Cost value
 */
function drawTableRow(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  colWidths: {
    room: number
    component: number
    description: number
    action: number
    cost: number
  },
  height: number,
  room: string,
  component: string,
  description: string,
  action: string,
  cost: number
) {
  // Cache padding values to avoid repeated property access
  const textPadding = SPACING.CELL_PADDING_MEDIUM
  const cellPadding = SPACING.CELL_PADDING_SMALL

  // Pre-calculate column X positions
  const col1X = x
  const col2X = x + colWidths.room
  const col3X = col2X + colWidths.component
  const col4X = col3X + colWidths.description
  const col5X = col4X + colWidths.action

  // Draw borders for all columns
  doc.strokeColor(COLORS.BORDER_GRAY).lineWidth(TABLE.BORDER_WIDTH)
  doc.rect(col1X, y, colWidths.room, height).stroke()
  doc.rect(col2X, y, colWidths.component, height).stroke()
  doc.rect(col3X, y, colWidths.description, height).stroke()
  doc.rect(col4X, y, colWidths.action, height).stroke()
  doc.rect(col5X, y, colWidths.cost, height).stroke()

  // Calculate text heights for vertical centering
  doc.fontSize(FONT_SIZES.TINY).font('Helvetica')
  const roomHeight = room
    ? doc.heightOfString(room, { width: colWidths.room - textPadding })
    : 0
  const componentHeight = component
    ? doc.heightOfString(component, {
        width: colWidths.component - textPadding,
      })
    : 0
  const descriptionHeight = description
    ? doc.heightOfString(description, {
        width: colWidths.description - textPadding,
      })
    : 0
  const actionHeight = action
    ? doc.heightOfString(action, { width: colWidths.action - textPadding })
    : 0
  const costText = cost > 0 ? cost.toString() : '0'
  const costHeight = doc.heightOfString(costText, {
    width: colWidths.cost - textPadding,
  })

  // Draw text (vertically centered in each cell)
  doc
    .fontSize(FONT_SIZES.TINY)
    .fillColor(COLORS.BLACK)
    .font('Helvetica')
    .text(room, col1X + cellPadding, y + (height - roomHeight) / 2, {
      width: colWidths.room - textPadding,
    })
    .text(component, col2X + cellPadding, y + (height - componentHeight) / 2, {
      width: colWidths.component - textPadding,
    })
    .text(
      description,
      col3X + cellPadding,
      y + (height - descriptionHeight) / 2,
      {
        width: colWidths.description - textPadding,
      }
    )
    .text(action, col4X + cellPadding, y + (height - actionHeight) / 2, {
      width: colWidths.action - textPadding,
    })
    .text(costText, col5X + cellPadding, y + (height - costHeight) / 2, {
      width: colWidths.cost - textPadding,
      align: 'right',
    })
}
