import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useToast } from '@/shared/hooks/useToast'
import type { EmailRecipient } from '@/shared/ui/EmailModal'
import type { SmsRecipient } from '@/shared/ui/SmsModal'

export interface Contact {
  contactCode: string
  name: string
  phone: string | null
  email: string | null
}

export interface UseBulkMessagingOptions<TItem> {
  /** Items currently displayed on the page */
  items: TItem[]
  /** Total count across all pages (for "select all" display) */
  totalCount: number
  /** Extract unique ID from an item */
  getItemId: (item: TItem) => string
  /** Extract contacts from an item */
  getContacts: (item: TItem) => Contact[]
  /** Fetch all contacts matching current filters (for "select all results") */
  fetchAllContacts?: () => Promise<Contact[]>
  /** Send bulk SMS - returns the result plus any non-blocking warnings */
  sendBulkSms: (
    recipients: { contactCode: string; phoneNumber: string }[],
    message: string
  ) => Promise<{
    content: { totalSent: number; totalInvalid: number }
    warnings?: string[]
  }>
  /** Send bulk email - returns the result plus any non-blocking warnings */
  sendBulkEmail: (
    recipients: { contactCode: string; emailAddress: string }[],
    subject: string,
    body: string
  ) => Promise<{
    content: { totalSent: number; totalInvalid: number }
    warnings?: string[]
  }>
}

export interface UseBulkMessagingReturn {
  // Selection state
  selectedIds: string[]
  allResultsSelected: boolean
  selectedCount: number
  /** Unique contacts excluded via row unchecking in all-results mode */
  excludedRecipientsCount: number

  // Selection actions
  toggleSelection: (id: string) => void
  toggleSelectAll: () => void
  clearSelection: () => void
  isSelected: (id: string) => boolean

  // Modal state
  showSmsModal: boolean
  showEmailModal: boolean
  setShowSmsModal: (open: boolean) => void
  setShowEmailModal: (open: boolean) => void

  // Recipients for modals
  smsRecipients: SmsRecipient[]
  emailRecipients: EmailRecipient[]

  // Handlers
  handleOpenSmsModal: () => Promise<void>
  handleOpenEmailModal: () => Promise<void>
  handleSendSms: (message: string, recipients: SmsRecipient[]) => Promise<void>
  handleSendEmail: (
    subject: string,
    body: string,
    recipients: EmailRecipient[]
  ) => Promise<void>

  // Loading state
  isLoadingContacts: boolean
}

