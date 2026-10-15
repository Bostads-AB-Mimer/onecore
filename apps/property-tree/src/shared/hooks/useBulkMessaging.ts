import { useCallback, useMemo, useState } from 'react'
import { type RowSelection, useRowSelection, useToast } from '@onecore/ui'

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

export interface UseBulkMessagingReturn<TItem> {
  selection: RowSelection<TItem> // hand to ResponsiveTable
  allResultsSelected: boolean // exclude mode: every result minus the unticked ones
  selectedCount: number
  toggleSelectAll: () => void // every result, or clear when anything is selected
  clearSelection: () => void

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
}: UseBulkMessagingOptions<TItem>): UseBulkMessagingReturn<TItem> {
  const { toast } = useToast()

  const selection = useRowSelection(items, getItemId, { totalCount })
  const {
    target,
    selectedRows,
    count: selectedCount,
    clear: clearSelection,
  } = selection
  const allResultsSelected = target.mode === 'exclude'

  // Contacts on rows unticked in exclude mode are dropped from the fetched set,
  // even if the same contact is also on a ticked row: unticking means "leave out".
  const excludedContactCodes = useMemo(
    () =>
      new Set(
        (target.mode === 'exclude' ? target.excludedRows : []).flatMap((row) =>
          getContacts(row).map((c) => c.contactCode)
        )
      ),
    [target, getContacts]
  )
  const fetchIncludedContacts = useCallback(async () => {
    if (!fetchAllContacts) return []
    const contacts = await fetchAllContacts()
    return contacts.filter((c) => !excludedContactCodes.has(c.contactCode))
  }, [fetchAllContacts, excludedContactCodes])

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

  const { selectAllResults } = selection
  const toggleSelectAll = useCallback(() => {
    if (selectedCount > 0) clearSelection()
    else selectAllResults()
  }, [selectedCount, clearSelection, selectAllResults])

  // The table's header checkbox selects every result, not just the page.
  const tableSelection = { ...selection, togglePage: toggleSelectAll }

  // Recipients from the selected rows, across pages
  const smsRecipientsFromPage: SmsRecipient[] = useMemo(() => {
    const contactMap = new Map<string, SmsRecipient>()

    selectedRows.forEach((item) => {
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
  }, [selectedRows, getContacts])

  const emailRecipientsFromPage: EmailRecipient[] = useMemo(() => {
    const contactMap = new Map<string, EmailRecipient>()

    selectedRows.forEach((item) => {
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
  }, [selectedRows, getContacts])

  // Use fetched recipients if available, otherwise use page-derived ones
  const smsRecipients = fetchedSmsRecipients ?? smsRecipientsFromPage
  const emailRecipients = fetchedEmailRecipients ?? emailRecipientsFromPage

  // Open SMS modal - fetch all contacts if "all results" selected
  const handleOpenSmsModal = useCallback(async () => {
    if (allResultsSelected && fetchAllContacts) {
      setIsLoadingContacts(true)
      try {
        const contacts = await fetchIncludedContacts()
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
  }, [allResultsSelected, fetchAllContacts, fetchIncludedContacts, toast])

  // Open Email modal - fetch all contacts if "all results" selected
  const handleOpenEmailModal = useCallback(async () => {
    if (allResultsSelected && fetchAllContacts) {
      setIsLoadingContacts(true)
      try {
        const contacts = await fetchIncludedContacts()
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
  }, [allResultsSelected, fetchAllContacts, fetchIncludedContacts, toast])

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
    selection: tableSelection,
    allResultsSelected,
    selectedCount,
    toggleSelectAll,
    clearSelection,

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
