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
  // descriptionHtml per team at the time its work order was successfully
  // created/updated in Odoo. A team only counts as "already created" while its
  // group content still matches this snapshot — assigning another component to
  // the team afterwards re-submits the group (the backend upserts the existing
  // request), so a retry never silently drops late additions.
  const [submittedHtmlByTeam, setSubmittedHtmlByTeam] = useState<
    Map<number, string>
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
    const submitted = submittedHtmlByTeam.get(group.maintenanceTeamId)
    if (submitted === undefined) return 'pending'
    return submitted === group.descriptionHtml ? 'created' : 'changed'
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
      const succeededTeamIds = results
        .filter((result) => result.ok)
        .map((result) => result.maintenanceTeamId)
      if (succeededTeamIds.length > 0) {
        setSubmittedHtmlByTeam((prev) => {
          const next = new Map(prev)
          for (const teamId of succeededTeamIds) {
            const html = sentHtmlByTeam.get(teamId)
            if (html !== undefined) next.set(teamId, html)
          }
          return next
        })
      }

      const failed = results.length - succeededTeamIds.length
      if (failed === 0) {
        toast({
          title: 'Ärenden skapade',
          description: `${succeededTeamIds.length} ärende(n) skapades i Odoo.`,
        })
      } else {
        toast({
          title: 'Vissa ärenden kunde inte skapas',
          description: `${succeededTeamIds.length} skapades, ${failed} misslyckades. Försök igen.`,
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
   * Creates the assigned work orders in Odoo. Returns true when there was
   * nothing to create or everything succeeded; false if any group failed (so
   * the caller can keep the confirm dialog open for a retry). Groups already
   * created with unchanged content are skipped; changed groups are re-sent
   * and upserted server-side (keyed on inspection + team).
   */
  const createWorkOrders = async (): Promise<boolean> => {
    const pendingGroups = groups.filter(
      (group) => groupStatus(group) !== 'created'
    )
    if (!rentalId || pendingGroups.length === 0) return true

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
      return results.every((result) => result.ok)
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
