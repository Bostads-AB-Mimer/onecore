import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import QRCode from 'qrcode'

import type {
  ReceiptData,
  MaintenanceReceiptData,
  Card,
  KeyDetails,
} from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { sortKeys } from '@/utils/sortKeys'

import { registerCustomFonts, FONT_BISON, FONT_GRAPHIK } from './pdf-fonts'
import logoUrl from '../../assets/MimerLogo_RGB_blk-blue.png'

// Layout constants
const PAGE_W = 210
const MARGIN_X = 20
const MARGIN_TOP = 10
const MARGIN_TOP_CONTINUATION = 35
const FOOTER_H = 25
const BLUE = { r: 0, g: 123, b: 196 }
const RED = { r: 200, g: 0, b: 0 }

// Font size constants (matching reference PDF)
const FONT_SIZE = {
  TITLE: 32, // Main title (NYCKELKVITTENS)
  SECTION_HEADER: 18, // NYCKLAR, BEKRÄFTELSE headers
  SUB_HEADER: 12, // Hyresgäst, Avtal
  TABLE_HEADER: 10, // Nyckelnamn, Typ, Löp.nr, Flex.nr
  BODY: 10, // Regular body text
  FOOTER: 8, // Footer text
}

// Content area calculation
const contentBottom = (doc: jsPDF) =>
  (doc.internal.pageSize.height as number) - FOOTER_H

// Logo loading utility
let _logoPromise: Promise<HTMLImageElement | null> | null = null
function loadLogo(): Promise<HTMLImageElement | null> {
  if (_logoPromise) return _logoPromise
  if (typeof Image === 'undefined') {
    _logoPromise = Promise.resolve(null)
    return _logoPromise
  }
  _logoPromise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = logoUrl
  })
  return _logoPromise
}

// Receipt number generation
const generateReceiptNumber = (type: 'loan' | 'return'): string => {
  const now = new Date()
  const timestamp = format(now, 'yyyyMMdd-HHmmss')
  const prefix = type === 'loan' ? 'NYL' : 'NYÅ'
  return `${prefix}-${timestamp}`
}

/**
 * Generates a QR code as a data URL and adds it to the top-right of every page.
 * Only added to loan receipts so scanners can read the loan UUID.
 * QR on every page enables batch scanning — pages are grouped by UUID.
 */
const addQrCode = async (doc: jsPDF, loanId: string): Promise<void> => {
  const qrDataUrl = await QRCode.toDataURL(loanId, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
  const qrSize = 35
  const x = PAGE_W - MARGIN_X - qrSize
  const y = 5
  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page)
    doc.addImage(qrDataUrl, 'PNG', x, y, qrSize, qrSize)
  }
}

/* ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================ */

/**
 * Adds the main title in Bison Bold blue
 */
const addTitle = (doc: jsPDF, type: 'loan' | 'return'): number => {
  doc.setFont(FONT_BISON, 'bold')
  doc.setFontSize(FONT_SIZE.TITLE)
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b)

  const title = type === 'loan' ? 'NYCKELKVITTENS' : 'NYCKELÅTERLÄMNING'
  doc.text(title, MARGIN_X, MARGIN_TOP + 10)

  return MARGIN_TOP + 18
}

/**
 * Adds receipt metadata (Kvittensnummer, Datum, Tid) in Graphik Regular
 */
const addMeta = (doc: jsPDF, y: number, type: 'loan' | 'return'): number => {
  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)
  doc.setTextColor(0, 0, 0)

  const receiptNumber = generateReceiptNumber(type)
  const when = new Date()

  doc.text(`Kvittensnummer: ${receiptNumber}`, MARGIN_X, y)
  y += 5
  doc.text(
    `Datum: ${format(when, 'dd MMMM yyyy', { locale: sv })}`,
    MARGIN_X,
    y
  )
  y += 5
  doc.text(`Tid: ${format(when, 'HH:mm')}`, MARGIN_X, y)

  return y + 8
}

/**
 * Adds tenant info (Hyresgäst) and lease info (Avtal) in two columns
 */
