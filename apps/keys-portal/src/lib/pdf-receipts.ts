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
    const fullName = `${tenant.firstName} ${tenant.lastName}`.trim()
    if (index === 0) {
      doc.text(`Namn: ${fullName}`, leftCol, leftY)
      doc.text(
        `Personnummer: ${tenant.nationalRegistrationNumber}`,
        leftCol,
        leftY + 7
      )
      doc.text(`Kundnummer: ${tenant.contactCode}`, leftCol, leftY + 14)
      leftY += 21
    } else {
      doc.text(`Namn: ${fullName}`, leftCol, leftY)
      doc.text(
        `Personnummer: ${tenant.nationalRegistrationNumber}`,
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

/**
 * Helper function to render keys in table format
 * @param doc - jsPDF document
 * @param keys - Keys to render
 * @param y - Starting Y position
 * @param headerText - Section header text
 * @param headerColor - RGB color for header (optional, defaults to black)
 * @param reserveAfter - Space to reserve after the table (only for final section)
 * @returns New Y position after rendering, or null if we need a new page
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
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Nyckelnamn', MARGIN_X, top)
  doc.text('Typ', 80, top)
  doc.text('Sek.nr', 120, top)
  doc.text('Flex.nr', 150, top)

  doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b)
  doc.setLineWidth(0.4)
  doc.line(MARGIN_X, top + 2, 180, top + 2)

  // Table rows - only apply reserveAfter if this is the final section
  const rowStartY = top + 7
  const rowH = 6
  const spaceForRows = bottom - reserveAfter - rowStartY
  const rowsAllowed = Math.max(1, Math.floor(spaceForRows / rowH)) // At least 1 row

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

  // Bottom rule
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

  // Summary
  doc.text(`Totalt antal nycklar: ${keys.length}`, MARGIN_X, cy)
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

const addSignatureSection = (doc: jsPDF, y: number) => {
  const bottom = contentBottom(doc)

  // Full-height block wants ~45mm
  const fullNeed = 45
  const compactNeed = 24 // minimal

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
      'Jag bekräftar att jag har mottagit ovanstående nycklar och att jag är ansvarig för dem enligt hyresavtalet.'
    const lines = doc.splitTextToSize(text, 170)
    lines.forEach((line) => {
      doc.text(line, MARGIN_X, cy)
      cy += 6
    })
    cy += 15
  } else {
    cy += 4
  }

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
    doc.setTextColor(128, 128, 128)
    doc.text(`${receiptId}`, MARGIN_X, h - 4)
    doc.setTextColor(0, 0, 0)
  }

  doc.text('Sida 1', 190, h - 4, { align: 'right' })
}

/* ---------------- Internal builders that DO NOT trigger download ---------------- */

async function buildLoanDoc(data: ReceiptData, receiptId?: string) {
  const doc = new jsPDF()
  let y = await addHeader(doc, 'loan')
  y = await addTenantInfo(doc, data.tenants, data.lease, y)
  y = addKeysTable(doc, data.keys, y, 42, data.missingKeys)
  addSignatureSection(doc, y)
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
  // keep ~22mm for confirmation text
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
  const fileName = `nyckelaterlamning_${data.tenants[0].contactCode}_${format(
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
