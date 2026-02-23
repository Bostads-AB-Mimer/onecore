import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import { Lease } from '@/services/api/core'
import { RentalPropertyInfo } from '@onecore/types'

interface LeaseContractSectionProps {
  leaseContracts: Lease[]
  rentalProperties: Record<string, RentalPropertyInfo | null>
  selectedLease?: string | null
  costCentre?: string
  propertyCode?: string
  onLeaseSelect: (leaseId: string) => void
  onCostCentreChange: (value: string) => void
  onPropertyCodeChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export function LeaseContractSection({
  leaseContracts,
  rentalProperties,
  selectedLease,
  costCentre,
  propertyCode,
  onLeaseSelect,
  onCostCentreChange,
  onPropertyCodeChange,
  error,
  disabled = false,
}: LeaseContractSectionProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4">
      <div className="space-y-2">
        <Label htmlFor="hyreskontrakt">Hyreskontrakt</Label>
        <Select
          value={selectedLease ?? undefined}
          onValueChange={onLeaseSelect}
          disabled={disabled || leaseContracts.length === 0}
        >
          <SelectTrigger
            id="hyreskontrakt"
            className={cn(error && 'border-destructive')}
          >
            <SelectValue
              placeholder={
                leaseContracts.length === 0
                  ? 'Välj kund först'
                  : 'Välj hyreskontrakt'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {leaseContracts.map((lease) => {
              const rentalProperty = rentalProperties[lease.rentalPropertyId]

              return (
                <SelectItem key={lease.leaseId} value={lease.leaseId}>
                  <span className="font-medium">{lease.leaseId}</span>
                  {rentalProperty && (
                    <span className="ml-2">
                      {`${rentalProperty.property.address}: ${rentalProperty.type}`}
                    </span>
                  )}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="kst">KST (Kostnadsställe)</Label>
        <Input
          id="kst"
          value={costCentre ?? ''}
          onChange={(e) => onCostCentreChange(e.target.value)}
          placeholder="Fylls i automatiskt"
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fastighet">Fastighet</Label>
        <Input
          id="fastighet"
          value={propertyCode ?? ''}
          onChange={(e) => onPropertyCodeChange(e.target.value)}
          placeholder="Fylls i automatiskt"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
