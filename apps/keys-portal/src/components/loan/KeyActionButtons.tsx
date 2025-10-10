import { Button } from '@/components/ui/button'
import { Plus, RefreshCw } from 'lucide-react'
import type { KeyWithStatus } from './LeaseKeyStatusList'

type Props = {
  selectedKeys: string[]
  keysWithStatus: KeyWithStatus[]
  tenantNames: string[]
  leaseIsNotPast: boolean
  isProcessing: boolean
  onRent: (keyIds: string[]) => void
  onReturn: (keyIds: string[]) => void
  onSwitch?: (keyIds: string[]) => void
}

export function KeyActionButtons({
  selectedKeys,
  keysWithStatus,
  tenantNames,
  leaseIsNotPast,
  isProcessing,
  onRent,
  onReturn,
  onSwitch,
}: Props) {
  const selectedKeysData = selectedKeys
    .map((id) => keysWithStatus.find((k) => k.id === id))
    .filter((k): k is KeyWithStatus => k !== undefined)

  const rentableKeys = selectedKeysData.filter(
    (k) => !k.loanInfo.isLoaned && leaseIsNotPast
  )

  const returnableKeys = selectedKeysData.filter(
    (k) =>
      k.loanInfo.isLoaned &&
      k.loanInfo.contact &&
      tenantNames.includes(k.loanInfo.contact)
  )

  const switchableKeys = selectedKeysData.filter(
    (k) =>
      k.loanInfo.isLoaned &&
      k.loanInfo.contact &&
      tenantNames.includes(k.loanInfo.contact) &&
      leaseIsNotPast
  )

  // All available keys
  const allAvailableKeys = keysWithStatus.filter(
    (k) => !k.loanInfo.isLoaned && leaseIsNotPast
  )

  // All keys rented by this tenant
  const allRentedByTenant = keysWithStatus.filter(
    (k) =>
      k.loanInfo.isLoaned &&
      k.loanInfo.contact &&
      tenantNames.includes(k.loanInfo.contact)
  )

  const hasSelectedKeys = selectedKeys.length > 0

  return (
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
          {onSwitch && switchableKeys.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSwitch(switchableKeys.map((k) => k.id))}
              disabled={isProcessing}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Byt nyckel ({switchableKeys.length})
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
  )
}
