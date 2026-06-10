import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { workOrderService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { useToast } from '@/shared/hooks/useToast'

import {
  buildInspectionWorkOrderGroups,
  getDamagedComponents,
} from '../lib/buildInspectionWorkOrderGroups'
import { useMaintenanceTeams } from './useMaintenanceTeams'

type InspectionRoom = components['schemas']['InspectionRoom']

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
  // Teams whose work order was already created — excluded on retry so a
  // partially failed batch never duplicates the errands that succeeded.
  const [createdTeamIds, setCreatedTeamIds] = useState<Set<number>>(new Set())

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

  const createMutation = useMutation({
    mutationFn: workOrderService.createInspectionWorkOrders,
    onSuccess: ({ results }) => {
      const succeededTeamIds = results
        .filter((result) => result.ok)
        .map((result) => result.maintenanceTeamId)
      if (succeededTeamIds.length > 0) {
        setCreatedTeamIds((prev) => new Set([...prev, ...succeededTeamIds]))
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
   * the caller can keep the confirm dialog open for a retry). Only groups not
   * already created are submitted, so a retry re-creates just the failed ones.
   */
  const createWorkOrders = async (): Promise<boolean> => {
    const pendingGroups = groups.filter(
      (group) => !createdTeamIds.has(group.maintenanceTeamId)
    )
    if (!rentalId || pendingGroups.length === 0) return true

    try {
      const { results } = await createMutation.mutateAsync({
        rentalObjectCode: rentalId,
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
    assignments,
    assignTeam,
    damaged,
    groups,
    unassignedCount,
    createdTeamIds,
    isConfirmOpen,
    openConfirm: () => setIsConfirmOpen(true),
    closeConfirm: () => setIsConfirmOpen(false),
    isCreating: createMutation.isPending,
    createWorkOrders,
  }
}
