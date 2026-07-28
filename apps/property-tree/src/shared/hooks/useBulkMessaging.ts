import { useCallback, useMemo, useState } from 'react'

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
  // Rows unchecked while "all results" is selected: itemId -> contactCodes of
  // that row, captured at uncheck time (the row is on-screen when unchecked).
  // A Map (not a Set) so re-checking a row removes exactly its contribution,
  // and a contact shared by two excluded rows stays excluded until both are
  // re-checked.
  const [excludedItems, setExcludedItems] = useState<Map<string, string[]>>(
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
  const excludedContactCodes = useMemo(() => {
    const codes = new Set<string>()
    excludedItems.forEach((contactCodes) => {
      contactCodes.forEach((code) => codes.add(code))
    })
    return codes
  }, [excludedItems])

  // Toggle single item selection. In "all results" mode, unchecking a row
  // excludes it from the selection instead of collapsing the mode back to
  // the current page.
  const toggleSelection = useCallback(
    (id: string) => {
      if (allResultsSelected) {
        setExcludedItems((prev) => {
          const next = new Map(prev)
          if (next.has(id)) {
            next.delete(id)
          } else {
            const item = items.find((i) => getItemId(i) === id)
            next.set(
              id,
              item ? getContacts(item).map((c) => c.contactCode) : []
            )
          }
          return next
        })
        return
      }
      setSelectedItems((prev) => {
        const next = new Map(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          const item = items.find((i) => getItemId(i) === id)
          next.set(id, item ? getContacts(item) : [])
        }
        return next
      })
    },
    [allResultsSelected, items, getItemId, getContacts]
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

  // Derive SMS recipients from the hand-picked selection (contacts captured
  // at selection time, so the selection works across pages)
  const smsRecipientsFromSelection: SmsRecipient[] = useMemo(() => {
    const contactMap = new Map<string, SmsRecipient>()

    selectedItems.forEach((contacts) => {
      contacts.forEach((contact) => {
        if (!contactMap.has(contact.contactCode)) {
          contactMap.set(contact.contactCode, {
            id: contact.contactCode,
            name: contact.name,
            phone: contact.phone,
          })
        }
      })
    })

    return Array.from(contactMap.values())
  }, [selectedItems])

  // Derive email recipients from the hand-picked selection
  const emailRecipientsFromSelection: EmailRecipient[] = useMemo(() => {
    const contactMap = new Map<string, EmailRecipient>()

    selectedItems.forEach((contacts) => {
      contacts.forEach((contact) => {
        if (!contactMap.has(contact.contactCode)) {
          contactMap.set(contact.contactCode, {
            id: contact.contactCode,
            name: contact.name,
            email: contact.email,
          })
        }
      })
    })

    return Array.from(contactMap.values())
  }, [selectedItems])

  // Use fetched recipients if available, otherwise use selection-derived ones
  const smsRecipients = fetchedSmsRecipients ?? smsRecipientsFromSelection
  const emailRecipients = fetchedEmailRecipients ?? emailRecipientsFromSelection

  // Open SMS modal - fetch all contacts if "all results" selected
  const handleOpenSmsModal = useCallback(async () => {
    if (allResultsSelected && fetchAllContacts) {
      setIsLoadingContacts(true)
      try {
        const contacts = await fetchAllContacts()
        const recipients: SmsRecipient[] = contacts
          .filter((c) => !excludedContactCodes.has(c.contactCode))
          .map((c) => ({
            id: c.contactCode,
            name: c.name,
            phone: c.phone,
          }))
        setFetchedSmsRecipients(recipients)
        setShowSmsModal(true)
      } catch (error) {
        toast({
          title: 'Kunde inte hämta kontakter',
          description:
            error instanceof Error ? error.message : 'Ett fel uppstod',
          variant: 'destructive',
        })
      } finally {
        setIsLoadingContacts(false)
      }
    } else {
      setFetchedSmsRecipients(null)
      setShowSmsModal(true)
    }
  }, [allResultsSelected, fetchAllContacts, excludedContactCodes, toast])

  // Open Email modal - fetch all contacts if "all results" selected
  const handleOpenEmailModal = useCallback(async () => {
    if (allResultsSelected && fetchAllContacts) {
      setIsLoadingContacts(true)
      try {
        const contacts = await fetchAllContacts()
        const recipients: EmailRecipient[] = contacts
          .filter((c) => !excludedContactCodes.has(c.contactCode))
          .map((c) => ({
            id: c.contactCode,
            name: c.name,
            email: c.email,
          }))
        setFetchedEmailRecipients(recipients)
        setShowEmailModal(true)
      } catch (error) {
        toast({
          title: 'Kunde inte hämta kontakter',
          description:
            error instanceof Error ? error.message : 'Ett fel uppstod',
          variant: 'destructive',
        })
      } finally {
        setIsLoadingContacts(false)
      }
    } else {
      setFetchedEmailRecipients(null)
      setShowEmailModal(true)
    }
  }, [allResultsSelected, fetchAllContacts, excludedContactCodes, toast])

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
