import type { Lease, MockKeyLoan } from '@/services/types'

const STORAGE_KEY = 'mock_key_loans_v1'
let memory: MockKeyLoan[] = []

const canUseStorage = () =>
  typeof window !== 'undefined' && !!globalThis.localStorage

const read = (): MockKeyLoan[] => {
  if (!canUseStorage()) return memory
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY)
    if (raw) memory = JSON.parse(raw)
  } catch (err) {
    void err
  }
  return memory
}

const write = (data: MockKeyLoan[]) => {
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

export const mockKeyLoans = {
  listByLease(leaseId: string) {
    const all = read()
    const active = all.filter(
      (l) => l.leaseId === leaseId && l.status === 'loaned'
    )
    const returned = all.filter(
      (l) => l.leaseId === leaseId && l.status === 'returned'
    )
    return { active, returned }
  },
  loanMany(params: { lease: Lease; tenantId: string; keyIds: string[] }) {
    const all = read()
    const now = new Date().toISOString()
    const created = params.keyIds.map((keyId) => ({
      id: uid(),
      keyId,
      leaseId: params.lease.leaseId,
      tenantId: params.tenantId,
      status: 'loaned' as const,
      createdAt: now,
    }))
    write([...all, ...created])
    return created
  },
  returnMany(loanIds: string[]) {
    const all = read()
    const now = new Date().toISOString()
    const idSet = new Set(loanIds)
    all.forEach((l) => {
      if (idSet.has(l.id)) {
        l.status = 'returned'
        l.returnedAt = now
      }
    })
    write(all)
    return all.filter((l) => idSet.has(l.id))
  },
}