const addTenantInfo = (
  doc: jsPDF,
  data: Pick<
    ReceiptData,
    'tenants' | 'leaseDisplayId' | 'rentalPropertyId' | 'address'
  >,
  y: number
): number => {
  const { tenants } = data
  // All values are pre-resolved by receiptHandlers; this only lays out text.
  const rentalPropertyId = data.rentalPropertyId || '-'
  const leaseId = data.leaseDisplayId ?? null
  const leftCol = MARGIN_X
  const rightCol = 110

  // Section headers - BOLD (Graphik Semibold)
  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.setFontSize(FONT_SIZE.SUB_HEADER)
  doc.setTextColor(0, 0, 0)

  // Left column header
  doc.text('Hyresgäst', leftCol, y)
  // Right column header
  doc.text('Avtal', rightCol, y)

  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)
  let leftY = y + 7
  let rightY = y + 7

  // Left column: Display tenants
  tenants.forEach((tenant) => {
    const name = `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()
    const fullName = name || tenant.fullName || 'Okänt namn'
    const isCompany = tenant.contactCode?.toUpperCase().startsWith('F')
    const idLabel = isCompany ? 'Organisationsnummer' : 'Personnummer'

    doc.text(`Namn: ${fullName}`, leftCol, leftY)
    leftY += 5
    doc.text(
      `${idLabel}: ${tenant.nationalRegistrationNumber || '-'}`,
      leftCol,
      leftY
    )
    leftY += 5
    doc.text(`Kundnummer: ${tenant.contactCode || '-'}`, leftCol, leftY)
    leftY += 8
  })

  // Right column: Display lease info (rental object ID in bold)
  const hyresobjektLabel = 'Hyresobjekt: '
  doc.text(hyresobjektLabel, rightCol, rightY)
  const labelWidth = doc.getTextWidth(hyresobjektLabel)
  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.text(rentalPropertyId, rightCol + labelWidth, rightY)
  doc.setFont(FONT_GRAPHIK, 'normal')
  rightY += 5

  // Wrap long leaseId
  const leaseIdLines = doc.splitTextToSize(`Avtals-ID: ${leaseId || '-'}`, 75)
  doc.text(leaseIdLines, rightCol, rightY)
  rightY += Array.isArray(leaseIdLines) ? leaseIdLines.length * 5 : 5

  doc.text(`Adress: ${data.address || '-'}`, rightCol, rightY)
  rightY += 5

  return Math.max(leftY, rightY) + 6
}

/**
 * Column x-positions for the keys table. The maintenance variant adds a
 * Tillhörighet column between Löp.nr and Flex.nr; tenant keeps the original
 * 6-column layout.
 */
const KEYS_COLS_TENANT = {
  namn: MARGIN_X,
  lassystem: 50,
  lopnr: 90,
  flexnr: 115,
  typ: 145,
  status: 175,
} as const

const KEYS_COLS_MAINTENANCE = {
  namn: MARGIN_X,
  lassystem: 42,
  lopnr: 62,
  scope: 78,
  scopeMax: 136 - 78, // 58mm available before Flex.nr
  flexnr: 136,
  typ: 150,
  status: 175,
} as const

/**
 * Renders table header row for keys table
 */
const renderKeysTableHeader = (
  doc: jsPDF,
  y: number,
  withScope = false
): void => {
  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.setFontSize(FONT_SIZE.TABLE_HEADER)
  if (withScope) {
    const c = KEYS_COLS_MAINTENANCE
    doc.text('Namn', c.namn, y)
    doc.text('Låssystem', c.lassystem, y)
    doc.text('Löp.nr', c.lopnr, y)
    doc.text('Tillhörighet', c.scope, y)
    doc.text('Flex.nr', c.flexnr, y)
    doc.text('Typ', c.typ, y)
    doc.text('Status', c.status, y)
  } else {
    const c = KEYS_COLS_TENANT
    doc.text('Namn', c.namn, y)
    doc.text('Låssystem', c.lassystem, y)
    doc.text('Löp.nr', c.lopnr, y)
    doc.text('Flex.nr', c.flexnr, y)
    doc.text('Typ', c.typ, y)
    doc.text('Status', c.status, y)
  }

  doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, y + 3, PAGE_W - MARGIN_X, y + 3)
}

/**
 * Renders table header row for cards table
 */
const renderCardsTableHeader = (doc: jsPDF, y: number): void => {
  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.setFontSize(FONT_SIZE.TABLE_HEADER)
  doc.text('Namn', MARGIN_X, y)
  doc.text('System', 50, y)
  doc.text('ID', 100, y)
  doc.text('Typ', 145, y)
  doc.text('Status', 175, y)

  doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, y + 3, PAGE_W - MARGIN_X, y + 3)
}

/**
 * Renders a single key row. Returns the height used (lets the caller advance
 * correctly when a long Tillhörighet value wraps to a second line on the
 * maintenance variant).
 */
const renderKeyRow = (
  doc: jsPDF,
  k: KeyDetails,
  y: number,
  scope?: string
): number => {
  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)

  const labelForType =
    (KeyTypeLabels as Record<string, string>)[k.keyType as unknown as string] ||
    (k.keyType as string)
  const systemCode = k.keySystem?.systemCode || '-'
  const status = k.disposed ? 'Kasserad' : 'Aktiv'
  const lopnr = k.keySequenceNumber ? String(k.keySequenceNumber) : '-'
  const flexnr = k.flexNumber ? String(k.flexNumber) : '-'

  if (scope !== undefined) {
    const c = KEYS_COLS_MAINTENANCE
    const lines = doc.splitTextToSize(scope, c.scopeMax) as string[]
    doc.text(k.keyName, c.namn, y)
    doc.text(systemCode, c.lassystem, y)
    doc.text(lopnr, c.lopnr, y)
    doc.text(lines, c.scope, y)
    doc.text(flexnr, c.flexnr, y)
    doc.text(labelForType, c.typ, y)
    doc.text(status, c.status, y)
    return Math.max(6, lines.length * 5)
  }

  const c = KEYS_COLS_TENANT
  doc.text(k.keyName, c.namn, y)
  doc.text(systemCode, c.lassystem, y)
  doc.text(lopnr, c.lopnr, y)
  doc.text(flexnr, c.flexnr, y)
  doc.text(labelForType, c.typ, y)
  doc.text(status, c.status, y)
  return 6
}

/**
 * Renders a single card row
 */
const renderCardRow = (doc: jsPDF, c: Card, y: number): void => {
  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)

  const codes = c.codes as { format?: string; number?: string }[] | null
  const firstCode = codes?.[0]
  doc.text(c.name || '-', MARGIN_X, y)
  doc.text(firstCode?.format || '-', 50, y)
  doc.text(firstCode?.number || '-', 100, y)
  doc.text('Droppe', 145, y)
  doc.text(c.disabled ? 'Inaktiv' : 'Aktiv', 175, y)
}

/**
 * Renders keys and cards as two separate tables under one section header.
 * When `scopeByKeyId` is provided, the keys table switches to the
 * maintenance variant with an inline Tillhörighet column per row.
 */
const renderItemsTableSection = (
  doc: jsPDF,
  keys: KeyDetails[],
  cards: Card[] | undefined,
  y: number,
  headerText: string,
  headerColor: { r: number; g: number; b: number } = BLUE,
  scopeByKeyId?: Record<string, string>
): number => {
  const hasKeys = keys.length > 0
  const hasCards = cards && cards.length > 0
  if (!hasKeys && !hasCards) return y

  const bottom = contentBottom(doc)
  const minSpaceNeeded = 35
  const defaultRowH = 6
  const withScope = !!scopeByKeyId

  if (y + minSpaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP_CONTINUATION
  }

  // Section header in Bison Bold
  doc.setFont(FONT_BISON, 'bold')
  doc.setFontSize(FONT_SIZE.SECTION_HEADER)
  doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
  doc.text(headerText, MARGIN_X, y)
  doc.setTextColor(0, 0, 0)

  let cy = y + 10

  // Keys table
  if (hasKeys) {
    renderKeysTableHeader(doc, cy, withScope)
    cy += 9

    keys.forEach((key) => {
      if (cy + defaultRowH + 5 > bottom) {
        doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b)
        doc.line(MARGIN_X, cy, PAGE_W - MARGIN_X, cy)
        doc.addPage()
        cy = MARGIN_TOP_CONTINUATION

        doc.setFont(FONT_BISON, 'bold')
        doc.setFontSize(FONT_SIZE.SECTION_HEADER)
        doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
        doc.text(`${headerText} (fortsättning)`, MARGIN_X, cy)
        doc.setTextColor(0, 0, 0)

        cy += 10
        renderKeysTableHeader(doc, cy, withScope)
        cy += 9
      }

      const defaultRowHeight = renderKeyRow(
        doc,
        key,
        cy,
        scopeByKeyId?.[key.id]
      )
      cy += defaultRowHeight
    })

    // Bottom line for keys table
    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b)
    doc.line(MARGIN_X, cy, PAGE_W - MARGIN_X, cy)
    cy += 6
  }

  // Cards table (with separator)
  if (hasCards) {
    cy += 4 // Small gap between tables

    if (cy + minSpaceNeeded > bottom) {
      doc.addPage()
      cy = MARGIN_TOP_CONTINUATION
    }

    renderCardsTableHeader(doc, cy)
    cy += 9

    cards.forEach((card) => {
      if (cy + defaultRowH + 5 > bottom) {
        doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b)
        doc.line(MARGIN_X, cy, PAGE_W - MARGIN_X, cy)
        doc.addPage()
        cy = MARGIN_TOP_CONTINUATION

        doc.setFont(FONT_BISON, 'bold')
        doc.setFontSize(FONT_SIZE.SECTION_HEADER)
        doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
        doc.text(`${headerText} (fortsättning)`, MARGIN_X, cy)
        doc.setTextColor(0, 0, 0)

        cy += 10
        renderCardsTableHeader(doc, cy)
        cy += 9
      }

      renderCardRow(doc, card, cy)
      cy += defaultRowH
    })

    // Bottom line for cards table
    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b)
    doc.line(MARGIN_X, cy, PAGE_W - MARGIN_X, cy)
    cy += 6
  }

  cy += 2

  // Total count
  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.setFontSize(FONT_SIZE.BODY)
  if (hasKeys && hasCards) {
    doc.text(
      `Totalt: ${keys.length} nycklar, ${cards.length} droppar`,
      MARGIN_X,
      cy
    )
  } else if (hasCards) {
    doc.text(`Totalt antal droppar: ${cards.length}`, MARGIN_X, cy)
  } else {
    doc.text(`Totalt antal nycklar: ${keys.length}`, MARGIN_X, cy)
  }

  return cy + 14
}

/**
 * Renders items table for loan receipts (simple, single section)
 */
const renderItemsTable = (
  doc: jsPDF,
  keys: ReceiptData['keys'],
  cards: Card[] | undefined,
  y: number,
  scopeByKeyId?: Record<string, string>
): number => {
  const hasCards = cards && cards.length > 0
  const headerText = hasCards ? 'NYCKLAR OCH DROPPAR' : 'NYCKLAR'
  return renderItemsTableSection(
    doc,
    keys,
    cards,
    y,
    headerText,
    BLUE,
    scopeByKeyId
  )
}

/**
 * Renders items tables for return receipts (returned, missing, remaining-on-loan,
 * disposed sections). missing and remaining-on-loan are mutually exclusive: a
 * receipt is either a "missing keys" return (full loan close, items unaccounted
 * for) or a partial return (items continue on a new loan), never both.
 */
const renderReturnItemsTable = (
  doc: jsPDF,
  returnedKeys: ReceiptData['keys'],
  returnedCards: Card[] | undefined,
  missingKeys: ReceiptData['keys'] | undefined,
  missingCards: Card[] | undefined,
  disposedKeys: ReceiptData['keys'] | undefined,
  remainingLoanKeys: ReceiptData['keys'] | undefined,
  remainingLoanCards: Card[] | undefined,
  y: number,
  scopeByKeyId?: Record<string, string>
): number => {
  const hasMissingKeys = missingKeys && missingKeys.length > 0
  const hasMissingCards = missingCards && missingCards.length > 0
  const hasMissing = hasMissingKeys || hasMissingCards
  const hasRemainingKeys = remainingLoanKeys && remainingLoanKeys.length > 0
  const hasRemainingCards = remainingLoanCards && remainingLoanCards.length > 0
  const hasRemaining = hasRemainingKeys || hasRemainingCards
  const hasDisposed = disposedKeys && disposedKeys.length > 0
  const hasCards =
    (returnedCards && returnedCards.length > 0) ||
    hasMissingCards ||
    hasRemainingCards

  // Determine header text based on what sections exist
  let returnedHeader = 'NYCKLAR'
  if (hasCards) {
    returnedHeader =
      hasMissing || hasRemaining || hasDisposed
        ? 'INLÄMNADE NYCKLAR OCH DROPPAR'
        : 'NYCKLAR OCH DROPPAR'
  } else if (hasMissing || hasRemaining || hasDisposed) {
    returnedHeader = 'INLÄMNADE NYCKLAR'
  }

  // Returned items section
  y = renderItemsTableSection(
    doc,
    returnedKeys,
    returnedCards,
    y,
    returnedHeader,
    BLUE,
    scopeByKeyId
  )

  // Missing items section (red)
  if (hasMissing) {
    y += 4
    const missingHeader = hasCards
      ? 'SAKNADE NYCKLAR OCH DROPPAR'
      : 'SAKNADE NYCKLAR'
    y = renderItemsTableSection(
      doc,
      missingKeys || [],
      missingCards,
      y,
      missingHeader,
      RED,
      scopeByKeyId
    )
  }

  // Remaining-on-loan items (partial return) — blue, since this isn't a problem
  if (hasRemaining) {
    y += 4
    const remainingHeader = hasRemainingCards
      ? 'NYCKLAR OCH DROPPAR KVAR PÅ LÅN'
      : 'NYCKLAR KVAR PÅ LÅN'
    y = renderItemsTableSection(
      doc,
      remainingLoanKeys || [],
      remainingLoanCards,
      y,
      remainingHeader,
      BLUE,
      scopeByKeyId
    )
  }

  // Disposed items section (blue - same as returned)
  if (hasDisposed) {
    y += 4
    y = renderItemsTableSection(
      doc,
      disposedKeys,
      undefined,
      y,
      'KASSERADE NYCKLAR',
      BLUE,
      scopeByKeyId
    )
  }

  return y
}

/**
 * Adds the Företag header block for a maintenance receipt. Per-key Tillhörighet
 * is rendered inline in the Nycklar table further down, so no right column here.
 */
const addMaintenanceInfo = (
  doc: jsPDF,
  data: MaintenanceReceiptData,
  y: number
): number => {
  const leftCol = MARGIN_X

  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.setFontSize(FONT_SIZE.SUB_HEADER)
  doc.setTextColor(0, 0, 0)
  doc.text('Företag', leftCol, y)

  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)
  let leftY = y + 7

  doc.text(`Namn: ${data.contactName}`, leftCol, leftY)
  leftY += 5
  doc.text(`Kundnummer: ${data.contact}`, leftCol, leftY)
  leftY += 5
  if (data.contactPerson) {
    doc.text(`Kontaktperson: ${data.contactPerson}`, leftCol, leftY)
    leftY += 5
  }

  return leftY + 6
}

/**
 * Adds the BEKRÄFTELSE (confirmation) section for maintenance loan receipts
 */
const addMaintenanceLoanConfirmation = (doc: jsPDF, y: number): number => {
  const bottom = contentBottom(doc)

  const confirmText =
    'För Mimers personal: Lån av nycklar sker under förutsättning att nyckellånaren tar hela ansvaret för dess användande. Om nyckel förkommer skall nyckellånaren omgående informera aktuell Distriktschef för vidare hantering. Nycklar ska alltid fästas med kedja.\n\nFör övriga: Lån av huvudnyckel/fastighetsskötarnyckel sker under förutsättning att nyckellånaren tar hela ansvaret för dess användande enligt ansvarsförbindelsen. Denne förbinder sig att svara för samtliga kostnader som kan uppstå genom förlust av utkvitterad nyckel, såsom till exempel byte av låssystem inkl. nycklar och cylindrar och ev. nödvändig bevakning under tiden. Nycklar ska alltid fästas med kedja.'

  // Pre-compute wrapped lines to calculate actual space needed
  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)
  const lines = doc.splitTextToSize(confirmText, PAGE_W - 2 * MARGIN_X)
  const textHeight = lines.length * 5.5
  // header (10) + text + gap (10) + signature line (5) + label (10)
  const spaceNeeded = 10 + textHeight + 10 + 5 + 10

  if (y + spaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP_CONTINUATION
  }

  // Section header
  doc.setFont(FONT_BISON, 'bold')
  doc.setFontSize(FONT_SIZE.SECTION_HEADER)
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b)
  doc.text('BEKRÄFTELSE', MARGIN_X, y)
  doc.setTextColor(0, 0, 0)

  y += 10

  // Confirmation text
  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)

  lines.forEach((line: string) => {
    doc.text(line, MARGIN_X, y)
    y += 5.5
  })

  y += 10

  // Signature line
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, y, 100, y)
  doc.line(130, y, PAGE_W - MARGIN_X, y)

  y += 5
  doc.setFontSize(FONT_SIZE.BODY)

  doc.text('Signatur', MARGIN_X, y)
  doc.text('Datum', 130, y)

  return y + 10
}

/**
 * Adds the BEKRÄFTELSE (confirmation) section for maintenance return receipts
 */
const addMaintenanceReturnConfirmation = (
  doc: jsPDF,
  y: number,
  hasMissingItems: boolean,
  hasRemainingItems: boolean
): number => {
  const bottom = contentBottom(doc)
  const spaceNeeded = 35

  if (y + spaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP_CONTINUATION
  }

  // Section header
  doc.setFont(FONT_BISON, 'bold')
  doc.setFontSize(FONT_SIZE.SECTION_HEADER)
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b)
  doc.text('BEKRÄFTELSE', MARGIN_X, y)
  doc.setTextColor(0, 0, 0)

  y += 10

  // Confirmation text
  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)

  const paragraphs: string[] = [
    'Ovanstående nycklar har återlämnats och kontrollerats.',
  ]
  if (hasMissingItems) {
    paragraphs.push(
      'Observera att vissa nycklar eller droppar saknas (se lista ovan).'
    )
  }
  if (hasRemainingItems) {
    paragraphs.push(
      'Övriga nycklar och droppar är kvar på lån (se lista ovan).'
    )
  }

  paragraphs.forEach((paragraph, i) => {
    if (i > 0) y += 3
    const lines = doc.splitTextToSize(paragraph, PAGE_W - 2 * MARGIN_X)
    lines.forEach((line: string) => {
      doc.text(line, MARGIN_X, y)
      y += 5.5
    })
  })

  return y + 10
}

/**
 * Adds the BEKRÄFTELSE (confirmation) section for loan receipts
 */
const addLoanConfirmation = (
  doc: jsPDF,
  y: number,
  tenants: ReceiptData['tenants']
): number => {
  const bottom = contentBottom(doc)
  const spaceNeeded = 50

  if (y + spaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP_CONTINUATION
  }

  // Section header
  doc.setFont(FONT_BISON, 'bold')
  doc.setFontSize(FONT_SIZE.SECTION_HEADER)
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b)
  doc.text('BEKRÄFTELSE', MARGIN_X, y)
  doc.setTextColor(0, 0, 0)

  y += 10

  // Confirmation text
  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)

  const confirmText =
    'Jag bekräftar att jag har mottagit ovanstående nycklar och att jag är ansvarig för dem enligt hyresavtalet. Nycklar ska återlämnas enligt hyresavtalets villkor. Vid förlust eller skada debiteras kostnad för byte av lås.'

  const lines = doc.splitTextToSize(confirmText, PAGE_W - 2 * MARGIN_X)
  lines.forEach((line: string) => {
    doc.text(line, MARGIN_X, y)
    y += 5.5
  })

  y += 10

  // Signature line
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, y, 100, y)
  doc.line(130, y, PAGE_W - MARGIN_X, y)

  y += 5
  doc.setFontSize(FONT_SIZE.BODY)

  // Get first tenant name for signature label
  const tenant = tenants[0]
  const name = `${tenant?.firstName || ''} ${tenant?.lastName || ''}`.trim()
  const fullName = name || tenant?.fullName || 'Förnamn Efternamn'

  doc.text(`Signatur – ${fullName}`, MARGIN_X, y)
  doc.text('Datum', 130, y)

  return y + 10
}

/**
 * Adds the BEKRÄFTELSE (confirmation) section for return receipts
 */
const addReturnConfirmation = (
  doc: jsPDF,
  y: number,
  hasMissingItems: boolean,
  hasRemainingItems: boolean
): number => {
  const bottom = contentBottom(doc)
  const spaceNeeded = 35

  if (y + spaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP_CONTINUATION
  }

  // Section header
  doc.setFont(FONT_BISON, 'bold')
  doc.setFontSize(FONT_SIZE.SECTION_HEADER)
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b)
  doc.text('BEKRÄFTELSE', MARGIN_X, y)
  doc.setTextColor(0, 0, 0)

  y += 10

  // Confirmation text
  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)

  const paragraphs: string[] = [
    'Ovanstående nycklar har återlämnats och kontrollerats av Mimers personal.',
  ]
  if (hasMissingItems) {
    paragraphs.push(
      'Observera att vissa nycklar eller droppar saknas (se lista ovan).'
    )
  }
  if (hasRemainingItems) {
    paragraphs.push(
      'Övriga nycklar och droppar är kvar på lån (se lista ovan).'
    )
  }

  paragraphs.forEach((paragraph, i) => {
    if (i > 0) y += 3
    const lines = doc.splitTextToSize(paragraph, PAGE_W - 2 * MARGIN_X)
    lines.forEach((line: string) => {
      doc.text(line, MARGIN_X, y)
      y += 5.5
    })
  })

  return y + 10
}

/**
 * Adds a comment section to the receipt
 */
const addComment = (doc: jsPDF, y: number, comment?: string): number => {
  if (!comment?.trim()) return y

  const bottom = contentBottom(doc)
  const lines = doc.splitTextToSize(comment, PAGE_W - 2 * MARGIN_X)
  const spaceNeeded = 25 + lines.length * 5

  if (y + spaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP_CONTINUATION
  }

  // Section header - Bison Bold blue (same style as NYCKLAR, DROPPAR)
  doc.setFont(FONT_BISON, 'bold')
  doc.setFontSize(FONT_SIZE.SECTION_HEADER)
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b)
  doc.text('KOMMENTAR', MARGIN_X, y)
  doc.setTextColor(0, 0, 0)

  y += 10
  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)

  lines.forEach((line: string) => {
    doc.text(line, MARGIN_X, y)
    y += 5
  })

  return y + 8
}

/**
 * Adds footer with Mimer logo and contact info
 */
const addFooter = async (doc: jsPDF): Promise<void> => {
  const h = doc.internal.pageSize.height as number
  const totalPages = doc.getNumberOfPages()

  const img = await loadLogo()

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    const footerY = h - 25

    // Add logo if loaded, vertically centered with contact text
    if (img) {
      const logoW = 50
      const logoH = (img.naturalHeight / img.naturalWidth) * logoW
      const textCenterY = footerY - 0.5 // center of the two text lines
      doc.addImage(img, 'PNG', MARGIN_X, textCenterY - logoH / 2, logoW, logoH)
    }

    // Contact info
    doc.setFont(FONT_GRAPHIK, 'normal')
    doc.setFontSize(FONT_SIZE.FOOTER)
    doc.setTextColor(0, 0, 0)

    const contactX = img ? MARGIN_X + 55 : MARGIN_X
    doc.text(
      'Bostads AB Mimer, Box 1170, 721 29 Västerås, www.mimer.nu',
      contactX,
      footerY - 3
    )
    doc.text(
      'Besöksadress: Gasverksgatan 7 Tel: 021-39 70 00 E-post: post@mimer.nu',
      contactX,
      footerY + 2
    )

    // Page numbering
    if (totalPages > 1) {
      doc.text(`Sida ${i} av ${totalPages}`, PAGE_W - MARGIN_X, h - 8, {
        align: 'right',
      })
    }
  }
}

/* ============================================================================
 * BUILD FUNCTIONS
 * ============================================================================ */

async function buildLoanDoc(data: ReceiptData) {
  const doc = new jsPDF()
  registerCustomFonts(doc)

  let y = addTitle(doc, 'loan')
  y = addMeta(doc, y, 'loan')
  y = addTenantInfo(doc, data, y)

  // Combined keys and cards table (sorted by type, system, name, flex, sequence)
  y = renderItemsTable(doc, sortKeys(data.keys), data.cards, y)

  y = addLoanConfirmation(doc, y, data.tenants)
  addComment(doc, y, data.comment)
  await addFooter(doc)
  if (data.loanId) {
    await addQrCode(doc, data.loanId)
  }

  const fileName = `nyckelutlaning_${data.tenants[0].contactCode}_${format(
    new Date(),
    'yyyyMMdd'
  )}.pdf`

  return { doc, fileName }
}

async function buildReturnDoc(data: ReceiptData) {
  const doc = new jsPDF()
  registerCustomFonts(doc)

  let y = addTitle(doc, 'return')
  y = addMeta(doc, y, 'return')
  y = addTenantInfo(doc, data, y)

  // Check for missing / remaining items
  const hasMissingKeys = data.missingKeys && data.missingKeys.length > 0
  const hasMissingCards = data.missingCards && data.missingCards.length > 0
  const hasMissingItems = Boolean(hasMissingKeys || hasMissingCards)
  const hasRemainingItems = Boolean(
    (data.remainingLoanKeys && data.remainingLoanKeys.length > 0) ||
      (data.remainingLoanCards && data.remainingLoanCards.length > 0)
  )

  // Combined keys and cards table (returned, missing, remaining-on-loan, disposed)
  // Sort each category for consistent löpnummer ordering
  y = renderReturnItemsTable(
    doc,
    sortKeys(data.keys),
    data.cards,
    data.missingKeys ? sortKeys(data.missingKeys) : undefined,
    data.missingCards,
    data.disposedKeys ? sortKeys(data.disposedKeys) : undefined,
    data.remainingLoanKeys ? sortKeys(data.remainingLoanKeys) : undefined,
    data.remainingLoanCards,
    y
  )

  y = addReturnConfirmation(doc, y, hasMissingItems, hasRemainingItems)
  addComment(doc, y, data.comment)
  await addFooter(doc)

  const fileName = `nyckelaterlamning_${data.tenants[0].contactCode}_${format(
    new Date(),
    'yyyyMMdd'
  )}.pdf`

  return { doc, fileName }
}

/* ============================================================================
 * MAINTENANCE BUILD FUNCTIONS
 * ============================================================================ */

async function buildMaintenanceLoanDoc(data: MaintenanceReceiptData) {
  const doc = new jsPDF()
  registerCustomFonts(doc)

  let y = addTitle(doc, 'loan')
  y = addMeta(doc, y, 'loan')
  y = addMaintenanceInfo(doc, data, y)

  // Combined keys and cards table (sorted) — pass Tillhörighet map for inline column
  y = renderItemsTable(
    doc,
    sortKeys(data.keys),
    data.cards,
    y,
    data.scopeByKeyId
  )

  y = addMaintenanceLoanConfirmation(doc, y)
  addComment(doc, y, data.description ?? undefined)
  await addFooter(doc)
  if (data.loanId) {
    await addQrCode(doc, data.loanId)
  }

  const fileName = `nyckelutlaning_${data.contact}_${format(
    new Date(),
    'yyyyMMdd'
  )}.pdf`

  return { doc, fileName }
}

async function buildMaintenanceReturnDoc(data: MaintenanceReceiptData) {
  const doc = new jsPDF()
  registerCustomFonts(doc)

  let y = addTitle(doc, 'return')
  y = addMeta(doc, y, 'return')
  y = addMaintenanceInfo(doc, data, y)

  // Check for missing / remaining items
  const hasMissingKeys = data.missingKeys && data.missingKeys.length > 0
  const hasMissingCards = data.missingCards && data.missingCards.length > 0
  const hasMissingItems = Boolean(hasMissingKeys || hasMissingCards)
  const hasRemainingItems = Boolean(
    (data.remainingLoanKeys && data.remainingLoanKeys.length > 0) ||
      (data.remainingLoanCards && data.remainingLoanCards.length > 0)
  )

  // Combined keys and cards table (returned, missing, remaining-on-loan, disposed)
  y = renderReturnItemsTable(
    doc,
    sortKeys(data.keys),
    data.cards,
    data.missingKeys ? sortKeys(data.missingKeys) : undefined,
    data.missingCards,
    data.disposedKeys ? sortKeys(data.disposedKeys) : undefined,
    data.remainingLoanKeys ? sortKeys(data.remainingLoanKeys) : undefined,
    data.remainingLoanCards,
    y,
    data.scopeByKeyId
  )

  y = addMaintenanceReturnConfirmation(
    doc,
    y,
    hasMissingItems,
    hasRemainingItems
  )
  addComment(doc, y, data.description ?? undefined)
  await addFooter(doc)

  const fileName = `nyckelaterlamning_${data.contact}_${format(
    new Date(),
    'yyyyMMdd'
  )}.pdf`

  return { doc, fileName }
}

/* ============================================================================
 * PUBLIC API
 * ============================================================================ */

export const generateLoanReceiptBlob = async (
  data: ReceiptData
): Promise<{ blob: Blob; fileName: string }> => {
  const { doc, fileName } = await buildLoanDoc(data)
  const blob = doc.output('blob') as Blob
  return { blob, fileName }
}

export const generateReturnReceiptBlob = async (
  data: ReceiptData
): Promise<{ blob: Blob; fileName: string }> => {
  const { doc, fileName } = await buildReturnDoc(data)
  const blob = doc.output('blob') as Blob
  return { blob, fileName }
}

export const generateMaintenanceLoanReceiptBlob = async (
  data: MaintenanceReceiptData
): Promise<{ blob: Blob; fileName: string }> => {
  const { doc, fileName } = await buildMaintenanceLoanDoc(data)
  const blob = doc.output('blob') as Blob
  return { blob, fileName }
}

export const generateMaintenanceReturnReceiptBlob = async (
  data: MaintenanceReceiptData
): Promise<{ blob: Blob; fileName: string }> => {
  const { doc, fileName } = await buildMaintenanceReturnDoc(data)
  const blob = doc.output('blob') as Blob
  return { blob, fileName }
}
