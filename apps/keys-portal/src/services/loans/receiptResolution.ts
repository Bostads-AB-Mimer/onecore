/**
 * Receipt info resolution — pure, no PDF, no loan mutation.
 *
 * Resolves the facts a receipt is built from: who it names (borrower), which rental
 * object + Avtal it carries, the per-key maintenance scope, and the split of a return
 * selection into returned/missing/disposed. Shared by loan and return, tenant and
 * maintenance; `receiptData` assembles these facts into the PDF-layer input.
 */
import { fetchContactByContactCode } from '../api/contactService'
import { fetchLeasesByRentalPropertyId } from '../api/leaseSearchService'
import { rentalObjectSearchService } from '../api/rentalObjectSearchService'
import type {
  Card,
  KeyDetails,
  KeyLoan,
  KeyLoanWithDetails,
  Lease,
  Tenant,
} from '../types'

// ----- Categorisation -----

export type KeyBuckets = {
  returned: KeyDetails[]
  missing: KeyDetails[]
  disposed: KeyDetails[]
}

/** Splits keys into returned (selected), missing (unselected), disposed (always). */
export function categorizeKeys(
  keys: KeyDetails[],
  selectedIds: Set<string>
): KeyBuckets {
  const buckets: KeyBuckets = { returned: [], missing: [], disposed: [] }
  keys.forEach((key) => {
    if (key.disposed) buckets.disposed.push(key)
    else if (selectedIds.has(key.id)) buckets.returned.push(key)
    else buckets.missing.push(key)
  })
  return buckets
}

export type CardBuckets = { returned: Card[]; missing: Card[] }

/** Splits cards into returned (selected) and missing (unselected). */
export function categorizeCards(
  cards: Card[],
  selectedIds: Set<string>
): CardBuckets {
  const buckets: CardBuckets = { returned: [], missing: [] }
  cards.forEach((card) => {
    if (selectedIds.has(card.cardId)) buckets.returned.push(card)
    else buckets.missing.push(card)
  })
  return buckets
}

// ----- Borrower -----

/**
 * Resolves the loan's borrower(s) from its own contact codes (never the page lease)
 * so the receipt names who the loan is registered to. Reuses a knownTenants match to
 * skip the API; throws if a code is missing/unresolvable, which blocks the receipt.
 */
export async function resolveBorrowers(
  loan: Pick<KeyLoan, 'contact' | 'contact2'>,
  knownTenants: Tenant[] = []
): Promise<Tenant[]> {
  const codes = [loan.contact, loan.contact2]
    .map((code) => code?.trim())
    .filter((code): code is string => !!code)
  const uniqueCodes = [...new Set(codes.map((code) => code.toUpperCase()))]

  if (uniqueCodes.length === 0) {
    throw new Error('Lånet saknar kontakt och kan inte få en kvittens.')
  }

  const knownByCode = new Map(
    knownTenants
      .filter((tenant) => tenant.contactCode)
      .map((tenant) => [tenant.contactCode.toUpperCase(), tenant])
  )

  const tenants: Tenant[] = []
  for (const code of uniqueCodes) {
    const known = knownByCode.get(code)
    if (known) {
      tenants.push(known)
      continue
    }
    const contact = await fetchContactByContactCode(code)
    if (!contact) {
      throw new Error(`Kunde inte hämta kontakten (${code}) för kvittensen.`)
    }
    tenants.push(contact)
  }

  return tenants
}

// ----- Object / Avtal -----

/**
 * One option per DISTINCT rental object on the loan's keys: the object's resolved
 * address and the lease(s) on it whose tenants include the loan's contact(s). The
 * receipt's object + Avtal are chosen from these. Empty when the keys carry no object.
 */
export type LoanObjectOption = {
  rentalPropertyId: string
  address: string | null
  matches: Lease[]
}

export async function resolveObjectOptions(
  loan: Pick<KeyLoanWithDetails, 'contact' | 'contact2' | 'keysArray'>
): Promise<LoanObjectOption[]> {
  const codes = [loan.contact, loan.contact2]
    .map((code) => code?.trim().toUpperCase())
    .filter((code): code is string => !!code)

  const rentalPropertyIds = [
    ...new Set(
      (loan.keysArray ?? [])
        .map((key) => key.rentalObjectCode)
        .filter((code): code is string => !!code && code.length > 0)
    ),
  ]

  return Promise.all(
    rentalPropertyIds.map(async (rentalPropertyId) => {
      const leases = await fetchLeasesByRentalPropertyId(rentalPropertyId)
      const matches = leases.filter((lease) =>
        (lease.tenants ?? []).some(
          (tenant) =>
            tenant.contactCode &&
            codes.includes(tenant.contactCode.toUpperCase())
        )
      )
      return {
        rentalPropertyId,
        address: await resolveObjectAddress(rentalPropertyId),
        matches,
      }
    })
  )
}

export type ResolvedContract = {
  rentalPropertyId?: string
  address: string | null
  leaseDisplayId?: string
}

/**
 * Picks the object + Avtal for a non-interactive (auto-generated) receipt, which
 * can't prompt. Single object → use it (address always; Avtals-ID only on a single
 * lease match). Multiple objects → use the one that uniquely has a matching lease;
 * otherwise leave object/address/Avtals-ID blank rather than guess.
 */
export function pickAutoContract(
  options: LoanObjectOption[]
): ResolvedContract {
  const withMatch = options.filter((o) => o.matches.length > 0)
  const chosen =
    options.length === 1
      ? options[0]
      : withMatch.length === 1
        ? withMatch[0]
        : undefined

  if (!chosen) return { rentalPropertyId: undefined, address: null }

  return {
    rentalPropertyId: chosen.rentalPropertyId,
    address: chosen.address,
    leaseDisplayId:
      chosen.matches.length === 1 ? chosen.matches[0].leaseId : undefined,
  }
}

/** Resolves a rental object's street address, normalising the unknown case to null. */
export async function resolveObjectAddress(
  rentalPropertyId: string
): Promise<string | null> {
  try {
    const fetched =
      await rentalObjectSearchService.getAddressByRentalId(rentalPropertyId)
    return fetched && fetched !== 'Okänd adress' ? fetched : null
  } catch {
    return null
  }
}

/**
 * Per-key scope map for a maintenance receipt's Tillhörighet column. Each key resolves
 * to its rentalObjectCode's street address, or keySystem.name for HN master keys where
 * rentalObjectCode is null. Missing data renders as '-' for a single empty state.
 */
export async function resolveScopeByKeyId(
  keys: KeyDetails[]
): Promise<Record<string, string>> {
  const uniqueCodes = Array.from(
    new Set(
      keys
        .map((k) => k.rentalObjectCode)
        .filter((c): c is string => !!c && c.length > 0)
    )
  )

  const addressMap =
    uniqueCodes.length > 0
      ? await rentalObjectSearchService.getAddressesByRentalIds(uniqueCodes)
      : {}

  const result: Record<string, string> = {}
  for (const key of keys) {
    if (key.rentalObjectCode) {
      result[key.id] = addressMap[key.rentalObjectCode] || '-'
    } else {
      result[key.id] = key.keySystem?.name || '-'
    }
  }
  return result
}
