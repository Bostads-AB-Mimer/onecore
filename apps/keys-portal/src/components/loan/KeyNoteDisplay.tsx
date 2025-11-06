import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Edit,
  Check,
  X,
  PenLine,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { keyNoteService } from '@/services/api/keyNoteService'
import type { KeyNote, Lease } from '@/services/types'
import { leaseTypes } from '@/services/types'
import { deriveDisplayStatus } from '@/lib/lease-status'
import { useUser } from '@/auth/useUser'

interface KeyNoteDisplayProps {
  leases: Lease[]
  searchType: 'pnr' | 'object' | 'contactCode' | null
}

type StatusGroup = 'active' | 'upcoming' | 'ended'

interface GroupedLeases {
  status: StatusGroup
  label: string
  leases: Lease[]
}

// Helper: Get property type priority for sorting
function getPropertyTypePriority(leaseType?: string): number {
  const type = leaseType?.trim() ?? ''
  if (type === leaseTypes.housingContract) return 1
  if (type === leaseTypes.cooperativeTenancyContract) return 2
  if (type === leaseTypes.campusContract) return 3
  if (type === leaseTypes.garageContract) return 4
  if (type === leaseTypes.parkingspaceContract) return 5
  return 6
}

// Helper: Restore element styles from original state
function restoreStyles(
  elements: NodeListOf<Element>,
  originalStyles: Map<Element, string>
) {
  elements.forEach((el) => {
    ;(el as HTMLElement).style.cssText = originalStyles.get(el) || ''
  })
}

/**
 * Displays key notes for rental objects grouped by lease status.
 * Groups objects by status (active, upcoming, ended) and shows all notes for a status group on one page.
 */
