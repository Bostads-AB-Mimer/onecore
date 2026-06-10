import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'

import type { InspectionWorkOrderGroup } from '../lib/buildInspectionWorkOrderGroups'

interface CreateInspectionWorkOrdersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: InspectionWorkOrderGroup[]
  unassignedCount: number
  createdTeamIds: Set<number>
  isCreating: boolean
  onConfirm: () => void
}

/**
 * Previews the work orders that will be created (one per resursgrupp) before the
 * inspection is completed, and surfaces any Skadad components left unassigned.
 * Groups already created in a previous attempt are marked and won't be resent.
 */
export function CreateInspectionWorkOrdersDialog({
  open,
  onOpenChange,
  groups,
  unassignedCount,
  createdTeamIds,
  isCreating,
  onConfirm,
}: CreateInspectionWorkOrdersDialogProps) {
  const pendingCount = groups.filter(
    (group) => !createdTeamIds.has(group.maintenanceTeamId)
  ).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa ärenden och slutför</DialogTitle>
          <DialogDescription>
            {groups.length === 0
              ? 'Inga komponenter har tilldelats en resursgrupp – inga ärenden skapas.'
              : pendingCount === 0
                ? 'Alla ärenden är redan skapade – besiktningen slutförs.'
                : `${pendingCount} ärende(n) skapas i Odoo, ett per resursgrupp:`}
          </DialogDescription>
        </DialogHeader>

        {groups.length > 0 && (
          <ul className="space-y-2 text-sm">
            {groups.map((group) => (
              <li
                key={group.maintenanceTeamId}
                className="flex justify-between gap-2 rounded-md border p-2"
              >
                <span className="font-medium">{group.maintenanceTeamName}</span>
                <span className="text-muted-foreground">
                  {createdTeamIds.has(group.maintenanceTeamId)
                    ? 'Redan skapad ✓'
                    : `${group.componentLabels.length} komponent${group.componentLabels.length === 1 ? '' : 'er'}`}
                </span>
              </li>
            ))}
          </ul>
        )}

        {unassignedCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {unassignedCount} skadad komponent
            {unassignedCount === 1 ? '' : 'er'} utan resursgrupp – inget ärende
            skapas för {unassignedCount === 1 ? 'den' : 'dem'}.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Avbryt
          </Button>
          <Button onClick={onConfirm} disabled={isCreating}>
            {isCreating ? 'Skapar…' : 'Skapa och slutför'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
