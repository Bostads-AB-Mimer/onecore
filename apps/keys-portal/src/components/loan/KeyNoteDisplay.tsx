import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Edit,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { keyNoteService } from '@/services/api/keyNoteService'
import type { KeyNote, Lease } from '@/services/types'
import { leaseTypes } from '@/services/types'
import { deriveDisplayStatus } from '@/lib/lease-status'

interface KeyNoteDisplayProps {
  /** Array of leases to show notes for. If multiple, shows carousel navigation. */
  leases: Lease[]
  /** The type of search that was performed */
  searchType: 'pnr' | 'object' | 'contactCode' | null
}

/**
 * Get property type priority for sorting.
 * Lower numbers = higher priority (shown first in list)
 * Priority order: apartments/cooperative > garage > parking > others
 */
function getPropertyTypePriority(leaseType?: string): number {
  const type = leaseType?.trim() ?? ''
  // Apartments and cooperative tenancy (highest priority)
  if (type === leaseTypes.housingContract) return 1
  if (type === leaseTypes.cooperativeTenancyContract) return 2
  if (type === leaseTypes.campusContract) return 3
  // Garages (medium priority)
  if (type === leaseTypes.garageContract) return 4
  // Parking spaces (lower priority)
  if (type === leaseTypes.parkingspaceContract) return 5
  // Everything else (lowest priority: commercial, renegotiation, other)
  return 6
}

type StatusGroup = 'active' | 'upcoming' | 'ended'

interface GroupedLeases {
  status: StatusGroup
  label: string
  leases: Lease[]
}

/**
 * Displays key notes for rental objects grouped by lease status.
 * - Groups objects by status (active, upcoming, ended)
 * - Shows all notes for a status group on one page
 * - Use arrows to navigate between status groups
 */
