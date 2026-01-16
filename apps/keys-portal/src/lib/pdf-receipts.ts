import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

import type {
  ReceiptData,
  MaintenanceReceiptData,
  Card,
} from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { rentalObjectSearchService } from '@/services/api/rentalObjectSearchService'

import logoUrl from '../../assets/MimerLogo_RGB_blk-blue.png'

const PAGE_W = 210
const BAR_H = 22
const SLANT_DEPTH = 8
const MARGIN_X = 16
const FOOTER_RESERVED = 28
const FOOTER_TEXT_TOP_OFFSET = 16
const BLUE = { r: 0, g: 123, b: 196 }

const contentBottom = (doc: jsPDF) =>
  (doc.internal.pageSize.height as number) - (FOOTER_RESERVED + 10)

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

const generateReceiptNumber = (
  type: 'loan' | 'return',
  loanType: 'regular' | 'maintenance' = 'regular'
): string => {
  const now = new Date()
  let prefix: string
  if (loanType === 'maintenance') {
    prefix = type === 'loan' ? 'NMU' : 'NMÅ'
  } else {
    prefix = type === 'loan' ? 'NYL' : 'NYÅ'
  }
  const timestamp = format(now, 'yyyyMMdd-HHmmss')
  return `${prefix}-${timestamp}`
}

const addHeader = async (
  doc: jsPDF,
  receiptType: 'loan' | 'return',
  loanType: 'regular' | 'maintenance' = 'regular'
) => {
  // Blue bar
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b)
  doc.rect(0, 0, PAGE_W, BAR_H, 'F')

  // Slanted edge (fallback to small bar if no triangle)
  if ((doc as any).triangle) {
    ;(doc as any).triangle(0, BAR_H, 60, BAR_H, 0, BAR_H + SLANT_DEPTH, 'F')
  } else {
    doc.rect(0, BAR_H, 60, 2, 'F')
  }

  // Title
  const title =
    receiptType === 'loan'
      ? 'NYCKELUTLÅNING - KVITTENS'
      : 'NYCKELÅTERLÄMNING - KVITTENS'
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(title, MARGIN_X, 16)

  // Logo on a white plate
  const img = await loadLogo()
  if (img) {
    const logoW = 42
    const logoH = (img.naturalHeight / img.naturalWidth) * logoW
    const platePadX = 6
    const platePadY = 3
    const logoX = PAGE_W - logoW - 12
    const logoY = (BAR_H - logoH) / 2
    doc.setFillColor(255, 255, 255)
    doc.rect(
      logoX - platePadX,
      logoY - platePadY,
      logoW + platePadX * 2,
      logoH + platePadY * 2,
      'F'
    )
    doc.addImage(img, 'JPEG', logoX, logoY, logoW, logoH, undefined, 'FAST')
  }

  // Meta
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const receiptNumber = generateReceiptNumber(receiptType, loanType)
  const metaY1 = BAR_H + 11
  const metaY2 = metaY1 + 7
  const metaY3 = metaY2 + 7
  const when = new Date()
  doc.text(`Kvittensnummer: ${receiptNumber}`, MARGIN_X, metaY1)
  doc.text(
    `Datum: ${format(when, 'dd MMMM yyyy', { locale: sv })}`,
    MARGIN_X,
    metaY2
  )
  doc.text(`Tid: ${format(when, 'HH:mm')}`, MARGIN_X, metaY3)

  return metaY3 + 11
}

