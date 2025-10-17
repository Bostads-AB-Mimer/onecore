import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Copy, Trash2 } from 'lucide-react'

import type { KeyWithStatus } from '@/utils/keyStatusHelpers'
import { isNewFlexKey } from '@/utils/keyStatusHelpers'
import { FlexMenu } from './FlexMenu'
import { IncomingFlexMenu } from './IncomingFlexMenu'

type Props = {
  selectedKeys: string[]
  keysWithStatus: KeyWithStatus[]
  leaseIsNotPast: boolean
  isProcessing: boolean
  onRent: (keyIds: string[]) => void
  onReturn: (keyIds: string[]) => void
  onDispose?: (keyIds: string[]) => void
  onRefresh?: () => void
  allKeys?: KeyWithStatus[]
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
}: Props) {
  const [flexMenuOpen, setFlexMenuOpen] = useState(false)
  const [incomingFlexMenuOpen, setIncomingFlexMenuOpen] = useState(false)

  const selectedKeysData = selectedKeys
    .map((id) => keysWithStatus.find((k) => k.id === id))
    .filter((k): k is KeyWithStatus => k !== undefined)

  const rentableKeys = selectedKeysData.filter(
    (k) => !k.loanInfo.isLoaned && leaseIsNotPast
  )

  const returnableKeys = selectedKeysData.filter(
    (k) => k.loanInfo.isLoaned && k.loanInfo.matchesCurrentTenant
  )

  // All available keys (excluding disposed keys)
  const allAvailableKeys = keysWithStatus.filter(
    (k) => !k.loanInfo.isLoaned && leaseIsNotPast && !k.disposed
  )

  // All keys rented by this tenant
  const allRentedByTenant = keysWithStatus.filter(
    (k) => k.loanInfo.isLoaned && k.loanInfo.matchesCurrentTenant
  )

  const newFlexKeys = selectedKeysData.filter((k) =>
    isNewFlexKey(k, allKeys || keysWithStatus)
  )

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
            {newFlexKeys.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIncomingFlexMenuOpen(true)}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                Inkommen flex ({newFlexKeys.length})
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
        selectedKeys={newFlexKeys}
        allKeys={allKeys || keysWithStatus}
        onSuccess={onRefresh}
      />
    </>
  )
}
