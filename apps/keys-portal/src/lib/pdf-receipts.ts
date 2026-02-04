import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

import type { ReceiptData, MaintenanceReceiptData, Card } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { rentalObjectSearchService } from '@/services/api/rentalObjectSearchService'

import { registerCustomFonts, FONT_BISON, FONT_GRAPHIK } from './pdf-fonts'
import logoUrl from '../../assets/MimerLogo_RGB_blk-blue.png'

// Layout constants
const PAGE_W = 210
const MARGIN_X = 20
const MARGIN_TOP = 20
const FOOTER_H = 40
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
  RECEIPT_ID: 7, // Small receipt ID at bottom
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

  return y + 12
}

/**
 * Adds tenant info (Hyresgäst) and lease info (Avtal) in two columns
 */
const addTenantInfo = async (
  doc: jsPDF,
  tenants: ReceiptData['tenants'],
  lease: ReceiptData['lease'],
  y: number
): Promise<number> => {
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

  // Right column: Display lease info
  doc.text(`Hyresobjekt: ${lease.rentalPropertyId}`, rightCol, rightY)
  rightY += 5

  // Wrap long leaseId
  const leaseIdLines = doc.splitTextToSize(`Avtals-ID: ${lease.leaseId}`, 75)
  doc.text(leaseIdLines, rightCol, rightY)
  rightY += Array.isArray(leaseIdLines) ? leaseIdLines.length * 5 : 5

  // Fetch and display address
  try {
    const address = await rentalObjectSearchService.getAddressByRentalId(
      lease.rentalPropertyId
    )
    if (address && address !== 'Okänd adress') {
      doc.text(`Adress: ${address}`, rightCol, rightY)
    } else {
      doc.text(`Adress: -`, rightCol, rightY)
    }
  } catch {
    doc.text(`Adress: -`, rightCol, rightY)
  }
  rightY += 5

  return Math.max(leftY, rightY) + 10
}

/**
 * Renders a keys table section with custom header and color
 */
const renderKeysTableSection = (
  doc: jsPDF,
  keys: ReceiptData['keys'],
  y: number,
  headerText: string,
  headerColor: { r: number; g: number; b: number } = BLUE,
  reserveAfter: number = 0
): number => {
  if (keys.length === 0) return y

  const bottom = contentBottom(doc)
  const minSpaceNeeded = 35

  if (y + minSpaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP
  }

  // Section header in Bison Bold
  doc.setFont(FONT_BISON, 'bold')
  doc.setFontSize(FONT_SIZE.SECTION_HEADER)
  doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
  doc.text(headerText, MARGIN_X, y)
  doc.setTextColor(0, 0, 0)

  // Table header in Graphik Semibold
  const top = y + 10
  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.setFontSize(FONT_SIZE.TABLE_HEADER)
  doc.text('Nyckelnamn', MARGIN_X, top)
  doc.text('Typ', 80, top)
  doc.text('Löp.nr', 130, top)
  doc.text('Flex.nr', 160, top)

  // Header line
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, top + 3, PAGE_W - MARGIN_X, top + 3)

  let cy = top + 9
  const rowH = 6

  // Table rows
  keys.forEach((k, index) => {
    const isLastKey = index === keys.length - 1
    const spaceNeeded = isLastKey ? reserveAfter + 15 : rowH + 5

    if (cy + spaceNeeded > bottom) {
      doc.line(MARGIN_X, cy, PAGE_W - MARGIN_X, cy)
      doc.addPage()
      cy = MARGIN_TOP

      // Re-render header on new page
      doc.setFont(FONT_BISON, 'bold')
      doc.setFontSize(FONT_SIZE.SECTION_HEADER)
      doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
      doc.text(`${headerText} (fortsättning)`, MARGIN_X, cy)
      doc.setTextColor(0, 0, 0)

      doc.setFont(FONT_GRAPHIK, 'bold')
      doc.setFontSize(FONT_SIZE.TABLE_HEADER)
      cy += 10
      doc.text('Nyckelnamn', MARGIN_X, cy)
      doc.text('Typ', 80, cy)
      doc.text('Löp.nr', 130, cy)
      doc.text('Flex.nr', 160, cy)
      doc.line(MARGIN_X, cy + 3, PAGE_W - MARGIN_X, cy + 3)
      cy += 9
    }

    doc.setFont(FONT_GRAPHIK, 'normal')
    doc.setFontSize(FONT_SIZE.BODY)
    doc.text(k.keyName, MARGIN_X, cy)
    const labelForType =
      (KeyTypeLabels as Record<string, string>)[
        k.keyType as unknown as string
      ] || (k.keyType as string)
    doc.text(labelForType, 80, cy)
    doc.text(k.keySequenceNumber ? String(k.keySequenceNumber) : '-', 130, cy)
    doc.text(k.flexNumber ? String(k.flexNumber) : '-', 160, cy)
    cy += rowH
  })

  // Bottom line
  doc.line(MARGIN_X, cy, PAGE_W - MARGIN_X, cy)
  cy += 8

  // Total count - Semibold
  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.setFontSize(FONT_SIZE.BODY)
  doc.text(`Totalt antal nycklar: ${keys.length}`, MARGIN_X, cy)

  return cy + 10
}