export function useBulkMessaging<TItem>({
  items,
  totalCount,
  getItemId,
  getContacts,
  fetchAllContacts,
  sendBulkSms,
  sendBulkEmail,
}: UseBulkMessagingOptions<TItem>): UseBulkMessagingReturn {
  const { toast } = useToast()

  // Selection state: itemId -> contacts of that row, captured at selection
  // time. Carrying the contacts lets a selection survive pagination — the
  // items of other pages are not available for lookup later.
  const [selectedItems, setSelectedItems] = useState<Map<string, Contact[]>>(
    new Map()
  )
  const [allResultsSelected, setAllResultsSelected] = useState(false)
  // Rows unchecked while "all results" is selected: itemId -> contacts of
  // that row, captured at uncheck time (the row is on-screen when unchecked).
  // A Map (not a Set) so re-checking a row removes exactly its contribution,
  // and a contact shared by two excluded rows stays excluded until both are
  // re-checked. Same shape as selectedItems so both toggles share one code
  // path.
  const [excludedItems, setExcludedItems] = useState<Map<string, Contact[]>>(
    new Map()
  )

  // Modal state
  const [showSmsModal, setShowSmsModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)

  // Fetched contacts when "all results" is selected
  const [fetchedSmsRecipients, setFetchedSmsRecipients] = useState<
    SmsRecipient[] | null
  >(null)
  const [fetchedEmailRecipients, setFetchedEmailRecipients] = useState<
    EmailRecipient[] | null
  >(null)

  const selectedIds = useMemo(
    () => Array.from(selectedItems.keys()),
    [selectedItems]
  )

  // Computed selection count
  const selectedCount = allResultsSelected
    ? totalCount - excludedItems.size
    : selectedItems.size

  // ContactCodes of all excluded rows. Note: exclusion is effectively per
  // CONTACT — if an excluded row's contact also appears on another selected
  // item, they are excluded from the send entirely. That matches the intent
  // ("don't message this person") and is what makes a frontend-only exclusion
  // possible, since fetched contacts carry no item association.
  const excludedContactCodes = useMemo(
    () =>
      new Set(
        Array.from(excludedItems.values()).flatMap((contacts) =>
          contacts.map((c) => c.contactCode)
        )
      ),
    [excludedItems]
  )

  // Toggle single item selection. In "all results" mode, unchecking a row
  // excludes it from the selection instead of collapsing the mode back to
  // the current page.
  const toggleSelection = useCallback(
    (id: string) => {
      const currentMap = allResultsSelected ? excludedItems : selectedItems
      const setMap = allResultsSelected ? setExcludedItems : setSelectedItems

      if (currentMap.has(id)) {
        setMap((prev) => {
          const next = new Map(prev)
          next.delete(id)
          return next
        })
        return
      }

      const item = items.find((i) => getItemId(i) === id)
      const contacts = item ? getContacts(item) : []
      if (allResultsSelected && contacts.length === 0) {
        // Exclusion works by filtering the row's contactCodes out of the
        // fetched recipient list. With no captured contacts the exclusion
        // would be a silent no-op (the tenant would still be messaged), so
        // refuse the uncheck instead of pretending it worked.
        toast({
          title: 'Raden kan inte undantas',
          description: 'Kontaktuppgifter saknas för raden.',
          variant: 'destructive',
        })
        return
      }
      setMap((prev) => new Map(prev).set(id, contacts))
    },
    [
      allResultsSelected,
      excludedItems,
      selectedItems,
      items,
      getItemId,
      getContacts,
      toast,
    ]
  )

  // Toggle select all (selects ALL results, not just current page)
  const toggleSelectAll = useCallback(() => {
    setExcludedItems(new Map())
    if (allResultsSelected || selectedItems.size > 0) {
      setSelectedItems(new Map())
      setAllResultsSelected(false)
    } else {
      setAllResultsSelected(true)
      setSelectedItems(
        new Map(items.map((item) => [getItemId(item), getContacts(item)]))
      )
    }
  }, [allResultsSelected, selectedItems.size, items, getItemId, getContacts])

  // Clear all selection
  const clearSelection = useCallback(() => {
    setSelectedItems(new Map())
    setAllResultsSelected(false)
    setExcludedItems(new Map())
  }, [])

  // Check if item is selected
  const isSelected = useCallback(
    (id: string) =>
      allResultsSelected ? !excludedItems.has(id) : selectedItems.has(id),
    [allResultsSelected, excludedItems, selectedItems]
  )

  // Unique contacts of the hand-picked selection (contacts captured at
  // selection time, so the selection works across pages). First occurrence
  // wins per contactCode. The exclusion filter is applied here too so every
  // recipient path respects exclusions by construction — in hand-picked mode
  // excludedContactCodes is always empty, making it a no-op there.
  const uniqueSelectedContacts = useMemo(() => {
    const byCode = new Map<string, Contact>()
    selectedItems.forEach((contacts) => {
      contacts.forEach((contact) => {
        if (!byCode.has(contact.contactCode)) {
          byCode.set(contact.contactCode, contact)
        }
      })
    })
    return Array.from(byCode.values()).filter(
      (c) => !excludedContactCodes.has(c.contactCode)
    )
  }, [selectedItems, excludedContactCodes])

  const smsRecipientsFromSelection: SmsRecipient[] = useMemo(
    () =>
      uniqueSelectedContacts.map((c) => ({
        id: c.contactCode,
        name: c.name,
        phone: c.phone,
      })),
    [uniqueSelectedContacts]
  )

  const emailRecipientsFromSelection: EmailRecipient[] = useMemo(
    () =>
      uniqueSelectedContacts.map((c) => ({
        id: c.contactCode,
        name: c.name,
        email: c.email,
      })),
    [uniqueSelectedContacts]
  )

  // Use fetched recipients if available, otherwise use selection-derived ones
  const smsRecipients = fetchedSmsRecipients ?? smsRecipientsFromSelection
  const emailRecipients = fetchedEmailRecipients ?? emailRecipientsFromSelection

  // Guards for the async contact fetch below: the exclusion set is read
  // through a ref so a fetch resolving AFTER the user unchecked another row
  // filters against the current set, and a generation counter discards
  // out-of-order responses (double-click) and resolutions after unmount.
  const excludedContactCodesRef = useRef(excludedContactCodes)
  excludedContactCodesRef.current = excludedContactCodes
  const openRequestIdRef = useRef(0)
  useEffect(
    () => () => {
      // Invalidate any in-flight fetch on unmount
      openRequestIdRef.current++
    },
    []
  )

  // Open a bulk modal. In "all results" mode the full filtered contact list
  // is fetched and exclusions are applied; otherwise recipients derive from
  // the hand-picked selection. Shared by the SMS and email handlers, which
  // differ only in how a Contact maps to their recipient shape.
  const openBulkModal = useCallback(
    async <R>(
      toRecipient: (c: Contact) => R,
      setFetchedRecipients: (recipients: R[] | null) => void,
      setShowModal: (open: boolean) => void
    ) => {
      if (allResultsSelected && fetchAllContacts) {
        const requestId = ++openRequestIdRef.current
        setIsLoadingContacts(true)
        try {
          const contacts = await fetchAllContacts()
          if (requestId !== openRequestIdRef.current) return
          const recipients = contacts
            .filter((c) => !excludedContactCodesRef.current.has(c.contactCode))
            .map(toRecipient)
          setFetchedRecipients(recipients)
          setShowModal(true)
        } catch (error) {
          if (requestId !== openRequestIdRef.current) return
          toast({
            title: 'Kunde inte hämta kontakter',
            description:
              error instanceof Error ? error.message : 'Ett fel uppstod',
            variant: 'destructive',
          })
        } finally {
          if (requestId === openRequestIdRef.current) {
            setIsLoadingContacts(false)
          }
        }
      } else {
        if (allResultsSelected) {
          // Recipients then derive from selectedItems, which only holds the
          // page captured at select-all time — a consumer bug, not a user
          // flow, hence the dev-facing warning.
          console.warn(
            'useBulkMessaging: allResultsSelected without fetchAllContacts — recipients are limited to the captured page'
          )
        }
        setFetchedRecipients(null)
        setShowModal(true)
      }
    },
    [allResultsSelected, fetchAllContacts, toast]
  )

  const handleOpenSmsModal = useCallback(
    () =>
      openBulkModal<SmsRecipient>(
        (c) => ({ id: c.contactCode, name: c.name, phone: c.phone }),
        setFetchedSmsRecipients,
        setShowSmsModal
      ),
    [openBulkModal]
  )

  const handleOpenEmailModal = useCallback(
    () =>
      openBulkModal<EmailRecipient>(
        (c) => ({ id: c.contactCode, name: c.name, email: c.email }),
        setFetchedEmailRecipients,
        setShowEmailModal
      ),
    [openBulkModal]
  )

  // Handle modal close - clear fetched recipients
  const handleSetShowSmsModal = useCallback((open: boolean) => {
    setShowSmsModal(open)
    if (!open) setFetchedSmsRecipients(null)
  }, [])

  const handleSetShowEmailModal = useCallback((open: boolean) => {
    setShowEmailModal(open)
    if (!open) setFetchedEmailRecipients(null)
  }, [])

  // Send SMS handler
  const handleSendSms = useCallback(
    async (message: string, validRecipients: SmsRecipient[]) => {
      try {
        const recipients = validRecipients
          .filter(
            (r): r is SmsRecipient & { phone: string } => r.phone !== null
          )
          .map((r) => ({ contactCode: r.id, phoneNumber: r.phone }))

        const result = await sendBulkSms(recipients, message)

        toast({
          title: 'SMS skickat',
          description: `Skickades till ${result.content.totalSent} mottagare${
            result.content.totalInvalid > 0
              ? `. ${result.content.totalInvalid} ogiltiga nummer.`
              : ''
          }`,
        })

        // Non-blocking: the SMS was sent, but something like communication-log
        // writing failed. Surface it without blocking the success flow.
        if (result.warnings?.length) {
          toast({
            title: 'SMS:et skickades, men en åtgärd misslyckades',
            description: result.warnings.join(' '),
            variant: 'destructive',
          })
        }

        clearSelection()
        setShowSmsModal(false)
      } catch (error) {
        const errorMessage = extractErrorMessage(error)
        toast({
          title: 'Kunde inte skicka SMS',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    },
    [sendBulkSms, toast, clearSelection]
  )

  // Send Email handler
  const handleSendEmail = useCallback(
    async (
      subject: string,
      body: string,
      validRecipients: EmailRecipient[]
    ) => {
      try {
        const recipients = validRecipients
          .filter(
            (r): r is EmailRecipient & { email: string } => r.email !== null
          )
          .map((r) => ({ contactCode: r.id, emailAddress: r.email }))

        const result = await sendBulkEmail(recipients, subject, body)

        toast({
          title: 'E-post skickat',
          description: `Skickade till ${result.content.totalSent} mottagare${
            result.content.totalInvalid > 0
              ? `. ${result.content.totalInvalid} ogiltiga e-postadresser.`
              : ''
          }`,
        })

        // Non-blocking: the email was sent, but something like communication-log
        // writing failed. Surface it without blocking the success flow.
        if (result.warnings?.length) {
          toast({
            title: 'E-posten skickades, men en åtgärd misslyckades',
            description: result.warnings.join(' '),
            variant: 'destructive',
          })
        }

        clearSelection()
        setShowEmailModal(false)
      } catch (error) {
        const errorMessage = extractErrorMessage(error)
        toast({
          title: 'Kunde inte skicka e-post',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    },
    [sendBulkEmail, toast, clearSelection]
  )

  return {
    // Selection state
    selectedIds,
    allResultsSelected,
    selectedCount,
    excludedRecipientsCount: excludedContactCodes.size,

    // Selection actions
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    isSelected,

    // Modal state
    showSmsModal,
    showEmailModal,
    setShowSmsModal: handleSetShowSmsModal,
    setShowEmailModal: handleSetShowEmailModal,

    // Recipients
    smsRecipients,
    emailRecipients,

    // Handlers
    handleOpenSmsModal,
    handleOpenEmailModal,
    handleSendSms,
    handleSendEmail,

    // Loading state
    isLoadingContacts,
  }
}

/** Extract error message from various error shapes */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const apiError = error as { message?: string; reason?: string }
    if (apiError.message) return apiError.message
    if (apiError.reason) return apiError.reason
  }
  return 'Ett fel uppstod'
}
