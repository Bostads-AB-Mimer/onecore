import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Copy, Trash2 } from 'lucide-react'

import type { KeyDetails } from '@/services/types'
import { getActiveLoan } from '@/utils/loanHelpers'
import { FlexMenu } from './dialogs/FlexMenu'
import { IncomingFlexMenu } from './dialogs/IncomingFlexMenu'
import { IncomingOrderMenu } from './dialogs/IncomingOrderMenu'

type Props = {
  selectedKeys: string[]
  keysWithStatus: KeyDetails[]
  leaseIsNotPast: boolean
  isProcessing: boolean
  onRent: (keyIds: string[]) => void
  onReturn: (keyIds: string[]) => void
  onDispose?: (keyIds: string[]) => void
  onRefresh?: () => void
  allKeys?: KeyDetails[]
  tenantContactCodes?: string[] // Add tenant contact codes for matching logic
}

export function KeyActionButtons({
  selectedKeys,
  keysWithStatus,
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

  // Helper to check if a key's loan matches current tenant
  const matchesCurrentTenant = (key: KeyDetails) => {
    const activeLoan = getActiveLoan(key)
    if (!activeLoan) return false
    return (
      tenantContactCodes.includes(activeLoan.contact || '') ||
      tenantContactCodes.includes(activeLoan.contact2 || '')
    )
  }

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

  // All available keys (excluding disposed keys)
  const allAvailableKeys = keysWithStatus.filter(
    (k) => !getActiveLoan(k) && leaseIsNotPast && !k.disposed
  )

  // All keys rented by this tenant
  const allRentedByTenant = keysWithStatus.filter((k) => {
    const activeLoan = getActiveLoan(k)
    return !!activeLoan && matchesCurrentTenant(k)
  })

  const hasSelectedKeys = selectedKeys.length > 0

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* Selected keys buttons */}
        {hasSelectedKeys && (
          <>
            {rentableKeys.length > 0 && (
              <Button
                size="sm"
                onClick={() => onRent(rentableKeys.map((k) => k.id))}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Låna ut valda ({rentableKeys.length})
              </Button>
            )}
            {returnableKeys.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onReturn(returnableKeys.map((k) => k.id))}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                Återlämna valda ({returnableKeys.length})
              </Button>
            )}
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
        {allAvailableKeys.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRent(allAvailableKeys.map((k) => k.id))}
            disabled={isProcessing}
          >
            Låna ut alla tillgängliga ({allAvailableKeys.length})
          </Button>
        )}
        {allRentedByTenant.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReturn(allRentedByTenant.map((k) => k.id))}
            disabled={isProcessing}
          >
            Återlämna alla ({allRentedByTenant.length})
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
    </>
  )
}
