import { useState, useEffect, useMemo, useRef } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const contentRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  // Map of objectId -> line count to clamp to (null = fully expanded)
  const [lineClamps, setLineClamps] = useState<Map<string, number | null>>(
    new Map()
  )
  const [minHeight, setMinHeight] = useState<number | null>(null)

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

  // Set minimum height to match tenant card
  useEffect(() => {
    const tenantCard = document.getElementById('tenant-card')
    if (!tenantCard) return

    const updateMinHeight = () => {
      const height = tenantCard.getBoundingClientRect().height
      setMinHeight(height)
    }

    updateMinHeight()

    // Update on window resize
    const resizeObserver = new ResizeObserver(updateMinHeight)
    resizeObserver.observe(tenantCard)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Dynamically calculate line-clamp to fit within tenant card height
  useEffect(() => {
    console.log('Truncation effect running', {
      cardRef: !!cardRef.current,
      loadingSize: loadingObjects.size,
      currentGroup: !!currentGroup,
      minHeight,
    })

    if (!cardRef.current) {
      console.log('No cardRef')
      return
    }
    if (loadingObjects.size > 0) {
      console.log('Still loading objects')
      return
    }
    // Removed isCheckingHeight check - let the timeout handle multiple calls
    if (!currentGroup) {
      console.log('No current group')
      return
    }

    const tenantCard = document.getElementById('tenant-card')
    if (!tenantCard) {
      console.log('No tenant card found')
      return
    }

    console.log('Starting height check...')

    // Wait for DOM to settle (debounce multiple calls)
    const timer = setTimeout(() => {
      if (!cardRef.current || !tenantCard) {
        return
      }

      // Check if tenant card has been properly rendered (has non-zero height)
      const tenantCardInitialHeight = tenantCard.getBoundingClientRect().height
      if (tenantCardInitialHeight === 0) {
        // Tenant card not ready yet, will retry on next render
        console.log('Tenant card height is 0, will retry')
        return
      }

      // IMPORTANT: We need to measure with ALL truncation removed to get true heights
      // First, temporarily remove all line-clamps to measure natural heights
      const noteElements = cardRef.current.querySelectorAll('[data-object-id]')
      const originalStyles = new Map<Element, string>()

      noteElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        originalStyles.set(el, htmlEl.style.cssText)
        htmlEl.style.display = ''
        htmlEl.style.webkitLineClamp = ''
        htmlEl.style.webkitBoxOrient = ''
        htmlEl.style.overflow = ''
      })

      // Force reflow to get accurate measurements
      void cardRef.current.offsetHeight

      const tenantCardHeight = tenantCard.getBoundingClientRect().height
      const notesCardHeight = cardRef.current.getBoundingClientRect().height

      // If we fit without any truncation, no truncation needed
      if (notesCardHeight <= tenantCardHeight + 10) {
        // Restore original styles
        noteElements.forEach((el) => {
          const htmlEl = el as HTMLElement
          htmlEl.style.cssText = originalStyles.get(el) || ''
        })

        // Only clear if there were clamps before
        if (lineClamps.size > 0) {
          setLineClamps(new Map())
        }
        return
      }

      // We're overflowing - need to truncate
      const overflow = notesCardHeight - tenantCardHeight

      // Strategy: Truncate notes from bottom up, calculating exact lines for each
      const newLineClamps = new Map<string, number | null>()
      let remainingOverflow = overflow

      // Get all note elements (already queried above)
      const objectIds = currentGroup.leases.map((l) => l.rentalPropertyId)

      // Go through notes from bottom to top
      for (let i = objectIds.length - 1; i >= 0 && remainingOverflow > 5; i--) {
        const objectId = objectIds[i]
        const note = notes.get(objectId)

        if (!note?.description) continue

        // Find the note element in DOM (from noteElements already queried)
        const noteElement = Array.from(noteElements).find(
          (el) => el.getAttribute('data-object-id') === objectId
        ) as HTMLElement | undefined

        if (!noteElement) {
          console.log('Could not find element for:', objectId)
          continue
        }

        // Get line height from computed styles
        const computedStyle = window.getComputedStyle(noteElement)
        const lineHeight = parseFloat(computedStyle.lineHeight)

        if (!lineHeight || isNaN(lineHeight)) {
          console.log('Invalid line height for:', objectId, lineHeight)
          continue
        }

        // Calculate how many lines we can show for this note
        const currentHeight = noteElement.getBoundingClientRect().height
        const targetHeight = Math.max(
          lineHeight,
          currentHeight - remainingOverflow
        )
        const linesToShow = Math.max(1, Math.floor(targetHeight / lineHeight))

        console.log('Truncating', objectId, {
          currentHeight,
          targetHeight,
          lineHeight,
          linesToShow,
          remainingOverflow,
        })

        newLineClamps.set(objectId, linesToShow)
        remainingOverflow -= currentHeight - targetHeight
      }

      console.log('Final lineClamps:', newLineClamps)

      // Check if lineClamps actually changed
      const clampsChanged =
        newLineClamps.size !== lineClamps.size ||
        Array.from(newLineClamps.entries()).some(
          ([id, lines]) => lineClamps.get(id) !== lines
        )

      // Restore original styles before applying new truncation
      noteElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        htmlEl.style.cssText = originalStyles.get(el) || ''
      })

      if (clampsChanged) {
        console.log('Clamps changed, applying new truncation')
        setLineClamps(newLineClamps)
      } else {
        console.log('Clamps unchanged, done')
      }
    }, 100)

    return () => {
      console.log('Cleanup: clearing timeout')
      clearTimeout(timer)
    }
  }, [currentGroup, notes, loadingObjects.size, minHeight, lineClamps])

  // Reset line clamps when navigating to a new group
  useEffect(() => {
    setLineClamps(new Map())
  }, [currentGroupIndex])

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

  const handleToggleExpand = (objectId: string) => {
    const isTruncated =
      lineClamps.has(objectId) && lineClamps.get(objectId) !== null

    if (isTruncated) {
      // Truncated - expand it fully
      setLineClamps((prev) => {
        const next = new Map(prev)
        next.delete(objectId)
        return next
      })
    } else {
      // Already expanded - enter edit mode
      handleStartEdit(objectId)
    }
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
    <Card
      ref={cardRef}
      className="flex flex-col"
      style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
    >
      <CardHeader className="flex-shrink-0">
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
      <CardContent
        ref={contentRef}
        className="flex-1 overflow-y-auto space-y-3 min-h-0"
      >
        {currentGroup.leases.map((lease) => {
          const objectId = lease.rentalPropertyId
          const note = notes.get(objectId)
          const isLoading = loadingObjects.has(objectId)
          const isEditing = editingObjectId === objectId
          const isSaving = savingObjects.has(objectId)
          const lineClamp = lineClamps.get(objectId)
          const isTruncated = lineClamp !== undefined && lineClamp !== null
          const hasTruncatedNotes = lineClamps.size > 0

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
                <>
                  {/* Note display - click to expand if truncated, or edit if not */}
                  <div
                    className={`cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors ${!isTruncated && !hasTruncatedNotes ? 'group' : ''}`}
                    onClick={() =>
                      isTruncated
                        ? handleToggleExpand(objectId)
                        : handleStartEdit(objectId)
                    }
                  >
                    {note?.description ? (
                      <div
                        data-object-id={objectId}
                        className="text-sm whitespace-pre-wrap"
                        style={
                          isTruncated
                            ? {
                                display: '-webkit-box',
                                WebkitLineClamp: lineClamp,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }
                            : undefined
                        }
                      >
                        {note.description}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {hasTruncatedNotes
                          ? 'Inga anteckningar'
                          : 'Inga anteckningar - klicka för att lägga till'}
                      </p>
                    )}
                    {!isTruncated &&
                      !hasTruncatedNotes &&
                      note?.description && (
                        <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Edit className="h-3 w-3" />
                            Klicka för att redigera
                          </span>
                        </div>
                      )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