const addTenantInfo = async (
  doc: jsPDF,
  tenants: ReceiptData['tenants'],
  lease: ReceiptData['lease'],
  y: number
) => {
  // Two-column layout: left column for HYRESGÄST, right column for AVTAL
  const leftCol = MARGIN_X
  const rightCol = 108

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('HYRESGÄST', leftCol, y)
  doc.text('AVTAL', rightCol, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  let leftY = y + 8
  let rightY = y + 8

  // Left column: Display all tenants
  tenants.forEach((tenant, index) => {
    const name = `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()
    const fullName = name || tenant.fullName || 'Okänt namn'
    const isCompany = tenant.contactCode?.toUpperCase().startsWith('F')
    const idLabel = isCompany ? 'Organisationsnummer' : 'Personnummer'

    if (index === 0) {
      doc.text(`Namn: ${fullName}`, leftCol, leftY)
      doc.text(
        `${idLabel}: ${tenant.nationalRegistrationNumber}`,
        leftCol,
        leftY + 7
      )
      doc.text(`Kundnummer: ${tenant.contactCode}`, leftCol, leftY + 14)
      leftY += 21
    } else {
      doc.text(`Namn: ${fullName}`, leftCol, leftY)
      doc.text(
        `${idLabel}: ${tenant.nationalRegistrationNumber}`,
        leftCol,
        leftY + 7
      )
      doc.text(`Kundnummer: ${tenant.contactCode}`, leftCol, leftY + 14)
      leftY += 21
    }
  })

  // Right column: Display AVTAL info
  doc.text(`Hyresobjekt: ${lease.rentalPropertyId}`, rightCol, rightY)
  rightY += 7

  // Wrap long leaseId (max width for right column)
  const leaseIdLines = doc.splitTextToSize(`Avtal ID: ${lease.leaseId}`, 82)
  doc.text(leaseIdLines, rightCol, rightY)
  const leaseIdBlockHeight = Array.isArray(leaseIdLines)
    ? (leaseIdLines as string[]).length * 7
    : 7
  rightY += leaseIdBlockHeight

  // Display rental property address
  try {
    const address = await rentalObjectSearchService.getAddressByRentalId(
      lease.rentalPropertyId
    )
    if (address && address !== 'Okänd adress') {
      doc.text(`Adress: ${address}`, rightCol, rightY)
      rightY += 7
    } else {
      doc.text(`Adress: n/a`, rightCol, rightY)
      rightY += 7
    }
  } catch (error) {
    console.warn('Failed to fetch address for PDF receipt:', error)
    doc.text(`Adress: n/a`, rightCol, rightY)
    rightY += 7
  }

  // Return the max Y position from both columns + spacing
  return Math.max(leftY, rightY) + 7
}

const addCompanyInfo = (
  doc: jsPDF,
  company: string,
  contactPerson: string | null,
  y: number
) => {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('FÖRETAG', MARGIN_X, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  let cy = y + 8

  doc.text(`Företagskod: ${company}`, MARGIN_X, cy)
  cy += 7

  if (contactPerson) {
    doc.text(`Kontaktperson: ${contactPerson}`, MARGIN_X, cy)
    cy += 7
  }

  return cy + 7
}

/**
 * Helper function to render keys in table format with multi-page support
 * @param doc - jsPDF document
 * @param keys - Keys to render
 * @param y - Starting Y position
 * @param headerText - Section header text
 * @param headerColor - RGB color for header (optional, defaults to black)
 * @param reserveAfter - Space to reserve after the table (only for final section)
 * @returns New Y position after rendering
 */
const renderKeysTable = (
  doc: jsPDF,
  keys: ReceiptData['keys'],
  y: number,
  headerText: string,
  headerColor?: { r: number; g: number; b: number },
  reserveAfter: number = 0
): number => {
  const bottom = contentBottom(doc)

  // Minimum space needed for a table section header + one row
  const minSpaceNeeded = 35

  // If not enough space for even the header, add new page
  if (y + minSpaceNeeded > bottom) {
    doc.addPage()
    y = 20 // Start from top of new page
  }

  // Helper function to render table header
  const renderTableHeader = (yPos: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text('Nyckelnamn', MARGIN_X, yPos)
    doc.text('Typ', 80, yPos)
    doc.text('Sek.nr', 120, yPos)
    doc.text('Flex.nr', 150, yPos)

    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b)
    doc.setLineWidth(0.4)
    doc.line(MARGIN_X, yPos + 2, 180, yPos + 2)

    return yPos + 7 // Return Y position after header
  }

  // Section header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  if (headerColor) {
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
  } else {
    doc.setTextColor(0, 0, 0)
  }
  doc.text(headerText, MARGIN_X, y)
  doc.setTextColor(0, 0, 0) // Reset to black for table content

  // Table header
  const top = y + 8
  let cy = renderTableHeader(top)

  // Table rows with multi-page support
  const rowH = 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  keys.forEach((k, index) => {
    // Check if we need a new page (reserve space only on last page)
    const isLastKey = index === keys.length - 1
    const spaceNeeded = isLastKey ? reserveAfter + 20 : rowH + 5 // Extra space for summary on last key

    if (cy + spaceNeeded > bottom) {
      // Draw bottom line before page break
      doc.line(MARGIN_X, cy, 180, cy)

      // Add new page and render table header again
      doc.addPage()
      cy = 20

      // Re-render section header on new page
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      if (headerColor) {
        doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
      }
      doc.text(`${headerText} (fortsättning)`, MARGIN_X, cy)
      doc.setTextColor(0, 0, 0)

      cy = renderTableHeader(cy + 8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
    }

    // Render the key row
    doc.text(k.keyName, MARGIN_X, cy)
    const labelForType =
      (KeyTypeLabels as Record<string, string>)[
        k.keyType as unknown as string
      ] || (k.keyType as string)
    doc.text(labelForType, 80, cy)
    doc.text(k.keySequenceNumber ? String(k.keySequenceNumber) : '-', 120, cy)
    doc.text(k.flexNumber ? String(k.flexNumber) : '-', 150, cy)
    cy += rowH
  })

  // Bottom rule
  doc.line(MARGIN_X, cy, 180, cy)
  cy += 8

  // Summary
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`Totalt antal nycklar: ${keys.length}`, MARGIN_X, cy)
  cy += 6

  return cy
}

/**
 * Helper function to render cards in table format with multi-page support
 * @param doc - jsPDF document
 * @param cards - Cards to render
 * @param y - Starting Y position
 * @param headerText - Section header text
 * @param headerColor - RGB color for header (optional, defaults to black)
 * @param reserveAfter - Space to reserve after the table (only for final section)
 * @returns New Y position after rendering
 */
const renderCardsTable = (
  doc: jsPDF,
  cards: Card[],
  y: number,
  headerText: string,
  headerColor?: { r: number; g: number; b: number },
  reserveAfter: number = 0
): number => {
  const bottom = contentBottom(doc)

  // Minimum space needed for a table section header + one row
  const minSpaceNeeded = 35

  // If not enough space for even the header, add new page
  if (y + minSpaceNeeded > bottom) {
    doc.addPage()
    y = 20 // Start from top of new page
  }

  // Helper function to render table header
  const renderTableHeader = (yPos: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text('Kortnamn', MARGIN_X, yPos)
    doc.text('Kort-ID', 80, yPos)
    doc.text('Status', 140, yPos)

    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b)
    doc.setLineWidth(0.4)
    doc.line(MARGIN_X, yPos + 2, 180, yPos + 2)

    return yPos + 7 // Return Y position after header
  }

  // Section header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  if (headerColor) {
    doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
  } else {
    doc.setTextColor(0, 0, 0)
  }
  doc.text(headerText, MARGIN_X, y)
  doc.setTextColor(0, 0, 0) // Reset to black for table content

  // Table header
  const top = y + 8
  let cy = renderTableHeader(top)

  // Table rows with multi-page support
  const rowH = 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  cards.forEach((card, index) => {
    // Check if we need a new page (reserve space only on last page)
    const isLastCard = index === cards.length - 1
    const spaceNeeded = isLastCard ? reserveAfter + 20 : rowH + 5

    if (cy + spaceNeeded > bottom) {
      // Draw bottom line before page break
      doc.line(MARGIN_X, cy, 180, cy)

      // Add new page and render table header again
      doc.addPage()
      cy = 20

      // Re-render section header on new page
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      if (headerColor) {
        doc.setTextColor(headerColor.r, headerColor.g, headerColor.b)
      }
      doc.text(`${headerText} (fortsättning)`, MARGIN_X, cy)
      doc.setTextColor(0, 0, 0)

      cy = renderTableHeader(cy + 8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
    }

    // Render the card row
    doc.text(card.name || '-', MARGIN_X, cy)
    doc.text(card.cardId, 80, cy)
    doc.text(card.disabled ? 'Inaktiv' : 'Aktiv', 140, cy)
    cy += rowH
  })

  // Bottom rule
  doc.line(MARGIN_X, cy, 180, cy)
  cy += 8

  // Summary
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`Totalt antal kort: ${cards.length}`, MARGIN_X, cy)
  cy += 6

  return cy
}

const addKeysTable = (
  doc: jsPDF,
  keys: ReceiptData['keys'],
  y: number,
  reserveAfter: number,
  missingKeys?: ReceiptData['missingKeys'],
  disposedKeys?: ReceiptData['disposedKeys']
) => {
  // Determine which section is the last one (to apply reserveAfter)
  const hasDisposedKeys = disposedKeys && disposedKeys.length > 0
  const hasMissingKeys = missingKeys && missingKeys.length > 0

  // Render returned keys section (don't reserve space unless it's the last section)
  const headerText =
    hasMissingKeys || hasDisposedKeys ? 'INLÄMNADE NYCKLAR' : 'NYCKLAR'
  const returnedReserve = !hasMissingKeys && !hasDisposedKeys ? reserveAfter : 0
  let cy = renderKeysTable(doc, keys, y, headerText, undefined, returnedReserve)

  // Render missing keys section if present
  if (hasMissingKeys) {
    cy += 4
    const redColor = { r: 200, g: 0, b: 0 }
    const missingReserve = !hasDisposedKeys ? reserveAfter : 0
    cy = renderKeysTable(
      doc,
      missingKeys,
      cy,
      'NYCKLAR SAKNAS VID INLÄMNING',
      redColor,
      missingReserve
    )
  }

  // Render disposed keys section if present (this is always last, so apply reserveAfter)
  if (hasDisposedKeys) {
    cy += 4
    const grayColor = { r: 150, g: 150, b: 150 }
    cy = renderKeysTable(
      doc,
      disposedKeys,
      cy,
      'TIDIGARE KASSERADE NYCKLAR',
      grayColor,
      reserveAfter
    )
  }

  return cy
}

const addCardsTable = (
  doc: jsPDF,
  cards: ReceiptData['cards'],
  y: number,
  reserveAfter: number,
  missingCards?: ReceiptData['missingCards']
) => {
  if (!cards || cards.length === 0) {
    // No cards to render, check if there are missing cards
    if (missingCards && missingCards.length > 0) {
      const redColor = { r: 200, g: 0, b: 0 }
      return renderCardsTable(
        doc,
        missingCards,
        y,
        'KORT SAKNAS VID INLÄMNING',
        redColor,
        reserveAfter
      )
    }
    return y
  }

  const hasMissingCards = missingCards && missingCards.length > 0

  // Render returned cards section
  const headerText = hasMissingCards ? 'INLÄMNADE KORT' : 'KORT'
  const returnedReserve = !hasMissingCards ? reserveAfter : 0
  let cy = renderCardsTable(
    doc,
    cards,
    y,
    headerText,
    undefined,
    returnedReserve
  )

  // Render missing cards section if present
  if (hasMissingCards) {
    cy += 4
    const redColor = { r: 200, g: 0, b: 0 }
    cy = renderCardsTable(
      doc,
      missingCards,
      cy,
      'KORT SAKNAS VID INLÄMNING',
      redColor,
      reserveAfter
    )
  }

  return cy
}

const addSignatureSection = (
  doc: jsPDF,
  y: number,
  tenants: ReceiptData['tenants']
) => {
  const bottom = contentBottom(doc)
  const tenantCount = tenants.length

  // Calculate space needed based on number of tenants
  // Each additional tenant needs ~18mm more space
  const fullNeed = 45 + (tenantCount - 1) * 18
  const compactNeed = 24 + (tenantCount - 1) * 18

  if (y + compactNeed > bottom) return y

  const canFull = y + fullNeed <= bottom

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('BEKRÄFTELSE', MARGIN_X, y)

  let cy = y + 10

  if (canFull) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const text =
      tenantCount > 1
        ? 'Vi bekräftar att vi har mottagit ovanstående nycklar och att vi är ansvariga för dem enligt hyresavtalet.'
        : 'Jag bekräftar att jag har mottagit ovanstående nycklar och att jag är ansvarig för dem enligt hyresavtalet.'
    const lines = doc.splitTextToSize(text, 170)
    lines.forEach((line) => {
      doc.text(line, MARGIN_X, cy)
      cy += 6
    })
    cy += 15
  } else {
    cy += 4
  }

  // Add signature lines for each tenant
  tenants.forEach((tenant, index) => {
    const name = `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()
    const fullName = name || tenant.fullName || 'Hyresgäst'

    // First signature line with date on the right
    doc.line(MARGIN_X, cy, 100, cy)
    doc.text(`${fullName} - Signatur`, MARGIN_X, cy + 8)

    // Add date field only for the first tenant
    if (index === 0) {
      doc.line(120, cy, 180, cy)
      doc.text('Datum', 120, cy + 8)
    }

    cy += 18
  })

  return cy + 2
}

const addFooter = (doc: jsPDF, kind: 'loan' | 'return', receiptId?: string) => {
  const h = doc.internal.pageSize.height as number
  const totalPages = doc.getNumberOfPages()

  // Add footer to each page
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    const disclaimerTop = h - FOOTER_TEXT_TOP_OFFSET
    if (kind === 'loan') {
      const text =
        'Nycklar ska återlämnas enligt hyresavtalets villkor. Vid förlust eller skada debiteras kostnad för byte av lås.'
      const lines = doc.splitTextToSize(text, 170)
      let cy = disclaimerTop
      lines.forEach((line) => {
        doc.text(line, MARGIN_X, cy)
        cy += 4
      })
    } else {
      doc.text(
        'Nycklar har återlämnats och kontrollerats.',
        MARGIN_X,
        disclaimerTop
      )
    }

    const contact =
      'Bostads AB Mimer • Box 1170, 721 29 Västerås • Besöksadress: Gasverksgatan 7 Tel: 021-39 70 00 • mimer.nu'
    doc.text(contact, MARGIN_X, h - 10)

    if (receiptId) {
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
      doc.text(`${receiptId}`, MARGIN_X, h - 4)
      doc.setFontSize(8)
    }

    // Page numbering
    if (totalPages > 1) {
      doc.text(`Sida ${i} av ${totalPages}`, 190, h - 4, { align: 'right' })
    } else {
      doc.text('Sida 1', 190, h - 4, { align: 'right' })
    }
  }
}

