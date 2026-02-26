import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Copy, RefreshCw, Trash2 } from 'lucide-react'

import type { KeyDetails, CardDetails } from '@/services/types'
import { getActiveLoan } from '@/utils/loanHelpers'
import { FlexMenu } from './dialogs/FlexMenu'
import { IncomingFlexMenu } from './dialogs/IncomingFlexMenu'
import { IncomingOrderMenu } from './dialogs/IncomingOrderMenu'
import { ReplacementMenu } from './dialogs/ReplacementMenu'
import { IncomingReplacementMenu } from './dialogs/IncomingReplacementMenu'

type Props = {
  selectedKeys: string[]
  selectedCards?: string[]
  keysWithStatus: KeyDetails[]
  cardsWithStatus?: CardDetails[]
  leaseIsNotPast: boolean
  isProcessing: boolean
  onRent: (keyIds: string[], cardIds: string[]) => void
  onReturn: (keyIds: string[], cardIds: string[]) => void
  onDispose?: (keyIds: string[]) => void
  onRefresh?: () => void
  allKeys?: KeyDetails[]
  tenantContactCodes?: string[] // Add tenant contact codes for matching logic
}

export function KeyActionButtons({
  selectedKeys,
  selectedCards = [],
  keysWithStatus,
  cardsWithStatus = [],
  leaseIsNotPast,
  isProcessing,
  onRent,
  onReturn,
  onDispose,
  onRefresh,
  allKeys,
  tenantContactCodes = [],
}: Props) {
  const [flexMenuOpen, setFlexMenuOpen] = useState(false)
  const [incomingFlexMenuOpen, setIncomingFlexMenuOpen] = useState(false)
  const [incomingOrderMenuOpen, setIncomingOrderMenuOpen] = useState(false)
  const [replacementMenuOpen, setReplacementMenuOpen] = useState(false)
  const [incomingReplacementMenuOpen, setIncomingReplacementMenuOpen] =
    useState(false)

  // Helper to check if a key's or card's loan matches current tenant
  const matchesCurrentTenant = (item: KeyDetails | CardDetails) => {
    const activeLoan = getActiveLoan(item)
    if (!activeLoan) return false
    return (
      tenantContactCodes.includes(activeLoan.contact || '') ||
      tenantContactCodes.includes(activeLoan.contact2 || '')
    )
  }

  // Keys data
  const selectedKeysData = selectedKeys
    .map((id) => keysWithStatus.find((k) => k.id === id))
    .filter((k): k is KeyDetails => k !== undefined)

  const rentableKeys = selectedKeysData.filter(
    (k) => !getActiveLoan(k) && leaseIsNotPast
  )

  const returnableKeys = selectedKeysData.filter((k) => {
    const activeLoan = getActiveLoan(k)
    return !!activeLoan && matchesCurrentTenant(k)
  })

  // Cards data
  const selectedCardsData = selectedCards
    .map((id) => cardsWithStatus.find((c) => c.cardId === id))
    .filter((c): c is CardDetails => c !== undefined)

  const rentableCards = selectedCardsData.filter(
    (c) => !getActiveLoan(c) && leaseIsNotPast
  )

  const returnableCards = selectedCardsData.filter((c) => {
    const activeLoan = getActiveLoan(c)
    return !!activeLoan && matchesCurrentTenant(c)
  })

  // Keys that have "beställd flex" status (latest event is FLEX type with ORDERED status)
  const incomingFlexKeys = selectedKeysData.filter((k) => {
    const latestEvent = k.events?.[0] // Events are sorted by createdAt desc
    return (
      latestEvent &&
      latestEvent.type === 'FLEX' &&
      latestEvent.status === 'ORDERED'
    )
  })

  // Keys that have "beställd extranyckel" status (latest event is ORDER type with ORDERED status)
  const incomingOrderKeys = selectedKeysData.filter((k) => {
    const latestEvent = k.events?.[0] // Events are sorted by createdAt desc
    return (
      latestEvent &&
      latestEvent.type === 'ORDER' &&
      latestEvent.status === 'ORDERED'
    )
  })

  // Keys that have "beställd ersättning" status (latest event is REPLACEMENT type with ORDERED status)
  const incomingReplacementKeys = selectedKeysData.filter((k) => {
    const latestEvent = k.events?.[0] // Events are sorted by createdAt desc
    return (
      latestEvent &&
      latestEvent.type === 'REPLACEMENT' &&
      latestEvent.status === 'ORDERED'
    )
  })

  // Keys eligible for replacement (no active/non-completed event)
  const replacementEligibleKeys = selectedKeysData.filter((k) => {
    const latestEvent = k.events?.[0]
    return !latestEvent || latestEvent.status === 'COMPLETED'
  })

  // All available keys (excluding disposed keys)
  const allAvailableKeys = keysWithStatus.filter(
    (k) => !getActiveLoan(k) && leaseIsNotPast && !k.disposed
  )

  // All available cards
  const allAvailableCards = cardsWithStatus.filter(
    (c) => !getActiveLoan(c) && leaseIsNotPast
  )

  // All keys rented by this tenant
  const allRentedKeysByTenant = keysWithStatus.filter((k) => {
    const activeLoan = getActiveLoan(k)
    return !!activeLoan && matchesCurrentTenant(k)
  })

  // All cards rented by this tenant
  const allRentedCardsByTenant = cardsWithStatus.filter((c) => {
    const activeLoan = getActiveLoan(c)
    return !!activeLoan && matchesCurrentTenant(c)
  })

  const hasSelectedKeys = selectedKeys.length > 0

  // Combined counts for buttons
  const totalRentable = rentableKeys.length + rentableCards.length
  const totalReturnable = returnableKeys.length + returnableCards.length
  const totalAllAvailable = allAvailableKeys.length + allAvailableCards.length
  const totalAllRentedByTenant =
    allRentedKeysByTenant.length + allRentedCardsByTenant.length

  // Helper to generate button label with item types
  const getItemLabel = (keyCount: number, cardCount: number): string => {
    const parts = []
    if (keyCount > 0)
      parts.push(`${keyCount} ${keyCount === 1 ? 'nyckel' : 'nycklar'}`)
    if (cardCount > 0)
      parts.push(`${cardCount} dropp${cardCount > 1 ? 'ar' : 'e'}`)
    return parts.join(' + ')
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* Selected items buttons - show when any rentable/returnable items are selected */}
        {totalRentable > 0 && (
          <Button
            size="sm"
            onClick={() =>
              onRent(
                rentableKeys.map((k) => k.id),
                rentableCards.map((c) => c.cardId)
              )
            }
            disabled={isProcessing}
            className="flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Låna ut valda (
            {getItemLabel(rentableKeys.length, rentableCards.length)})
          </Button>
        )}
        {totalReturnable > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              onReturn(
                returnableKeys.map((k) => k.id),
                returnableCards.map((c) => c.cardId)
              )
            }
            disabled={isProcessing}
            className="flex items-center gap-1"
          >
            Återlämna valda (
            {getItemLabel(returnableKeys.length, returnableCards.length)})
          </Button>
        )}

        {/* Key-specific buttons (flex, incoming, dispose) */}
        {hasSelectedKeys && (
          <>
            {incomingFlexKeys.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIncomingFlexMenuOpen(true)}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                Inkommen flex ({incomingFlexKeys.length})
              </Button>
            )}
            {incomingOrderKeys.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIncomingOrderMenuOpen(true)}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                Inkommen extranyckel ({incomingOrderKeys.length})
              </Button>
            )}
            {incomingReplacementKeys.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIncomingReplacementMenuOpen(true)}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Inkommen ersättning ({incomingReplacementKeys.length})
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFlexMenuOpen(true)}
              disabled={isProcessing}
              className="flex items-center gap-1"
            >
              <Copy className="h-3 w-3" />
              Flex ({selectedKeys.length})
            </Button>
            {replacementEligibleKeys.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReplacementMenuOpen(true)}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Ersättning ({replacementEligibleKeys.length})
              </Button>
            )}
            {onDispose && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDispose(selectedKeys)}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Kassera ({selectedKeys.length})
              </Button>
            )}
          </>
        )}

        {/* Bulk action buttons */}
        {totalAllAvailable > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onRent(
                allAvailableKeys.map((k) => k.id),
                allAvailableCards.map((c) => c.cardId)
              )
            }
            disabled={isProcessing}
          >
            Låna ut alla tillgängliga (
            {getItemLabel(allAvailableKeys.length, allAvailableCards.length)})
          </Button>
        )}
        {totalAllRentedByTenant > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onReturn(
                allRentedKeysByTenant.map((k) => k.id),
                allRentedCardsByTenant.map((c) => c.cardId)
              )
            }
            disabled={isProcessing}
          >
            Återlämna alla (
            {getItemLabel(
              allRentedKeysByTenant.length,
              allRentedCardsByTenant.length
            )}
            )
          </Button>
        )}
      </div>

      <FlexMenu
        open={flexMenuOpen}
        onOpenChange={setFlexMenuOpen}
        selectedKeys={selectedKeysData}
        onSuccess={onRefresh}
      />

      <IncomingFlexMenu
        open={incomingFlexMenuOpen}
        onOpenChange={setIncomingFlexMenuOpen}
        selectedKeys={selectedKeysData}
        allKeys={allKeys || keysWithStatus}
        onSuccess={onRefresh}
      />

      <IncomingOrderMenu
        open={incomingOrderMenuOpen}
        onOpenChange={setIncomingOrderMenuOpen}
        selectedKeys={selectedKeysData}
        onSuccess={onRefresh}
      />

      <ReplacementMenu
        open={replacementMenuOpen}
        onOpenChange={setReplacementMenuOpen}
        selectedKeys={selectedKeysData}
        onSuccess={onRefresh}
      />

      <IncomingReplacementMenu
        open={incomingReplacementMenuOpen}
        onOpenChange={setIncomingReplacementMenuOpen}
        selectedKeys={selectedKeysData}
        onSuccess={onRefresh}
      />
    </>
  )
}
