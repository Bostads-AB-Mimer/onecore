// services/api/receiptService.ts
import type { Receipt } from '@/services/types'

type CreateReceiptInput = {
  receiptType: 'loan' | 'return'
  leaseId: string
  tenantId: string
  keyLoanIds: string[]
  receiptNumber: string
}

const LS_KEY = 'receipts.local.v1'

function loadAll(): Receipt[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? (JSON.parse(raw) as Receipt[]) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveAll(list: Receipt[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {
    // best-effort: ignore storage failures
  }
}

function uid() {
  return `local_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

const toMs = (iso?: string) => (iso ? new Date(iso).getTime() : 0)

export const receiptService = {
  async create(input: CreateReceiptInput): Promise<void> {
    const nowIso = new Date().toISOString()
    const next: Receipt = {
      id: uid(),
      receiptNumber: input.receiptNumber,
      receiptType: input.receiptType,
      leaseId: input.leaseId,
      tenantId: input.tenantId,
      keyLoanIds: input.keyLoanIds,
      createdAt: nowIso,
    }

    const all = loadAll()
    saveAll([next, ...all])
  },

  async listByLease(leaseId: string): Promise<Receipt[]> {
    return loadAll()
      .filter((r) => r.leaseId === leaseId)
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
  },

  async listAll(): Promise<Receipt[]> {
    return loadAll().sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
  },

  async clearLocal(): Promise<void> {
    saveAll([])
  },
}
