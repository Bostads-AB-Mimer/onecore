import { describe, it, expect } from 'vitest'

import type { ReceiptData } from '@/services/types'

import {
  generateLoanReceiptBlob,
  generateReturnReceiptBlob,
} from './pdf-receipts'

// Smoke tests: exercise the real renderer end-to-end (jsPDF + fonts) for every
// loanType × receiptType combination, guarding the 4→2 merge. They assert a
// non-empty PDF and the right filename stem — not pixel layout (verify visually).

const key = (id: string, rentalObjectCode: string | null = 'OBJ-1') =>
  ({
    id,
    keyName: `Key ${id}`,
    keyType: 'LGH',
    disposed: false,
    rentalObjectCode,
    keySystem: { systemCode: 'SYS', name: 'System' },
  }) as unknown as ReceiptData['keys'][number]

const tenantBase: ReceiptData = {
  receiptType: 'LOAN',
  loanType: 'TENANT',
  contacts: [
    {
      contactCode: 'P001',
      firstName: 'Anna',
      lastName: 'Andersson',
      fullName: 'Anna Andersson',
      nationalRegistrationNumber: '199001011234',
    },
  ],
  keys: [key('k1')],
  rentalPropertyId: 'OBJ-1',
  leaseDisplayId: 'L-1',
  address: 'Testgatan 1',
  loanId: 'loan-1',
}

const maintenanceBase: ReceiptData = {
  receiptType: 'LOAN',
  loanType: 'MAINTENANCE',
  contacts: [{ contactCode: 'F001', fullName: 'Acme AB' }],
  contactPerson: 'Anders',
  keys: [key('k1'), key('k2', null)],
  scopeByKeyId: { k1: 'Storgatan 5', k2: 'System' },
  loanId: 'loan-2',
}

async function expectPdf(
  p: Promise<{ blob: Blob; fileName: string }>,
  stem: string
) {
  const { blob, fileName } = await p
  expect(blob).toBeInstanceOf(Blob)
  expect(blob.size).toBeGreaterThan(0)
  expect(fileName.startsWith(stem)).toBe(true)
}

describe('pdf-receipts renderer (real)', () => {
  it('renders a tenant loan receipt', async () => {
    await expectPdf(generateLoanReceiptBlob(tenantBase), 'nyckelutlaning_P001')
  })

  it('renders a tenant return receipt with missing + disposed sections', async () => {
    await expectPdf(
      generateReturnReceiptBlob({
        ...tenantBase,
        receiptType: 'RETURN',
        keys: [key('k1')],
        missingKeys: [key('k2')],
        disposedKeys: [key('k3')],
      }),
      'nyckelaterlamning_P001'
    )
  })

  it('renders a maintenance loan receipt with the scope column', async () => {
    await expectPdf(
      generateLoanReceiptBlob(maintenanceBase),
      'nyckelutlaning_F001'
    )
  })

  it('renders a maintenance return receipt with remaining-on-loan section', async () => {
    await expectPdf(
      generateReturnReceiptBlob({
        ...maintenanceBase,
        receiptType: 'RETURN',
        keys: [key('k1')],
        remainingLoanKeys: [key('k2', null)],
      }),
      'nyckelaterlamning_F001'
    )
  })
})