/* ---------------- Internal builders that DO NOT trigger download ---------------- */

async function buildLoanDoc(data: ReceiptData, receiptId?: string) {
  const doc = new jsPDF()
  let y = await addHeader(doc, 'loan')
  y = await addTenantInfo(doc, data.tenants, data.lease, y)

  // Check if we have cards to display
  const hasCards = data.cards && data.cards.length > 0

  // Reserve space for signature section, but if we have cards, don't reserve yet
  const keysReserve = hasCards ? 0 : 42
  y = addKeysTable(doc, data.keys, y, keysReserve, data.missingKeys)

  // Add cards section if present
  if (hasCards) {
    y += 6
    y = addCardsTable(doc, data.cards, y, 42)
  }

  addSignatureSection(doc, y, data.tenants)
  addFooter(doc, 'loan', receiptId)
  const fileName = `nyckelutlaning_${data.tenants[0].contactCode}_${format(
    new Date(),
    'yyyyMMdd'
  )}.pdf`
  return { doc, fileName }
}

async function buildReturnDoc(data: ReceiptData, receiptId?: string) {
  const doc = new jsPDF()
  let y = await addHeader(doc, 'return')
  y = await addTenantInfo(doc, data.tenants, data.lease, y)

  // Check if we have cards to display
  const hasCards =
    (data.cards && data.cards.length > 0) ||
    (data.missingCards && data.missingCards.length > 0)

  // keep ~22mm for confirmation text, but if we have cards, don't reserve yet
  const keysReserve = hasCards ? 0 : 22
  y = addKeysTable(
    doc,
    data.keys,
    y,
    keysReserve,
    data.missingKeys,
    data.disposedKeys
  )

  // Add cards section if present
  if (hasCards) {
    y += 6
    y = addCardsTable(doc, data.cards, y, 22, data.missingCards)
  }

  const bottom = contentBottom(doc)
  const need = 18
  if (y + need <= bottom) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('BEKRÄFTELSE', MARGIN_X, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)

    const hasMissingKeys = data.missingKeys && data.missingKeys.length > 0
    const hasMissingCards = data.missingCards && data.missingCards.length > 0
    let confirmText: string

    if (hasMissingKeys || hasMissingCards) {
      const missingItems: string[] = []
      if (hasMissingKeys) missingItems.push('nycklar')
      if (hasMissingCards) missingItems.push('kort')
      confirmText = `Ovanstående har återlämnats och kontrollerats av fastighetspersonal. Observera att vissa ${missingItems.join(' och ')} saknas (se lista ovan).`
    } else {
      confirmText =
        'Ovanstående nycklar har återlämnats och kontrollerats av fastighetspersonal.'
    }

    const lines = doc.splitTextToSize(confirmText, 170)
    let cy = y + 7
    lines.forEach((line: string) => {
      doc.text(line, MARGIN_X, cy)
      cy += 5.5
    })
  }

  addFooter(doc, 'return', receiptId)
  const fileName = `nyckelaterlamning_${data.tenants[0].contactCode}_${format(
    new Date(),
    'yyyyMMdd'
  )}.pdf`
  return { doc, fileName }
}

