import { ContactCode } from './contact'

/**
 * One of a person's contacts, with what it is used for.
 *
 * A personnummer is not unique among contacts in Xpand. Next to the contact a
 * person actually uses, it can have a second one from registering twice on
 * mimer.nu, or a contact staff created to pay money out to them (supplier
 * role only). These signals are what tell them apart.
 */
export type LoginContactCandidate = {
  contactCode: ContactCode
  /**
   * Its only role is Leverantör: a contact staff create to pay money out to
   * the person, never the one they use.
   */
  supplierOnly: boolean
  /** Holds a lease today (INNEHAVARE), including one under notice. */
  currentTenant: boolean
  /** Has queue time (bkqte). */
  queueTime: boolean
  /** Has an Xpand user (keysyusr), which mimer.nu registration creates. */
  xpandUser: boolean
  /**
   * Its Sökande role is in use (`croused`), which is what webapi requires to
   * let the person in. Not a ranking signal: login picks the same contact
   * either way, and refuses it when it is inactive.
   */
  isActive: boolean
  createdAt: Date | null
}

/** One of a person's contacts, and whether they can log in with it. */
export type PersonContact = {
  contactCode: ContactCode
  isActive: boolean
}

export type LoginContactChoice = {
  contactCode: ContactCode
  /**
   * More than one contact had the same signals, so only age decided. These
   * are people whose contacts need merging by hand.
   */
  ambiguous: boolean
  /** Every candidate, best first. */
  candidates: ContactCode[]
}

const signals = (c: LoginContactCandidate) =>
  [!c.supplierOnly, c.currentTenant, c.queueTime, c.xpandUser].map(Number)

const compareSignals = (a: LoginContactCandidate, b: LoginContactCandidate) => {
  const sa = signals(a)
  const sb = signals(b)
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return sb[i] - sa[i]
  }
  return 0
}

const compareAge = (a: LoginContactCandidate, b: LoginContactCandidate) => {
  const ta = a.createdAt?.getTime() ?? -Infinity
  const tb = b.createdAt?.getTime() ?? -Infinity
  if (ta !== tb) return tb - ta
  // Same day or no date: the code decides, so the answer never depends on
  // the order rows came back in.
  return b.contactCode.localeCompare(a.contactCode)
}

/**
 * The contacts for a personnummer in the order login prefers them: anything but
 * a supplier-only contact first, then a current tenant, then one with queue
 * time, then one with an Xpand user. When those tie, the newest wins, since a
 * second registration is made because the older one no longer works.
 */
export const rankLoginContacts = (
  candidates: LoginContactCandidate[]
): LoginContactCandidate[] =>
  [...candidates].sort((a, b) => compareSignals(a, b) || compareAge(a, b))

/**
 * Picks the contact a person logs in as among the contacts for their
 * personnummer: the first by `rankLoginContacts`.
 *
 * @returns null when there are no candidates.
 */
export const pickLoginContact = (
  candidates: LoginContactCandidate[]
): LoginContactChoice | null => {
  if (candidates.length === 0) return null

  const ranked = rankLoginContacts(candidates)

  return {
    contactCode: ranked[0].contactCode,
    ambiguous: ranked.length > 1 && compareSignals(ranked[0], ranked[1]) === 0,
    candidates: ranked.map((c) => c.contactCode),
  }
}
