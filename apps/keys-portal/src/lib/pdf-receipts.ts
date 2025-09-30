// src/lib/pdf-receipts.ts
import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

import type { ReceiptData } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'

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

const addTenantInfo = (
  doc: jsPDF,
  tenant: ReceiptData['tenant'],
  lease: ReceiptData['lease'],
  y: number
) => {
  // ~60mm block height (but we won’t add a page automatically)
  y = ensureSpaceNoPage(doc, y, 60)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('HYRESGÄST', MARGIN_X, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const nextY = y + 8
  doc.text(
    `Namn: ${tenant.firstName} ${tenant.lastName}`.trim(),
    MARGIN_X,
    nextY
  )
  doc.text(`Personnummer: ${tenant.personnummer}`, MARGIN_X, nextY + 7)
  if (tenant.address)
    doc.text(`Adress: ${tenant.address}`, MARGIN_X, nextY + 14)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('AVTAL', MARGIN_X, nextY + 28)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Hyresobjekt: ${lease.rentalPropertyId}`, MARGIN_X, nextY + 36)

  // Wrap long leaseId (no truncation)
  const leaseIdY = nextY + 43
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
 */
const addKeysTable = (
  doc: jsPDF,
  keys: ReceiptData['keys'],
  y: number,
  reserveAfter: number // mm to keep free for the block that follows (e.g., signature/confirmation)
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
  return cy + 6
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

const addFooter = (doc: jsPDF, kind: 'loan' | 'return') => {
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
    'Bostads AB Mimer • Box 1170, 721 29 Västerås • Besök Torggatan 4  Tel 021-39 70 10 • Felanmälan 021-39 70 90 • mimer.nu'
  doc.text(contact, MARGIN_X, h - 10)

  doc.text('Sida 1', 190, h - 4, { align: 'right' })
}

/** ---------------- Public API (always one page) ---------------- */

export const generateLoanReceipt = async (data: ReceiptData): Promise<void> => {
  const doc = new jsPDF()
  let y = await addHeader(doc, 'loan')
  y = addTenantInfo(doc, data.tenant, data.lease, y)
  y = addKeysTable(doc, data.keys, y, 42)
  addSignatureSection(doc, y)
  addFooter(doc, 'loan')
  const file = `nyckelutlaning_${data.tenant.personnummer}_${format(new Date(), 'yyyyMMdd')}.pdf`
  doc.save(file)
}

export const generateReturnReceipt = async (
  data: ReceiptData
): Promise<void> => {
  const doc = new jsPDF()
  let y = await addHeader(doc, 'return')
  y = addTenantInfo(doc, data.tenant, data.lease, y)
  // keep ~22mm for confirmation text
  y = addKeysTable(doc, data.keys, y, 22)

  // Compact confirmation block that will fit on one page
  const bottom = contentBottom(doc)
  const need = 18
  if (y + need <= bottom) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('BEKRÄFTELSE', MARGIN_X, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const lines = doc.splitTextToSize(
      'Ovanstående nycklar har återlämnats och kontrollerats av fastighetspersonal.',
      170
    )
    let cy = y + 7
    lines.forEach((line) => {
      doc.text(line, MARGIN_X, cy)
      cy += 5.5
    })
    y = cy
  }

  addFooter(doc, 'return')
  const file = `nyckelaterlamning_${data.tenant.personnummer}_${format(new Date(), 'yyyyMMdd')}.pdf`
  doc.save(file)
}
