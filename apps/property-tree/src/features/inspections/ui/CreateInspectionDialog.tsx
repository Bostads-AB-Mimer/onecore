import { useMemo, useState } from 'react'

import { LeaseStatusBadge } from '@/entities/lease'
import { ProtectedIdentityBadge } from '@/entities/tenant'

import type { Lease } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'

import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
import {
  INSPECTION_TYPE,
  INSPECTION_TYPE_LABELS,
} from '../constants/inspectionTypes'
import { INSPECTION_STATUS } from '../constants/statuses'
import { useCreateInspection } from '../hooks/useCreateInspection'
import { useInspectors } from '../hooks/useInspectors'

type CreateInspectionRequest = components['schemas']['CreateInspectionRequest']
type DetailedInspection = components['schemas']['DetailedInspection']

const INSPECTION_TYPES = Object.entries(INSPECTION_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
)

interface CreateInspectionDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (inspection: DetailedInspection) => void
  onError: () => void
  rentalId: string
  address: string
  apartmentCode: string | null
  leases: Lease[]
  roomNames: string[]
}

const NO_LEASE_VALUE = '__none__'

interface LeaseOption {
  value: string
  lease: Lease | null // null = "Inget kontrakt" sentinel
}

// At most three options: the active (Current/AboutToEnd) lease if one exists,
// the most recent Ended lease if one exists, and the "no contract" sentinel.
// The first entry is the default selection.
function buildLeaseOptions(leases: Lease[]): LeaseOption[] {
  const activeLease = leases.find(
    (l) => l.status === 'Current' || l.status === 'AboutToEnd'
  )
  const latestEndedLease = leases
    .filter((l) => l.status === 'Ended')
    .sort(
      (a, b) =>
        new Date(b.leaseStartDate).getTime() -
        new Date(a.leaseStartDate).getTime()
    )[0]

  const options: LeaseOption[] = []
  if (activeLease) {
    options.push({ value: activeLease.leaseId, lease: activeLease })
  }
  if (latestEndedLease) {
    options.push({ value: latestEndedLease.leaseId, lease: latestEndedLease })
  }
  options.push({ value: NO_LEASE_VALUE, lease: null })
  return options
}

export function CreateInspectionDialog({
  isOpen,
  onClose,
  onSuccess,
  onError,
  rentalId,
  address,
  apartmentCode,
  leases,
  roomNames,
}: CreateInspectionDialogProps) {
  const createInspection = useCreateInspection({ rentalId })
  const { data: inspectors, isLoading: isLoadingInspectors } = useInspectors()

  // Per product (David / MIM-829): default to "the contract that exists" and
  // offer at most two alternatives — the most recent ended lease and
  // "Inget kontrakt". Anything beyond that is overengineering for the
  // 1% case of selecting an older terminated tenant.
  const leaseOptions = useMemo(() => buildLeaseOptions(leases), [leases])
  const defaultLeaseValue = leaseOptions[0]?.value ?? NO_LEASE_VALUE

  const [inspector, setInspector] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  // Default to "avflytt" — the most common case at inspection time.
  const [type, setType] = useState<string>(INSPECTION_TYPE.MOVE_OUT)
  const [isTenantPresent, setIsTenantPresent] = useState(false)
  const [isNewTenantPresent, setIsNewTenantPresent] = useState(false)
  const [masterKeyAccess, setMasterKeyAccess] = useState('')
  const [leaseValue, setLeaseValue] = useState<string>(defaultLeaseValue)

  const canSubmit = inspector.trim() && type && date

  const handleSubmit = () => {
    if (!canSubmit) return

    // Empty string is the established "no lease" sentinel — the inspection
    // service stores it as-is and the protocol pipeline treats it as
    // "no recipient" rather than erroring on lookup.
    const submittedLeaseId = leaseValue === NO_LEASE_VALUE ? '' : leaseValue

    const body: CreateInspectionRequest = {
      status: INSPECTION_STATUS.REGISTERED,
      date: new Date(date).toISOString(),
      startedAt: null,
      endedAt: null,
      inspector: inspector.trim(),
      type,
      residenceId: rentalId,
      address,
      apartmentCode,
      // The inspector confirms furnishing during the conduct dialog (where
      // they're physically on-site). Seed `true` here since apartments are
      // furnished at inspection time in ~99% of cases; the conduct toggle is
      // the source of truth.
      isFurnished: true,
      leaseId: submittedLeaseId,
      isTenantPresent,
      isNewTenantPresent,
      masterKeyAccess: masterKeyAccess.trim() || null,
      hasRemarks: false,
      notes: null,
      totalCost: null,
      rooms: roomNames.map((name) => ({ room: name, remarks: [] })),
    }

    createInspection.mutate(body, {
      onSuccess: (inspection) => {
        resetForm()
        onSuccess(inspection)
      },
      onError,
    })
  }

  const resetForm = () => {
    setInspector('')
    setDate(new Date().toISOString().slice(0, 10))
    setType(INSPECTION_TYPE.MOVE_OUT)
    setIsTenantPresent(false)
    setIsNewTenantPresent(false)
    setMasterKeyAccess('')
    setLeaseValue(defaultLeaseValue)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-1">
          <DialogTitle>Skapa besiktning</DialogTitle>
          <DialogDescription>
            Skapa en ny besiktning för {address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="lease">Hyreskontrakt</Label>
            <Select value={leaseValue} onValueChange={setLeaseValue}>
              <SelectTrigger id="lease">
                <SelectValue placeholder="Välj hyreskontrakt" />
              </SelectTrigger>
              <SelectContent>
                {leaseOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.lease ? (
                      <span className="flex items-center gap-2">
                        <span>
                          Kontrakt {option.lease.leaseNumber} –{' '}
                          {option.lease.tenants?.[0]?.fullName ??
                            'Okänd hyresgäst'}
                        </span>
                        {option.lease.tenants?.[0]?.protectedIdentity && (
                          <ProtectedIdentityBadge size="sm" />
                        )}
                        <LeaseStatusBadge status={option.lease.status} />
                      </span>
                    ) : (
                      'Inget kontrakt'
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inspector">Besiktningsman</Label>
              <Select value={inspector} onValueChange={setInspector}>
                <SelectTrigger id="inspector" disabled={isLoadingInspectors}>
                  <SelectValue
                    placeholder={
                      isLoadingInspectors ? 'Laddar...' : 'Välj besiktningsman'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {inspectors?.map((user) => {
                    const name = `${user.firstName} ${user.lastName}`
                    return (
                      <SelectItem key={user.id} value={name}>
                        {name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Datum</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Typ av besiktning</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Välj typ" />
              </SelectTrigger>
              <SelectContent>
                {INSPECTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isTenantPresent"
                checked={isTenantPresent}
                onCheckedChange={(checked) =>
                  setIsTenantPresent(checked === true)
                }
              />
              <Label htmlFor="isTenantPresent">Hyresgäst närvarande</Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isNewTenantPresent"
                checked={isNewTenantPresent}
                onCheckedChange={(checked) =>
                  setIsNewTenantPresent(checked === true)
                }
              />
              <Label htmlFor="isNewTenantPresent">
                Ny hyresgäst närvarande
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="masterKeyAccess">Huvudnyckel</Label>
            <Select value={masterKeyAccess} onValueChange={setMasterKeyAccess}>
              <SelectTrigger id="masterKeyAccess">
                <SelectValue placeholder="Välj" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Huvudnyckel">Ja</SelectItem>
                <SelectItem value="Nej">Nej</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={createInspection.isPending}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || createInspection.isPending}
          >
            {createInspection.isPending ? 'Skapar...' : 'Skapa besiktning'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