async function buildMaintenanceLoanDoc(
  data: MaintenanceReceiptData,
  receiptId?: string
) {
  const doc = new jsPDF()
  let y = await addHeader(doc, 'loan', 'maintenance')
  y = addCompanyInfo(doc, data.company, data.contactPerson, y)
  y = addKeysTable(doc, data.keys, y, 42)

  // Add simple signature section for maintenance receipts
  const bottom = contentBottom(doc)
  const need = 35
  if (y + need <= bottom) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('BEKRÄFTELSE', MARGIN_X, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const text =
      'Jag bekräftar att jag har mottagit ovanstående nycklar för underhållsändamål.'
    const lines = doc.splitTextToSize(text, 170)
    let cy = y + 10
    lines.forEach((line) => {
      doc.text(line, MARGIN_X, cy)
      cy += 5.5
    })

    cy += 5
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.2)
    doc.line(MARGIN_X, cy, 100, cy)
    cy += 5
    doc.setFontSize(9)
    doc.text(
      `Datum och underskrift - ${data.contactPerson || data.company}`,
      MARGIN_X,
      cy
    )
  }

  addFooter(doc, 'loan', receiptId)
  const fileName = `nyckelutlaning_underhall_${data.company}_${format(
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
  let y = await addHeader(doc, 'return', 'maintenance')
  y = addCompanyInfo(doc, data.company, data.contactPerson, y)
  y = addKeysTable(doc, data.keys, y, 22, data.missingKeys, data.disposedKeys)

  const bottom = contentBottom(doc)
  const need = 18
  if (y + need <= bottom) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('BEKRÄFTELSE', MARGIN_X, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const confirmText =
      data.missingKeys && data.missingKeys.length > 0
        ? 'Ovanstående nycklar har återlämnats och kontrollerats av fastighetspersonal. Observera att vissa nycklar saknas (se lista ovan).'
        : 'Ovanstående nycklar har återlämnats och kontrollerats av fastighetspersonal.'
    const lines = doc.splitTextToSize(confirmText, 170)
    let cy = y + 7
    lines.forEach((line) => {
      doc.text(line, MARGIN_X, cy)
      cy += 5.5
    })
  }

  addFooter(doc, 'return', receiptId)
  const fileName = `nyckelaterlamning_underhall_${data.company}_${format(
    new Date(),
    'yyyyMMdd'
  )}.pdf`
  return { doc, fileName }
}

/* ---------------- Public API: Downloaders (existing behavior) ---------------- */

export const generateLoanReceipt = async (
  data: ReceiptData,
  receiptId?: string
): Promise<void> => {
  const { doc, fileName } = await buildLoanDoc(data, receiptId)
  doc.save(fileName)
}

export const generateReturnReceipt = async (
  data: ReceiptData,
  receiptId?: string
): Promise<void> => {
  const { doc, fileName } = await buildReturnDoc(data, receiptId)
  doc.save(fileName)
}

/* ---------------- Public API: Blob helpers (for opening in a new tab) ---------------- */

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

/* ---------------- Public API: Maintenance receipts ---------------- */

export const generateMaintenanceLoanReceipt = async (
  data: MaintenanceReceiptData,
  receiptId?: string
): Promise<void> => {
  const { doc, fileName } = await buildMaintenanceLoanDoc(data, receiptId)
  doc.save(fileName)
}

export const generateMaintenanceReturnReceipt = async (
  data: MaintenanceReceiptData,
  receiptId?: string
): Promise<void> => {
  const { doc, fileName } = await buildMaintenanceReturnDoc(data, receiptId)
  doc.save(fileName)
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
