import { useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'

import { INSPECTION_STATUS } from '../constants/statuses'
import { INSPECTION_TYPE_LABELS } from '../constants/inspectionTypes'

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
import { Textarea } from '@/shared/ui/Textarea'

type CreateInspectionRequest = components['schemas']['CreateInspectionRequest']

const INSPECTION_TYPES = Object.entries(INSPECTION_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
)

interface CreateInspectionDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateInspectionRequest) => void
  isSubmitting?: boolean
  residenceId: string
  address: string
  apartmentCode: string | null
  leaseId: string
  roomNames: string[]
}

export function CreateInspectionDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  residenceId,
  address,
  apartmentCode,
  leaseId,
  roomNames,
}: CreateInspectionDialogProps) {
  const [inspector, setInspector] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [type, setType] = useState('')
  const [isFurnished, setIsFurnished] = useState(false)
  const [isTenantPresent, setIsTenantPresent] = useState(false)
  const [isNewTenantPresent, setIsNewTenantPresent] = useState(false)
  const [masterKeyAccess, setMasterKeyAccess] = useState('')
  const [notes, setNotes] = useState('')

  const canSubmit = inspector.trim() && type && date

  const handleSubmit = () => {
    if (!canSubmit) return

    const body: CreateInspectionRequest = {
      status: INSPECTION_STATUS.REGISTERED,
      date: new Date(date).toISOString(),
      startedAt: null,
      endedAt: null,
      inspector: inspector.trim(),
      type,
      residenceId,
      address,
      apartmentCode,
      isFurnished,
      leaseId,
      isTenantPresent,
      isNewTenantPresent,
      masterKeyAccess: masterKeyAccess.trim() || null,
      hasRemarks: false,
      notes: notes.trim() || null,
      totalCost: null,
      rooms: roomNames.map((name) => ({ room: name, remarks: [] })),
    }

    onSubmit(body)
  }

  const resetForm = () => {
    setInspector('')
    setDate(new Date().toISOString().slice(0, 10))
    setType('')
    setIsFurnished(false)
    setIsTenantPresent(false)
    setIsNewTenantPresent(false)
    setMasterKeyAccess('')
    setNotes('')
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inspector">Besiktningsman</Label>
              <Input
                id="inspector"
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                placeholder="Namn"
              />
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
                id="isFurnished"
                checked={isFurnished}
                onCheckedChange={(checked) => setIsFurnished(checked === true)}
              />
              <Label htmlFor="isFurnished">Möblerad</Label>
            </div>

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
            <Label htmlFor="masterKeyAccess">Huvudnyckelåtkomst</Label>
            <Input
              id="masterKeyAccess"
              value={masterKeyAccess}
              onChange={(e) => setMasterKeyAccess(e.target.value)}
              placeholder="T.ex. huvudnyckel, låssmed"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Anteckningar</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Valfria anteckningar"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Skapar...' : 'Skapa besiktning'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
