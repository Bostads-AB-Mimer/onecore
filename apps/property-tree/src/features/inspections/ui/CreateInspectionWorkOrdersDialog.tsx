import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'

import type {
  useInspectionWorkOrders,
  InspectionWorkOrderGroupStatus,
} from '../hooks/useInspectionWorkOrders'
import type { InspectionWorkOrderGroup } from '../lib/buildInspectionWorkOrderGroups'

interface InspectionWorkOrdersConfirmFlowProps {
  workOrders: ReturnType<typeof useInspectionWorkOrders>
  onCompleted: () => void
}

/**
 * Wires the confirm dialog to the useInspectionWorkOrders hook: creates the
 * work orders on confirm and, once everything succeeded (or there was nothing
 * to create), closes the dialog and completes the inspection. Shared by the
 * desktop and mobile inspection forms.
 */
export function InspectionWorkOrdersConfirmFlow({
  workOrders,
  onCompleted,
}: InspectionWorkOrdersConfirmFlowProps) {
  return (
    <CreateInspectionWorkOrdersDialog
      open={workOrders.isConfirmOpen}
      onOpenChange={(open) => {
        if (!open) workOrders.closeConfirm()
      }}
      groups={workOrders.groups}
      unassignedCount={workOrders.unassignedCount}
      groupStatus={workOrders.groupStatus}
      teamsUnavailable={workOrders.teamsError && workOrders.damaged.length > 0}
      isCreating={workOrders.isCreating}
      onConfirm={async () => {
        const ok = await workOrders.createWorkOrders()
        if (ok) {
          workOrders.closeConfirm()
          onCompleted()
        }
      }}
    />
  )
}

interface CreateInspectionWorkOrdersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: InspectionWorkOrderGroup[]
  unassignedCount: number
  groupStatus: (
    group: InspectionWorkOrderGroup
  ) => InspectionWorkOrderGroupStatus
  // True when the resursgrupp list failed to load while there are damaged
  // components — completing would silently skip creating any work orders.
  teamsUnavailable: boolean
  isCreating: boolean
  onConfirm: () => void
}

const GROUP_STATUS_LABEL = (
  group: InspectionWorkOrderGroup,
  status: InspectionWorkOrderGroupStatus
): string => {
  if (status === 'created') return 'Redan skapad ✓'
  const count = group.componentLabels.length
  const components = `${count} komponent${count === 1 ? '' : 'er'}`
  // 'changed': the group was created earlier but components were added or
  // edited since — the existing Odoo request is updated, not duplicated.
  return status === 'changed' ? `Uppdateras – ${components}` : components
}

/**
 * Previews the work orders that will be created (one per resursgrupp) before the
 * inspection is completed, and surfaces any Skadad components left unassigned.
 * Groups already created in a previous attempt are marked and won't be resent
 * unless their content changed — in that case the existing request is updated.
 */
export function CreateInspectionWorkOrdersDialog({
  open,
  onOpenChange,
  groups,
  unassignedCount,
  groupStatus,
  teamsUnavailable,
  isCreating,
  onConfirm,
}: CreateInspectionWorkOrdersDialogProps) {
  const pendingCount = groups.filter(
    (group) => groupStatus(group) !== 'created'
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
                  {GROUP_STATUS_LABEL(group, groupStatus(group))}
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

        {teamsUnavailable && (
          <p className="text-sm text-destructive">
            Resursgrupperna kunde inte hämtas – skadade komponenter kan inte
            tilldelas och inga ärenden skapas. Spara besiktningen som utkast och
            försök igen senare.
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
          <Button onClick={onConfirm} disabled={isCreating || teamsUnavailable}>
            {isCreating ? 'Skapar…' : 'Skapa och slutför'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