export function KeyNoteDisplay({ leases }: KeyNoteDisplayProps) {
  const userState = useUser()
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const [notes, setNotes] = useState<Map<string, KeyNote | null>>(new Map())
  const [loadingObjects, setLoadingObjects] = useState<Set<string>>(new Set())
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null)
  const [editedDescription, setEditedDescription] = useState('')
  const [savingObjects, setSavingObjects] = useState<Set<string>>(new Set())
  const contentRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [lineClamps, setLineClamps] = useState<Map<string, number | null>>(
    new Map()
  )
  const [minHeight, setMinHeight] = useState<number | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  // Group leases by status and filter to unique objects
  const statusGroups = useMemo<GroupedLeases[]>(() => {
    // Get unique objects (keep most recent lease per object)
    const uniqueObjectsMap = new Map<string, Lease>()
    leases.forEach((lease) => {
      const objectId = lease.rentalPropertyId
      const existing = uniqueObjectsMap.get(objectId)
      if (
        !existing ||
        new Date(lease.leaseStartDate) > new Date(existing.leaseStartDate)
      ) {
        uniqueObjectsMap.set(objectId, lease)
      }
    })

    // Group by status and sort by priority
    const sortByPriority = (a: Lease, b: Lease) =>
      getPropertyTypePriority(a.type) - getPropertyTypePriority(b.type)

    const grouped = Array.from(uniqueObjectsMap.values()).reduce(
      (acc, lease) => {
        const status = deriveDisplayStatus(lease)
        if (status === 'active') acc.active.push(lease)
        else if (status === 'upcoming') acc.upcoming.push(lease)
        else acc.ended.push(lease)
        return acc
      },
      { active: [] as Lease[], upcoming: [] as Lease[], ended: [] as Lease[] }
    )

    ;[grouped.active, grouped.upcoming, grouped.ended].forEach((arr) =>
      arr.sort(sortByPriority)
    )

    // Build groups array (only include non-empty groups)
    return [
      { status: 'active' as const, label: 'Aktiva', leases: grouped.active },
      {
        status: 'upcoming' as const,
        label: 'Kommande',
        leases: grouped.upcoming,
      },
      { status: 'ended' as const, label: 'Avslutade', leases: grouped.ended },
    ].filter((group) => group.leases.length > 0)
  }, [leases])

  const currentGroup = statusGroups[currentGroupIndex]
  const hasMultipleGroups = statusGroups.length > 1

  // Set minimum height to match tenant card
  useEffect(() => {
    const tenantCard = document.getElementById('tenant-card')
    if (!tenantCard) return

    const updateMinHeight = () =>
      setMinHeight(tenantCard.getBoundingClientRect().height)
    updateMinHeight()

    const resizeObserver = new ResizeObserver(updateMinHeight)
    resizeObserver.observe(tenantCard)
    return () => resizeObserver.disconnect()
  }, [])

  // Dynamically calculate line-clamp to fit within tenant card height
  useEffect(() => {
    if (!cardRef.current || loadingObjects.size > 0 || !currentGroup) return

    const tenantCard = document.getElementById('tenant-card')
    if (!tenantCard) return

    const timer = setTimeout(() => {
      if (!cardRef.current || !tenantCard) return

      const tenantCardHeight = tenantCard.getBoundingClientRect().height
      if (tenantCardHeight === 0) return

      // Temporarily remove all line-clamps to measure natural heights
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

      void cardRef.current.offsetHeight // Force reflow

      const notesCardHeight = cardRef.current.getBoundingClientRect().height

      // If we fit without truncation, clear any existing clamps
      if (notesCardHeight <= tenantCardHeight + 10) {
        restoreStyles(noteElements, originalStyles)
        if (lineClamps.size > 0) setLineClamps(new Map())
        return
      }

      // Calculate truncation: bottom-up, exact line counts
      const newLineClamps = new Map<string, number | null>()
      let remainingOverflow = notesCardHeight - tenantCardHeight
      const objectIds = currentGroup.leases.map((l) => l.rentalPropertyId)

      for (let i = objectIds.length - 1; i >= 0 && remainingOverflow > 5; i--) {
        const objectId = objectIds[i]
        const note = notes.get(objectId)
        if (!note?.description) continue

        // Skip notes that user has manually expanded
        if (expandedNotes.has(objectId)) continue

        const noteElement = Array.from(noteElements).find(
          (el) => el.getAttribute('data-object-id') === objectId
        ) as HTMLElement | undefined

        if (!noteElement) continue

        const lineHeight = parseFloat(
          window.getComputedStyle(noteElement).lineHeight
        )
        if (!lineHeight || isNaN(lineHeight)) continue

        const currentHeight = noteElement.getBoundingClientRect().height
        const targetHeight = Math.max(
          lineHeight,
          currentHeight - remainingOverflow
        )
        const linesToShow = Math.max(1, Math.floor(targetHeight / lineHeight))

        newLineClamps.set(objectId, linesToShow)
        remainingOverflow -= currentHeight - targetHeight
      }

      // Check if lineClamps actually changed
      const clampsChanged =
        newLineClamps.size !== lineClamps.size ||
        Array.from(newLineClamps.entries()).some(
          ([id, lines]) => lineClamps.get(id) !== lines
        )

      restoreStyles(noteElements, originalStyles)

      if (clampsChanged) {
        setLineClamps(newLineClamps)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [currentGroup, notes, loadingObjects.size, minHeight, lineClamps])

  // Reset line clamps and expanded notes when navigating to a new group
  useEffect(() => {
    setLineClamps(new Map())
    setExpandedNotes(new Set())
  }, [currentGroupIndex])

  // Load notes for all objects in the current group
  useEffect(() => {
    if (!currentGroup) return

    currentGroup.leases.forEach((lease) => {
      const rentalObjectCode = lease.rentalPropertyId
      if (notes.has(rentalObjectCode)) return

      let cancelled = false

      const loadNote = async () => {
        setLoadingObjects((prev) => new Set(prev).add(rentalObjectCode))
        try {
          const fetchedNotes =
            await keyNoteService.getKeyNotesByRentalObjectCode(rentalObjectCode)
          if (!cancelled) {
            setNotes((prev) =>
              new Map(prev).set(rentalObjectCode, fetchedNotes[0] ?? null)
            )
          }
        } catch (err) {
          console.error('Failed to load note:', err)
          if (!cancelled)
            setNotes((prev) => new Map(prev).set(rentalObjectCode, null))
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

  // Create signature string
  const createSignature = () => {
    const userName =
      userState.tag === 'success' ? userState.user.name : 'Unknown'
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm')
    return `${timestamp} ${userName}\n`
  }

  const handleAddSignature = () => {
    const signature = createSignature()
    const textarea = textareaRef.current

    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = editedDescription
      const prefix = start > 0 ? '\n\n' : ''
      const newText =
        text.substring(0, start) +
        prefix +
        signature +
        '\n' +
        text.substring(end)
      setEditedDescription(newText)

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd =
          start + prefix.length + signature.length
        textarea.focus()
      }, 0)
    } else {
      // Fallback: prepend to beginning
      setEditedDescription(signature + '\n' + editedDescription)
    }
  }

  const handleToggleExpand = (objectId: string) => {
    const isTruncated =
      lineClamps.has(objectId) && lineClamps.get(objectId) !== null

    if (isTruncated) {
      // User is expanding - mark as manually expanded to prevent re-truncation
      setExpandedNotes((prev) => new Set(prev).add(objectId))
      setLineClamps((prev) => {
        const next = new Map(prev)
        next.delete(objectId)
        return next
      })
    } else {
      const note = notes.get(objectId)
      setEditedDescription(note?.description ?? '')
      setEditingObjectId(objectId)
    }
  }

  const handleSave = async (objectId: string) => {
    setSavingObjects((prev) => new Set(prev).add(objectId))
    try {
      const currentNote = notes.get(objectId)

      if (currentNote) {
        const updated = await keyNoteService.updateKeyNote(currentNote.id, {
          description: editedDescription,
        })
        setNotes((prev) => new Map(prev).set(objectId, updated))
      } else {
        const created = await keyNoteService.createKeyNote({
          rentalObjectCode: objectId,
          description: editedDescription,
        })
        setNotes((prev) => new Map(prev).set(objectId, created))
      }
      setEditingObjectId(null)
    } catch (err) {
      console.error('Failed to save note:', err)
      alert('Misslyckades med att spara din notering')
    } finally {
      setSavingObjects((prev) => {
        const next = new Set(prev)
        next.delete(objectId)
        return next
      })
    }
  }

  if (!currentGroup) return null

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
            Noteringar nycklar
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasMultipleGroups && (
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setCurrentGroupIndex(
                    (prev) =>
                      (prev - 1 + statusGroups.length) % statusGroups.length
                  )
                  setEditingObjectId(null)
                }}
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
                onClick={() => {
                  setCurrentGroupIndex(
                    (prev) => (prev + 1) % statusGroups.length
                  )
                  setEditingObjectId(null)
                }}
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
                Hyresobjekt: {objectId}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : isEditing ? (
                <div className="space-y-3">
                  <Textarea
                    ref={textareaRef}
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="Skriv dina noteringar här..."
                    rows={6}
                    className="resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddSignature}
                      disabled={isSaving}
                    >
                      <PenLine className="h-4 w-4 mr-1" />
                      Lägg till signatur
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingObjectId(null)
                          setEditedDescription('')
                        }}
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
                </div>
              ) : (
                <div
                  className={`cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors ${!isTruncated && !hasTruncatedNotes ? 'group' : ''}`}
                  onClick={() => handleToggleExpand(objectId)}
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
                        ? 'Inga noteringar'
                        : 'Inga noteringar - klicka för att lägga till'}
                    </p>
                  )}
                  {!isTruncated && !hasTruncatedNotes && note?.description && (
                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Edit className="h-3 w-3" />
                        Klicka för att redigera
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
