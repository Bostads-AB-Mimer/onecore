import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

import type { ReceiptData } from '@/services/types'
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

function ensureSpaceNoPage(doc: jsPDF, y: number, need: number): number {
  const bottom = contentBottom(doc)
  if (y + need > bottom) return y
  return y
}

const generateReceiptNumber = (type: 'loan' | 'return'): string => {
  const now = new Date()
  const prefix = type === 'loan' ? 'NYL' : 'NYÅ'
  const timestamp = format(now, 'yyyyMMdd-HHmmss')
  return `${prefix}-${timestamp}`
}

const addHeader = async (doc: jsPDF, receiptType: 'loan' | 'return') => {
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
      ? 'NYCKELUTLÅNING - KVITTO'
      : 'NYCKELÅTERLÄMNING - KVITTO'
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
    doc.addImage(img, 'PNG', logoX, logoY, logoW, logoH)
  }

  // Meta
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const receiptNumber = generateReceiptNumber(receiptType)
  const metaY1 = BAR_H + 11
  const metaY2 = metaY1 + 7
  const metaY3 = metaY2 + 7
  const when = new Date()
  doc.text(`Kvittonummer: ${receiptNumber}`, MARGIN_X, metaY1)
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
  // ~70mm block height (but we won't add a page automatically)
  y = ensureSpaceNoPage(doc, y, 70)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('HYRESGÄST', MARGIN_X, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  let nextY = y + 8

  // Display all tenants
  tenants.forEach((tenant, index) => {
    const fullName = `${tenant.firstName} ${tenant.lastName}`.trim()
    if (index === 0) {
      doc.text(`Namn: ${fullName}`, MARGIN_X, nextY)
      doc.text(
        `Personnummer: ${tenant.nationalRegistrationNumber}`,
        MARGIN_X,
        nextY + 7
      )
      doc.text(`Kundnummer: ${tenant.contactCode}`, MARGIN_X, nextY + 14)
      nextY += 21
    } else {
      doc.text(`Namn: ${fullName}`, MARGIN_X, nextY)
      doc.text(
        `Personnummer: ${tenant.nationalRegistrationNumber}`,
        MARGIN_X,
        nextY + 7
      )
      doc.text(`Kundnummer: ${tenant.contactCode}`, MARGIN_X, nextY + 14)
      nextY += 21
    }
  })

  // Display rental property address
  try {
    const address = await rentalObjectSearchService.getAddressByRentalId(
      lease.rentalPropertyId
    )
    if (address && address !== 'Okänd adress') {
      doc.text(`Adress: ${address}`, MARGIN_X, nextY)
      nextY += 7
    } else {
      doc.text(`Adress: n/a`, MARGIN_X, nextY)
      nextY += 7
    }
  } catch (error) {
    console.warn('Failed to fetch address for PDF receipt:', error)
    doc.text(`Adress: n/a`, MARGIN_X, nextY)
    nextY += 7
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('AVTAL', MARGIN_X, nextY + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Hyresobjekt: ${lease.rentalPropertyId}`, MARGIN_X, nextY + 15)

  // Wrap long leaseId (no truncation)
  const leaseIdY = nextY + 22
  const leaseIdLines = doc.splitTextToSize(`Avtal ID: ${lease.leaseId}`, 170)
  doc.text(leaseIdLines, MARGIN_X, leaseIdY)
  const leaseIdBlockHeight = Array.isArray(leaseIdLines)
    ? (leaseIdLines as string[]).length * 7
    : 7

  const afterLeaseY = leaseIdY + leaseIdBlockHeight
  doc.text(`Avtalnummer: ${lease.leaseNumber}`, MARGIN_X, afterLeaseY + 7)

  return afterLeaseY + 22
}

/**
 * Keys table that **always fits** on one page:
 * - Computes how many rows can fit given the remaining space and `reserveAfter`.
 * - Renders "+X fler" if truncated.
 * - Optionally shows missing keys section in RED
 */
const addKeysTable = (
  doc: jsPDF,
  keys: ReceiptData['keys'],
  y: number,
  reserveAfter: number, // mm to keep free for the block that follows (e.g., signature/confirmation)
  missingKeys?: ReceiptData['missingKeys'] // Keys that were not returned (for partial returns)
) => {
  const bottom = contentBottom(doc)

  // If nothing of the table header fits, bail
  if (y + 26 > bottom) return y

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('NYCKLAR', MARGIN_X, y)

  const top = y + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Nyckelnamn', MARGIN_X, top)
  doc.text('Typ', 80, top)
  doc.text('Sek.nr', 120, top)
  doc.text('Flex.nr', 150, top)

  doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b)
  doc.setLineWidth(0.4)
  doc.line(MARGIN_X, top + 2, 180, top + 2)

  const rowStartY = top + 7
  const rowH = 6 // compact row height
  const spaceForRows = bottom - reserveAfter - rowStartY
  const rowsAllowed = Math.max(0, Math.floor(spaceForRows / rowH))

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  let cy = rowStartY
  const visible = keys.slice(0, rowsAllowed)
  visible.forEach((k) => {
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

  // bottom rule
  doc.line(MARGIN_X, cy, 180, cy)

  // "+X fler" if truncated
  const extra = keys.length - visible.length
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  if (extra > 0) {
    doc.text(`… +${extra} fler`, MARGIN_X, cy + 6)
    cy += 12
  } else {
    cy += 8
  }

  // summary
  doc.text(`Totalt antal nycklar: ${keys.length}`, MARGIN_X, cy)
  cy += 6

  // Missing keys section (for partial returns)
  if (missingKeys && missingKeys.length > 0) {
    cy += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(200, 0, 0) // Red color for missing keys
    doc.text('SAKNADE NYCKLAR (ej återlämnade):', MARGIN_X, cy)
    cy += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0) // Reset to black
    missingKeys.forEach((k) => {
      const labelForType =
        (KeyTypeLabels as Record<string, string>)[
          k.keyType as unknown as string
        ] || (k.keyType as string)
      const text = `• ${k.keyName} (${labelForType})`
      doc.text(text, MARGIN_X, cy)
      cy += 5
    })
    cy += 2
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text(`Antal saknade nycklar: ${missingKeys.length}`, MARGIN_X, cy)
    cy += 6
  }

  return cy
}

/**
 * Signature section that **never** spills onto another page.
 * If there’s not enough room for the full paragraph, it draws a compact version.
 */
const addSignatureSection = (doc: jsPDF, y: number) => {
  const bottom = contentBottom(doc)

  // Full-height block wants ~45mm
  const fullNeed = 45
  const compactNeed = 24 // minimal: headline + signature lines

  // If even compact doesn’t fit, just return without drawing (extreme edge case)
  if (y + compactNeed > bottom) return y

  // Can we draw the full block?
  const canFull = y + fullNeed <= bottom

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('BEKRÄFTELSE', MARGIN_X, y)

  let cy = y + 10

  if (canFull) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const text =
      'Jag bekräftar att jag har mottagit ovanstående nycklar och att jag är ansvarig för dem enligt hyresavtalet.'
    const lines = doc.splitTextToSize(text, 170)
    lines.forEach((line) => {
      doc.text(line, MARGIN_X, cy)
      cy += 6
    })
    cy += 15
  } else {
    // Compact: no paragraph, just spacing before signature lines
    cy += 4
  }

  // Signature lines
  doc.line(MARGIN_X, cy, 100, cy)
  doc.text('Hyresgästens signatur', MARGIN_X, cy + 8)
  doc.line(120, cy, 180, cy)
  doc.text('Datum', 120, cy + 8)
  return cy + 20
}

const addFooter = (doc: jsPDF, kind: 'loan' | 'return', receiptId?: string) => {
  const h = doc.internal.pageSize.height as number

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  // Disclaimer a bit above bottom
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

  // Add receipt ID in subtle gray text for scanning purposes
  if (receiptId) {
    doc.setTextColor(128, 128, 128) // Light gray color
    doc.text(`${receiptId}`, MARGIN_X, h - 4)
    doc.setTextColor(0, 0, 0) // Reset to black
  }

  doc.text('Sida 1', 190, h - 4, { align: 'right' })
}

/** ---------------- Public API (always one page) ---------------- */

export const generateLoanReceipt = async (
  data: ReceiptData,
  receiptId?: string
): Promise<void> => {
  const doc = new jsPDF()
  let y = await addHeader(doc, 'loan')
  y = await addTenantInfo(doc, data.tenants, data.lease, y)
  y = addKeysTable(doc, data.keys, y, 42, data.missingKeys)
  addSignatureSection(doc, y)
  addFooter(doc, 'loan', receiptId)
  const file = `nyckelutlaning_${data.tenants[0].contactCode}_${format(new Date(), 'yyyyMMdd')}.pdf`
  doc.save(file)
}

export const generateReturnReceipt = async (
  data: ReceiptData,
  receiptId?: string
): Promise<void> => {
  const doc = new jsPDF()
  let y = await addHeader(doc, 'return')
  y = await addTenantInfo(doc, data.tenants, data.lease, y)
  // keep ~22mm for confirmation text
  y = addKeysTable(doc, data.keys, y, 22, data.missingKeys)

  // Compact confirmation block that will fit on one page
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
    y = cy
  }

  addFooter(doc, 'return', receiptId)
  const file = `nyckelaterlamning_${data.tenants[0].contactCode}_${format(new Date(), 'yyyyMMdd')}.pdf`
  doc.save(file)
}