/**
 * Renders keys table for loan receipts (simple, single section)
 */
const renderKeysTable = (
  doc: jsPDF,
  keys: ReceiptData['keys'],
  y: number,
  reserveAfter: number = 0
): number => {
  return renderKeysTableSection(doc, keys, y, 'NYCKLAR', BLUE, reserveAfter)
}

/**
 * Renders keys tables for return receipts (returned, missing, disposed sections)
 */
const renderReturnKeysTable = (
  doc: jsPDF,
  returnedKeys: ReceiptData['keys'],
  missingKeys: ReceiptData['keys'] | undefined,
  disposedKeys: ReceiptData['keys'] | undefined,
  y: number,
  reserveAfter: number = 0
): number => {
  const hasMissing = missingKeys && missingKeys.length > 0
  const hasDisposed = disposedKeys && disposedKeys.length > 0

  // Determine header text based on what sections exist
  const returnedHeader =
    hasMissing || hasDisposed ? 'INLÄMNADE NYCKLAR' : 'NYCKLAR'

  // Returned keys section
  const returnedReserve = hasMissing || hasDisposed ? 0 : reserveAfter
  y = renderKeysTableSection(
    doc,
    returnedKeys,
    y,
    returnedHeader,
    BLUE,
    returnedReserve
  )

  // Missing keys section (red)
  if (hasMissing) {
    y += 4
    const missingReserve = hasDisposed ? 0 : reserveAfter
    y = renderKeysTableSection(
      doc,
      missingKeys,
      y,
      'SAKNADE NYCKLAR',
      RED,
      missingReserve
    )
  }

  // Disposed keys section (blue - same as returned)
  if (hasDisposed) {
    y += 4
    y = renderKeysTableSection(
      doc,
      disposedKeys,
      y,
      'KASSERADE NYCKLAR',
      BLUE,
      reserveAfter
    )
  }

  return y
}

/**
 * Renders a cards table section with custom header and color
 */