export function KeyNoteDisplay({ leases }: KeyNoteDisplayProps) {
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const [notes, setNotes] = useState<Map<string, KeyNote | null>>(new Map())
  const [loadingObjects, setLoadingObjects] = useState<Set<string>>(new Set())
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null)
  const [editedDescription, setEditedDescription] = useState('')
  const [savingObjects, setSavingObjects] = useState<Set<string>>(new Set())

  // Group leases by status and filter to unique objects
  const statusGroups = useMemo<GroupedLeases[]>(() => {
    // First, get unique objects across all leases
    const uniqueObjectsMap = new Map<string, Lease>()
    leases.forEach((lease) => {
      const objectId = lease.rentalPropertyId
      if (!uniqueObjectsMap.has(objectId)) {
        uniqueObjectsMap.set(objectId, lease)
      } else {
        const existing = uniqueObjectsMap.get(objectId)!
        // Keep the most recent lease for each unique object
        if (
          new Date(lease.leaseStartDate) > new Date(existing.leaseStartDate)
        ) {
          uniqueObjectsMap.set(objectId, lease)
        }
      }
    })

    const uniqueLeases = Array.from(uniqueObjectsMap.values())

    // Group by status
    const activeLeases: Lease[] = []
    const upcomingLeases: Lease[] = []
    const endedLeases: Lease[] = []

    uniqueLeases.forEach((lease) => {
      const status = deriveDisplayStatus(lease)
      if (status === 'active') activeLeases.push(lease)
      else if (status === 'upcoming') upcomingLeases.push(lease)
      else endedLeases.push(lease)
    })

    // Sort each group by property type priority
    const sortByPriority = (a: Lease, b: Lease) => {
      const priorityA = getPropertyTypePriority(a.type)
      const priorityB = getPropertyTypePriority(b.type)
      return priorityA - priorityB
    }

    activeLeases.sort(sortByPriority)
    upcomingLeases.sort(sortByPriority)
    endedLeases.sort(sortByPriority)

    // Build groups array (only include non-empty groups)
    const groups: GroupedLeases[] = []
    if (activeLeases.length > 0) {
      groups.push({ status: 'active', label: 'Aktiva', leases: activeLeases })
    }
    if (upcomingLeases.length > 0) {
      groups.push({
        status: 'upcoming',
        label: 'Kommande',
        leases: upcomingLeases,
      })
    }
    if (endedLeases.length > 0) {
      groups.push({ status: 'ended', label: 'Avslutade', leases: endedLeases })
    }

    return groups
  }, [leases])

  const currentGroup = statusGroups[currentGroupIndex]
  const hasMultipleGroups = statusGroups.length > 1

  // Load notes for all objects in the current group
  useEffect(() => {
    if (!currentGroup) return

    currentGroup.leases.forEach((lease) => {
      const rentalObjectCode = lease.rentalPropertyId

      // Check if we already have this note cached
      if (notes.has(rentalObjectCode)) return

      let cancelled = false

      async function loadNote() {
        setLoadingObjects((prev) => new Set(prev).add(rentalObjectCode))
        try {
          const fetchedNotes =
            await keyNoteService.getKeyNotesByRentalObjectCode(rentalObjectCode)
          if (!cancelled) {
            // Assume one note per rental object
            const note = fetchedNotes[0] ?? null
            setNotes((prev) => new Map(prev).set(rentalObjectCode, note))
          }
        } catch (err) {
          console.error('Failed to load note:', err)
          if (!cancelled) {
            setNotes((prev) => new Map(prev).set(rentalObjectCode, null))
          }
        } finally {
          if (!cancelled) {
            setLoadingObjects((prev) => {
              const next = new Set(prev)
              next.delete(rentalObjectCode)
              return next
            })
          }
        }
      }

      loadNote()
    })
  }, [currentGroup, notes])

  const handlePrevious = () => {
    setCurrentGroupIndex(
      (prev) => (prev - 1 + statusGroups.length) % statusGroups.length
    )
    setEditingObjectId(null) // Exit edit mode when navigating
  }

  const handleNext = () => {
    setCurrentGroupIndex((prev) => (prev + 1) % statusGroups.length)
    setEditingObjectId(null) // Exit edit mode when navigating
  }

  const handleStartEdit = (objectId: string) => {
    const note = notes.get(objectId)
    setEditedDescription(note?.description ?? '')
    setEditingObjectId(objectId)
  }

  const handleCancelEdit = () => {
    setEditingObjectId(null)
    setEditedDescription('')
  }

  const handleSave = async (objectId: string) => {
    setSavingObjects((prev) => new Set(prev).add(objectId))
    try {
      const currentNote = notes.get(objectId)

      if (currentNote) {
        // Update existing note
        const updated = await keyNoteService.updateKeyNote(currentNote.id, {
          description: editedDescription,
        })
        setNotes((prev) => new Map(prev).set(objectId, updated))
      } else {
        // Create new note
        const created = await keyNoteService.createKeyNote({
          rentalObjectCode: objectId,
          description: editedDescription,
        })
        setNotes((prev) => new Map(prev).set(objectId, created))
      }
      setEditingObjectId(null)
    } catch (err) {
      console.error('Failed to save note:', err)
      alert('Misslyckades med att spara anteckningen')
    } finally {
      setSavingObjects((prev) => {
        const next = new Set(prev)
        next.delete(objectId)
        return next
      })
    }
  }

  if (!currentGroup) {
    return null
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Anteckningar på objekt
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasMultipleGroups && (
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handlePrevious}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentGroup.label}
            </span>
            {hasMultipleGroups && (
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handleNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-3">
        {currentGroup.leases.map((lease) => {
          const objectId = lease.rentalPropertyId
          const note = notes.get(objectId)
          const isLoading = loadingObjects.has(objectId)
          const isEditing = editingObjectId === objectId
          const isSaving = savingObjects.has(objectId)

          return (
            <div key={objectId} className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Objekt-ID: {objectId}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : isEditing ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="Skriv dina anteckningar här..."
                    rows={6}
                    className="resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Avbryt
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSave(objectId)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sparar...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Spara
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="group cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
                  onClick={() => handleStartEdit(objectId)}
                >
                  {note?.description ? (
                    <div className="text-sm whitespace-pre-wrap">
                      {note.description}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Inga anteckningar - klicka för att lägga till
                    </p>
                  )}
                  <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Edit className="h-3 w-3" />
                      Klicka för att redigera
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
