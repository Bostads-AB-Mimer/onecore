import type { Receipt, ReceiptType } from '@/services/types'

const STORAGE_KEY = 'mock_receipts_v1'
let memory: Receipt[] = []

const canUseStorage = () =>
  typeof window !== 'undefined' && !!globalThis.localStorage

const read = (): Receipt[] => {
  if (!canUseStorage()) return memory
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY)
    if (raw) memory = JSON.parse(raw)
  } catch (err) {
    void err
  }
  return memory
}

const write = (data: Receipt[]) => {
  memory = data
  if (!canUseStorage()) return
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    void err
  }
}

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

export const mockReceipts = {
  listByLease(leaseId: string) {
    return read()
      .filter((r) => r.leaseId === leaseId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  create(params: {
    receiptType: ReceiptType
    leaseId: string
    tenantId: string
    keyLoanIds: string[]
    receiptNumber: string
  }) {
    const next: Receipt = {
      id: uid(),
      receiptNumber: params.receiptNumber,
      receiptType: params.receiptType,
      leaseId: params.leaseId,
      tenantId: params.tenantId,
      keyLoanIds: params.keyLoanIds,
      createdAt: new Date().toISOString(),
    }
    const all = read()
    write([next, ...all])
    return next
  },
}