const renderCardsTableSection = (
  doc: jsPDF,
  cards: Card[],
  y: number,
  headerText: string,
  headerColor: { r: number; g: number; b: number } = BLUE,
  reserveAfter: number = 0
): number => {
  if (cards.length === 0) return y

  const bottom = contentBottom(doc)
  const minSpaceNeeded = 35

  if (y + minSpaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP
  }

  doc.setFont(FONT_BISON, 'bold')
  doc.setFontSize(FONT_SIZE.SECTION_HEADER)
  doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
  doc.text(headerText, MARGIN_X, y)
  doc.setTextColor(0, 0, 0)

  const top = y + 10
  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.setFontSize(FONT_SIZE.TABLE_HEADER)
  doc.text('Namn', MARGIN_X, top)
  doc.text('Dropp-ID', 50, top)
  doc.text('Status', 170, top)

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, top + 3, PAGE_W - MARGIN_X, top + 3)

  let cy = top + 9
  const rowH = 6

  cards.forEach((card, index) => {
    const isLastCard = index === cards.length - 1
    const spaceNeeded = isLastCard ? reserveAfter + 15 : rowH + 5

    if (cy + spaceNeeded > bottom) {
      doc.line(MARGIN_X, cy, PAGE_W - MARGIN_X, cy)
      doc.addPage()
      cy = MARGIN_TOP

      doc.setFont(FONT_BISON, 'bold')
      doc.setFontSize(FONT_SIZE.SECTION_HEADER)
      doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
      doc.text(`${headerText} (fortsättning)`, MARGIN_X, cy)
      doc.setTextColor(0, 0, 0)

      doc.setFont(FONT_GRAPHIK, 'bold')
      doc.setFontSize(FONT_SIZE.TABLE_HEADER)
      cy += 10
      doc.text('Namn', MARGIN_X, cy)
      doc.text('Dropp-ID', 50, cy)
      doc.text('Status', 170, cy)
      doc.line(MARGIN_X, cy + 3, PAGE_W - MARGIN_X, cy + 3)
      cy += 9
    }

    doc.setFont(FONT_GRAPHIK, 'normal')
    doc.setFontSize(FONT_SIZE.BODY)
    doc.text(card.name || '-', MARGIN_X, cy)
    doc.text(card.cardId, 50, cy)
    doc.text(card.disabled ? 'Inaktiv' : 'Aktiv', 170, cy)
    cy += rowH
  })

  doc.line(MARGIN_X, cy, PAGE_W - MARGIN_X, cy)
  cy += 8

  // Total count - Semibold
  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.setFontSize(FONT_SIZE.BODY)
  doc.text(`Totalt antal droppar: ${cards.length}`, MARGIN_X, cy)

  return cy + 10
}

/**
 * Renders cards table for loan receipts
 */
const renderCardsTable = (
  doc: jsPDF,
  cards: Card[],
  y: number,
  reserveAfter: number = 0
): number => {
  return renderCardsTableSection(doc, cards, y, 'DROPPAR', BLUE, reserveAfter)
}

/**
 * Renders cards tables for return receipts (returned, missing sections)
 */
const renderReturnCardsTable = (
  doc: jsPDF,
  returnedCards: Card[] | undefined,
  missingCards: Card[] | undefined,
  y: number,
  reserveAfter: number = 0
): number => {
  const hasReturned = returnedCards && returnedCards.length > 0
  const hasMissing = missingCards && missingCards.length > 0

  if (!hasReturned && !hasMissing) return y

  // Determine header text based on what sections exist
  const returnedHeader = hasMissing ? 'INLÄMNADE DROPPAR' : 'DROPPAR'

  // Returned cards section
  if (hasReturned) {
    const returnedReserve = hasMissing ? 0 : reserveAfter
    y = renderCardsTableSection(
      doc,
      returnedCards,
      y,
      returnedHeader,
      BLUE,
      returnedReserve
    )
  }

  // Missing cards section (red)
  if (hasMissing) {
    if (hasReturned) y += 4
    y = renderCardsTableSection(
      doc,
      missingCards,
      y,
      'SAKNADE DROPPAR',
      RED,
      reserveAfter
    )
  }

  return y
}

/**
 * Adds maintenance info (Företag) and details in two columns
 */
const addMaintenanceInfo = (
  doc: jsPDF,
  data: MaintenanceReceiptData,
  y: number
): number => {
  const leftCol = MARGIN_X
  const rightCol = 110

  // Section headers - BOLD (Graphik Semibold)
  doc.setFont(FONT_GRAPHIK, 'bold')
  doc.setFontSize(FONT_SIZE.SUB_HEADER)
  doc.setTextColor(0, 0, 0)

  // Left column header
  doc.text('Företag', leftCol, y)
  // Right column header (only if we have content)
  if (data.contactPerson || data.description) {
    doc.text('Detaljer', rightCol, y)
  }

  doc.setFont(FONT_GRAPHIK, 'normal')
  doc.setFontSize(FONT_SIZE.BODY)
  let leftY = y + 7
  let rightY = y + 7

  // Left column: Company name and customer number
  doc.text(`Namn: ${data.contactName}`, leftCol, leftY)
  leftY += 5
  doc.text(`Kundnummer: ${data.contact}`, leftCol, leftY)
  leftY += 8

  // Right column: Contact person and description
  if (data.contactPerson) {
    doc.text(`Kontaktperson: ${data.contactPerson}`, rightCol, rightY)
    rightY += 5
  }

  if (data.description) {
    const descLines = doc.splitTextToSize(
      `Beskrivning: ${data.description}`,
      75
    )
    doc.text(descLines, rightCol, rightY)
    rightY += Array.isArray(descLines) ? descLines.length * 5 : 5
  }

  return Math.max(leftY, rightY) + 10
}

