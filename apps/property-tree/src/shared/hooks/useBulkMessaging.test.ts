// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type Contact,
  useBulkMessaging,
  type UseBulkMessagingReturn,
} from './useBulkMessaging'

// Lets React know act() is available outside a test renderer.
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Lease = { leaseId: string; contacts: Contact[] }

const contact = (code: string): Contact => ({
  contactCode: code,
  name: `Namn ${code}`,
  phone: `07000${code}`,
  email: `${code}@example.com`,
})

const anna = contact('P1')
const erik = contact('P2')
const sara = contact('P3')

// Two pages of the lease list; erik has a lease on each page.
const page1: Lease[] = [
  { leaseId: 'L1', contacts: [anna] },
  { leaseId: 'L2', contacts: [erik] },
  { leaseId: 'L3', contacts: [] },
]
const page2: Lease[] = [
  { leaseId: 'L4', contacts: [sara] },
  { leaseId: 'L5', contacts: [erik] },
]

let container: HTMLDivElement
let root: Root
let result: UseBulkMessagingReturn<Lease>
const fetchAllContacts = vi.fn<() => Promise<Contact[]>>()

function Harness({ items }: { items: Lease[] }) {
  result = useBulkMessaging({
    items,
    totalCount: page1.length + page2.length,
    getItemId: (lease) => lease.leaseId,
    // A new function on every render, like in LeasesPage.
    getContacts: (lease) => lease.contacts,
    fetchAllContacts,
    sendBulkSms: vi.fn(),
    sendBulkEmail: vi.fn(),
  })
  return null
}

/** Show a page of leases, like paging in the list does */
function showPage(items: Lease[]) {
  act(() => {
    root.render(createElement(Harness, { items }))
  })
}

const smsCodes = () => result.smsRecipients.map((r) => r.id).sort()
const emailCodes = () => result.emailRecipients.map((r) => r.id).sort()
const selectedIds = () =>
  result.selection.target.mode === 'include'
    ? result.selection.target.ids
    : []

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('useBulkMessaging selection across pages', () => {
  it('keeps the recipients of leases selected on another page', () => {
    showPage(page1)
    act(() => result.selection.toggle('L1'))
    act(() => result.selection.toggle('L2'))

    showPage(page2)
    act(() => result.selection.toggle('L4'))

    expect(result.selectedCount).toBe(3)
    expect(selectedIds()).toEqual(['L1', 'L2', 'L4'])
    expect(smsCodes()).toEqual(['P1', 'P2', 'P3'])
    expect(emailCodes()).toEqual(['P1', 'P2', 'P3'])
  })

  it('sends to a contact with leases on two pages once', () => {
    showPage(page1)
    act(() => result.selection.toggle('L2'))
    showPage(page2)
    act(() => result.selection.toggle('L5'))

    expect(result.selectedCount).toBe(2)
    expect(smsCodes()).toEqual(['P2'])
  })

  it('drops the recipients of a lease deselected after paging back', () => {
    showPage(page1)
    act(() => result.selection.toggle('L1'))
    showPage(page2)
    act(() => result.selection.toggle('L4'))
    showPage(page1)
    act(() => result.selection.toggle('L1'))

    expect(selectedIds()).toEqual(['L4'])
    expect(result.selection.isSelected('L1')).toBe(false)
    expect(smsCodes()).toEqual(['P3'])
    expect(emailCodes()).toEqual(['P3'])
  })

  it('keeps a shift-click range from another page', () => {
    showPage(page1)
    act(() => result.selection.toggle('L1'))
    act(() => result.selection.toggleRange('L3'))
    showPage(page2)

    expect(selectedIds()).toEqual(['L1', 'L2', 'L3'])
    expect(smsCodes()).toEqual(['P1', 'P2'])
  })

  it('clears the recipients of every page', () => {
    showPage(page1)
    act(() => result.selection.toggle('L1'))
    showPage(page2)
    act(() => result.selection.toggle('L4'))

    act(() => result.clearSelection())

    expect(result.selectedCount).toBe(0)
    expect(result.smsRecipients).toEqual([])
    expect(result.emailRecipients).toEqual([])
  })

  it('deselects selections from other pages with the select-all checkbox', () => {
    showPage(page1)
    act(() => result.selection.toggle('L1'))
    showPage(page2)

    act(() => result.toggleSelectAll())

    expect(result.selectedCount).toBe(0)
    expect(result.allResultsSelected).toBe(false)
    expect(result.smsRecipients).toEqual([])
  })

  it('fetches every contact when all results are selected', async () => {
    fetchAllContacts.mockResolvedValue([anna, erik, sara])
    showPage(page1)
    act(() => result.toggleSelectAll())

    expect(result.allResultsSelected).toBe(true)
    expect(result.selectedCount).toBe(5)

    await act(() => result.handleOpenSmsModal())

    expect(fetchAllContacts).toHaveBeenCalledOnce()
    expect(smsCodes()).toEqual(['P1', 'P2', 'P3'])
  })
})
