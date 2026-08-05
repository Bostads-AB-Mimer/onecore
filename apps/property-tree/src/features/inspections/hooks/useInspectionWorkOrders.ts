import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { workOrderService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { useToast } from '@/shared/hooks/useToast'

import {
  buildInspectionWorkOrderGroups,
  getDamagedComponents,
  type InspectionWorkOrderGroup,
} from '../lib/buildInspectionWorkOrderGroups'
import { useMaintenanceTeams } from './useMaintenanceTeams'

type InspectionRoom = components['schemas']['InspectionRoom']

/**
 * Submission state of a group relative to what has already been created in
 * Odoo this session: 'pending' = never created, 'created' = created with this
 * exact content, 'changed' = created but the group's components changed since
 * — it will be re-submitted and the backend updates the existing request.
 */
export type InspectionWorkOrderGroupStatus = 'pending' | 'created' | 'changed'

interface UseInspectionWorkOrdersParams {
  inspectionData: Record<string, InspectionRoom>
  rooms: Room[]
  meta: { id: string; address?: string }
  rentalId?: string
}

/**
 * Drives the "create work orders per resursgrupp" flow on the inspection summary
 * step: holds the per-component team assignments, derives the grouped work
 * orders, and submits them to Odoo (one per group) before the inspection is
 * completed. Shared by the desktop and mobile inspection forms.
 */
export const useInspectionWorkOrders = ({
  inspectionData,
  rooms,
  meta,
  rentalId,
}: UseInspectionWorkOrdersParams) => {
  const { toast } = useToast()
  const teamsQuery = useMaintenanceTeams()
  const teams = teamsQuery.data ?? []

  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  // Snapshot per team of what was successfully created/updated in Odoo this
  // session. A team only counts as "already created" while its group content
  // still matches `descriptionHtml` — assigning another component to the team
  // afterwards re-submits the group (the backend upserts the existing
  // request), so a retry never silently drops late additions. `workOrderId`
  // lets us close the request again if the team later loses all its
  // components (see createWorkOrders).
  const [submittedByTeam, setSubmittedByTeam] = useState<
    Map<number, { descriptionHtml: string; workOrderId?: number }>
  >(new Map())

  const assignTeam = (key: string, teamId: number | null) =>
    setAssignments((prev) => {
      if (teamId === null) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: teamId }
    })

  const damaged = useMemo(
    () => getDamagedComponents(inspectionData, rooms),
    [inspectionData, rooms]
  )

  const groups = useMemo(
    () => buildInspectionWorkOrderGroups(damaged, assignments, teams, meta),
    [damaged, assignments, teams, meta]
  )

  const assignedCount = damaged.filter((c) => assignments[c.key]).length
  const unassignedCount = damaged.length - assignedCount

  const groupStatus = (
    group: InspectionWorkOrderGroup
  ): InspectionWorkOrderGroupStatus => {
    const submitted = submittedByTeam.get(group.maintenanceTeamId)
    if (submitted === undefined) return 'pending'
    return submitted.descriptionHtml === group.descriptionHtml
      ? 'created'
      : 'changed'
  }

  const createMutation = useMutation({
    mutationFn: workOrderService.createInspectionWorkOrders,
    onSuccess: ({ results }, variables) => {
      const sentHtmlByTeam = new Map(
        variables.groups.map((group) => [
          group.maintenanceTeamId,
          group.descriptionHtml,
        ])
      )
      const succeeded = results.filter((result) => result.ok)
      if (succeeded.length > 0) {
        setSubmittedByTeam((prev) => {
          const next = new Map(prev)
          for (const result of succeeded) {
            const html = sentHtmlByTeam.get(result.maintenanceTeamId)
            if (html !== undefined) {
              next.set(result.maintenanceTeamId, {
                descriptionHtml: html,
                workOrderId: result.workOrderId,
              })
            }
          }
          return next
        })
      }

      const failed = results.length - succeeded.length
      if (failed === 0) {
        toast({
          title: 'Ärenden skapade',
          description: `${succeeded.length} ärende(n) skapades i Odoo.`,
        })
      } else {
        toast({
          title: 'Vissa ärenden kunde inte skapas',
          description: `${succeeded.length} skapades, ${failed} misslyckades. Försök igen.`,
          variant: 'destructive',
        })
      }
    },
    onError: () => {
      toast({
        title: 'Fel',
        description: 'Kunde inte skapa ärenden i Odoo.',
        variant: 'destructive',
      })
    },
  })

  /**
   * Closes work orders created earlier this session for teams that no longer
   * have any assigned components — the inspector reassigned them, so leaving
   * the request open would dispatch two resursgrupper to the same damage.
   * Returns false if any close failed (the team stays in the map for retry).
   */
  const closeStaleWorkOrders = async (staleTeamIds: number[]) => {
    const results = await Promise.all(
      staleTeamIds.map(async (teamId) => {
        const workOrderId = submittedByTeam.get(teamId)?.workOrderId
        // Without an id there is nothing we can close — drop the team rather
        // than blocking the inspector behind a retry that can never succeed.
        if (workOrderId === undefined) return { teamId, ok: true }
        try {
          await workOrderService.closeWorkOrder(workOrderId)
          return { teamId, ok: true }
        } catch {
          return { teamId, ok: false }
        }
      })
    )

    const closedTeamIds = results.filter((r) => r.ok).map((r) => r.teamId)
    if (closedTeamIds.length > 0) {
      setSubmittedByTeam((prev) => {
        const next = new Map(prev)
        for (const teamId of closedTeamIds) next.delete(teamId)
        return next
      })
    }

    const ok = results.every((r) => r.ok)
    if (!ok) {
      toast({
        title: 'Fel',
        description:
          'Ett tidigare skapat ärende kunde inte stängas i Odoo. Försök igen.',
        variant: 'destructive',
      })
    }
    return ok
  }

  /**
   * Creates the assigned work orders in Odoo. Returns true when there was
   * nothing to do or everything succeeded; false if any step failed (so the
   * caller can keep the confirm dialog open for a retry). Groups already
   * created with unchanged content are skipped; changed groups are re-sent
   * and upserted server-side (keyed on inspection + team); teams whose
   * components were all reassigned since a previous submit get their Odoo
   * request closed.
   */
  const createWorkOrders = async (): Promise<boolean> => {
    const pendingGroups = groups.filter(
      (group) => groupStatus(group) !== 'created'
    )
    const staleTeamIds = [...submittedByTeam.keys()].filter(
      (teamId) => !groups.some((g) => g.maintenanceTeamId === teamId)
    )
    if (pendingGroups.length === 0 && staleTeamIds.length === 0) return true

    const staleOk =
      staleTeamIds.length === 0 || (await closeStaleWorkOrders(staleTeamIds))

    if (pendingGroups.length === 0) return staleOk

    if (!rentalId) {
      // Distinct from "nothing to do" above: there ARE groups to create, but
      // no rental object to key them to — succeeding silently here would
      // complete the inspection without any work orders.
      toast({
        title: 'Fel',
        description:
          'Ärenden kan inte skapas: hyresobjektet kunde inte identifieras.',
        variant: 'destructive',
      })
      return false
    }

    try {
      const { results } = await createMutation.mutateAsync({
        rentalObjectCode: rentalId,
        inspectionId: meta.id,
        groups: pendingGroups.map((group) => ({
          maintenanceTeamId: group.maintenanceTeamId,
          maintenanceTeamName: group.maintenanceTeamName,
          descriptionHtml: group.descriptionHtml,
        })),
      })
      return staleOk && results.every((result) => result.ok)
    } catch {
      // Toast already shown by onError; the caller only needs the outcome.
      return false
    }
  }

  return {
    teams,
    // Nothing used to read the query state, so an Odoo outage rendered every
    // resursgrupp picker silently empty — keep these surfaced in the UI.
    teamsLoading: teamsQuery.isLoading,
    teamsError: teamsQuery.isError,
    assignments,
    assignTeam,
    damaged,
    groups,
    unassignedCount,
    groupStatus,
    isConfirmOpen,
    openConfirm: () => setIsConfirmOpen(true),
    closeConfirm: () => setIsConfirmOpen(false),
    isCreating: createMutation.isPending,
    createWorkOrders,
  }
}