/**
 * Adds the BEKRÄFTELSE (confirmation) section for maintenance loan receipts
 */
const addMaintenanceLoanConfirmation = (doc: jsPDF, y: number): number => {
  const bottom = contentBottom(doc)
  const spaceNeeded = 55

  if (y + spaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP
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
    'Jag bekräftar att jag har mottagit ovanstående nycklar och att jag är ansvarig för dem. Vid förlust eller skada debiteras kostnad för byte av lås.'

  const lines = doc.splitTextToSize(confirmText, PAGE_W - 2 * MARGIN_X)
  lines.forEach((line: string) => {
    doc.text(line, MARGIN_X, y)
    y += 5.5
  })

  y += 15

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
  hasMissingItems: boolean
): number => {
  const bottom = contentBottom(doc)
  const spaceNeeded = 35

  if (y + spaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP
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

  const confirmText = hasMissingItems
    ? 'Ovanstående nycklar och droppar har återlämnats och kontrollerats. Observera att vissa nycklar eller droppar saknas (se lista ovan).'
    : 'Ovanstående nycklar har återlämnats och kontrollerats.'

  const lines = doc.splitTextToSize(confirmText, PAGE_W - 2 * MARGIN_X)
  lines.forEach((line: string) => {
    doc.text(line, MARGIN_X, y)
    y += 5.5
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
  const spaceNeeded = 55

  if (y + spaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP
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

  y += 15

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
  hasMissingItems: boolean
): number => {
  const bottom = contentBottom(doc)
  const spaceNeeded = 35

  if (y + spaceNeeded > bottom) {
    doc.addPage()
    y = MARGIN_TOP
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

  const confirmText = hasMissingItems
    ? 'Ovanstående nycklar och droppar har återlämnats och kontrollerats av fastighetspersonal. Observera att vissa nycklar eller droppar saknas (se lista ovan).'
    : 'Ovanstående nycklar har återlämnats och kontrollerats av fastighetspersonal.'

  const lines = doc.splitTextToSize(confirmText, PAGE_W - 2 * MARGIN_X)
  lines.forEach((line: string) => {
    doc.text(line, MARGIN_X, y)
    y += 5.5
  })

  return y + 10
}

/**
 * Adds footer with Mimer logo and contact info
 */
const addFooter = async (doc: jsPDF, receiptId?: string): Promise<void> => {
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

    // Receipt ID if provided
    if (receiptId) {
      doc.setFontSize(FONT_SIZE.RECEIPT_ID)
      doc.text(receiptId, MARGIN_X, h - 8)
    }

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

async function buildLoanDoc(data: ReceiptData, receiptId?: string) {
  const doc = new jsPDF()
  registerCustomFonts(doc)

  let y = addTitle(doc, 'loan')
  y = addMeta(doc, y, 'loan')
  y = await addTenantInfo(doc, data.tenants, data.lease, y)

  const hasCards = data.cards && data.cards.length > 0
  const keysReserve = hasCards ? 0 : 55
  y = renderKeysTable(doc, data.keys, y, keysReserve)

  if (hasCards) {
    y += 4
    y = renderCardsTable(doc, data.cards!, y, 55)
  }

  y = addLoanConfirmation(doc, y, data.tenants)
  await addFooter(doc, receiptId)

  const fileName = `nyckelutlaning_${data.tenants[0].contactCode}_${format(
    new Date(),
    'yyyyMMdd'
  )}.pdf`

  return { doc, fileName }
}

async function buildReturnDoc(data: ReceiptData, receiptId?: string) {
  const doc = new jsPDF()
  registerCustomFonts(doc)

  let y = addTitle(doc, 'return')
  y = addMeta(doc, y, 'return')
  y = await addTenantInfo(doc, data.tenants, data.lease, y)

  // Check what we have
  const hasCards =
    (data.cards && data.cards.length > 0) ||
    (data.missingCards && data.missingCards.length > 0)
  const hasMissingKeys = data.missingKeys && data.missingKeys.length > 0
  const hasMissingCards = data.missingCards && data.missingCards.length > 0
  const hasMissingItems = hasMissingKeys || hasMissingCards

  // Keys section
  const keysReserve = hasCards ? 0 : 35
  y = renderReturnKeysTable(
    doc,
    data.keys,
    data.missingKeys,
    data.disposedKeys,
    y,
    keysReserve
  )

  // Cards section
  if (hasCards) {
    y += 4
    y = renderReturnCardsTable(doc, data.cards, data.missingCards, y, 35)
  }

  y = addReturnConfirmation(doc, y, hasMissingItems)
  await addFooter(doc, receiptId)

  const fileName = `nyckelaterlamning_${data.tenants[0].contactCode}_${format(
    new Date(),
    'yyyyMMdd'
  )}.pdf`

  return { doc, fileName }
}

/* ============================================================================
 * MAINTENANCE BUILD FUNCTIONS
 * ============================================================================ */

async function buildMaintenanceLoanDoc(
  data: MaintenanceReceiptData,
  receiptId?: string
) {
  const doc = new jsPDF()
  registerCustomFonts(doc)

  let y = addTitle(doc, 'loan')
  y = addMeta(doc, y, 'loan')
  y = addMaintenanceInfo(doc, data, y)

  const hasCards = data.cards && data.cards.length > 0
  const keysReserve = hasCards ? 0 : 55
  y = renderKeysTable(doc, data.keys, y, keysReserve)

  if (hasCards) {
    y += 4
    y = renderCardsTable(doc, data.cards!, y, 55)
  }

  y = addMaintenanceLoanConfirmation(doc, y)
  await addFooter(doc, receiptId)

  const fileName = `nyckelutlaning_${data.contact}_${format(
    new Date(),
    'yyyyMMdd'
  )}.pdf`

  return { doc, fileName }
}

async function buildMaintenanceReturnDoc(
  data: MaintenanceReceiptData,
  receiptId?: string
) {
  const doc = new jsPDF()
  registerCustomFonts(doc)

  let y = addTitle(doc, 'return')
  y = addMeta(doc, y, 'return')
  y = addMaintenanceInfo(doc, data, y)

  // Check what we have
  const hasCards =
    (data.cards && data.cards.length > 0) ||
    (data.missingCards && data.missingCards.length > 0)
  const hasMissingKeys = data.missingKeys && data.missingKeys.length > 0
  const hasMissingCards = data.missingCards && data.missingCards.length > 0
  const hasMissingItems = hasMissingKeys || hasMissingCards

  // Keys section
  const keysReserve = hasCards ? 0 : 35
  y = renderReturnKeysTable(
    doc,
    data.keys,
    data.missingKeys,
    data.disposedKeys,
    y,
    keysReserve
  )

  // Cards section
  if (hasCards) {
    y += 4
    y = renderReturnCardsTable(doc, data.cards, data.missingCards, y, 35)
  }

  y = addMaintenanceReturnConfirmation(doc, y, hasMissingItems)
  await addFooter(doc, receiptId)

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
  data: ReceiptData,
  receiptId?: string
): Promise<{ blob: Blob; fileName: string }> => {
  const { doc, fileName } = await buildLoanDoc(data, receiptId)
  const blob = doc.output('blob') as Blob
  return { blob, fileName }
}

export const generateReturnReceiptBlob = async (
  data: ReceiptData,
  receiptId?: string
): Promise<{ blob: Blob; fileName: string }> => {
  const { doc, fileName } = await buildReturnDoc(data, receiptId)
  const blob = doc.output('blob') as Blob
  return { blob, fileName }
}

export const generateMaintenanceLoanReceiptBlob = async (
  data: MaintenanceReceiptData,
  receiptId?: string
): Promise<{ blob: Blob; fileName: string }> => {
  const { doc, fileName } = await buildMaintenanceLoanDoc(data, receiptId)
  const blob = doc.output('blob') as Blob
  return { blob, fileName }
}

export const generateMaintenanceReturnReceiptBlob = async (
  data: MaintenanceReceiptData,
  receiptId?: string
): Promise<{ blob: Blob; fileName: string }> => {
  const { doc, fileName } = await buildMaintenanceReturnDoc(data, receiptId)
  const blob = doc.output('blob') as Blob
  return { blob, fileName }
}
