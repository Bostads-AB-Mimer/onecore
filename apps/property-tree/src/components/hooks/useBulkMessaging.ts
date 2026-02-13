import { useState, useMemo, useCallback } from 'react'
import { useToast } from '@/components/hooks/useToast'
import type { SmsRecipient } from '@/components/ui/BulkSmsModal'
import type { EmailRecipient } from '@/components/ui/BulkEmailModal'

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
  /** Send bulk SMS - returns result with totalSent/totalInvalid */
  sendBulkSms: (
    phoneNumbers: string[],
    message: string
  ) => Promise<{ totalSent: number; totalInvalid: number }>
  /** Send bulk email - returns result with totalSent/totalInvalid */
  sendBulkEmail: (
    emails: string[],
    subject: string,
    body: string
  ) => Promise<{ totalSent: number; totalInvalid: number }>
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

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [allResultsSelected, setAllResultsSelected] = useState(false)

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

  // Computed selection count
  const selectedCount = allResultsSelected ? totalCount : selectedIds.length

  // Toggle single item selection
  const toggleSelection = useCallback((id: string) => {
    setAllResultsSelected(false)
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }, [])

  // Toggle select all (selects ALL results, not just current page)
  const toggleSelectAll = useCallback(() => {
    if (allResultsSelected || selectedIds.length > 0) {
      setSelectedIds([])
      setAllResultsSelected(false)
    } else {
      setAllResultsSelected(true)
      setSelectedIds(items.map(getItemId))
    }
  }, [allResultsSelected, selectedIds.length, items, getItemId])

  // Clear all selection
  const clearSelection = useCallback(() => {
    setSelectedIds([])
    setAllResultsSelected(false)
  }, [])

  // Check if item is selected
  const isSelected = useCallback(
    (id: string) => allResultsSelected || selectedIds.includes(id),
    [allResultsSelected, selectedIds]
  )

  // Derive SMS recipients from selected items on current page
  const smsRecipientsFromPage: SmsRecipient[] = useMemo(() => {
    const selectedItems = items.filter((item) =>
      selectedIds.includes(getItemId(item))
    )
    const contactMap = new Map<string, SmsRecipient>()

    selectedItems.forEach((item) => {
      getContacts(item).forEach((contact) => {
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
  }, [items, selectedIds, getItemId, getContacts])

  // Derive email recipients from selected items on current page
  const emailRecipientsFromPage: EmailRecipient[] = useMemo(() => {
    const selectedItems = items.filter((item) =>
      selectedIds.includes(getItemId(item))
    )
    const contactMap = new Map<string, EmailRecipient>()

    selectedItems.forEach((item) => {
      getContacts(item).forEach((contact) => {
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
  }, [items, selectedIds, getItemId, getContacts])

  // Use fetched recipients if available, otherwise use page-derived ones
  const smsRecipients = fetchedSmsRecipients ?? smsRecipientsFromPage
  const emailRecipients = fetchedEmailRecipients ?? emailRecipientsFromPage

  // Open SMS modal - fetch all contacts if "all results" selected
  const handleOpenSmsModal = useCallback(async () => {
    if (allResultsSelected && fetchAllContacts) {
      setIsLoadingContacts(true)
      try {
        const contacts = await fetchAllContacts()
        const recipients: SmsRecipient[] = contacts.map((c) => ({
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
  }, [allResultsSelected, fetchAllContacts, toast])

  // Open Email modal - fetch all contacts if "all results" selected
  const handleOpenEmailModal = useCallback(async () => {
    if (allResultsSelected && fetchAllContacts) {
      setIsLoadingContacts(true)
      try {
        const contacts = await fetchAllContacts()
        const recipients: EmailRecipient[] = contacts.map((c) => ({
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
  }, [allResultsSelected, fetchAllContacts, toast])

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
        const phoneNumbers = validRecipients
          .map((r) => r.phone)
          .filter((p): p is string => p !== null)

        const result = await sendBulkSms(phoneNumbers, message)

        toast({
          title: 'SMS skickat',
          description: `Skickades till ${result.totalSent} mottagare${
            result.totalInvalid > 0
              ? `. ${result.totalInvalid} ogiltiga nummer.`
              : ''
          }`,
        })

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
        const emails = validRecipients
          .map((r) => r.email)
          .filter((e): e is string => e !== null)

        const result = await sendBulkEmail(emails, subject, body)

        toast({
          title: 'E-post skickat',
          description: `Skickade till ${result.totalSent} mottagare${
            result.totalInvalid > 0
              ? `. ${result.totalInvalid} ogiltiga e-postadresser.`
              : ''
          }`,
        })

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
