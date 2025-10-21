import { useState, useEffect } from 'react'
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

interface KeyNoteDisplayProps {
  /** Array of leases to show notes for. If multiple, shows carousel navigation. */
  leases: Lease[]
  /** The type of search that was performed */
  searchType: 'pnr' | 'object' | 'contactCode' | null
}

/**
 * Displays key notes for rental objects.
 * - For object searches (single object): Shows note for that object
 * - For person searches (multiple objects): Shows carousel to navigate between objects
 */
export function KeyNoteDisplay({ leases, searchType }: KeyNoteDisplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [notes, setNotes] = useState<Map<string, KeyNote | null>>(new Map())
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedDescription, setEditedDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Get active leases (where we expect notes to be most relevant)
  const activeLeases = leases.filter((lease) => {
    const now = new Date()
    const start = new Date(lease.leaseStartDate)
    const end = lease.leaseEndDate ? new Date(lease.leaseEndDate) : null
    return start <= now && (!end || end >= now)
  })

  // Use active leases if available, otherwise all leases
  const allRelevantLeases = activeLeases.length > 0 ? activeLeases : leases

  // Filter to unique rental objects (avoid showing multiple leases for same object)
  const uniqueObjectsMap = new Map<string, Lease>()
  allRelevantLeases.forEach((lease) => {
    const objectId = lease.rentalPropertyId
    // Keep the most recent lease for each unique object
    if (!uniqueObjectsMap.has(objectId)) {
      uniqueObjectsMap.set(objectId, lease)
    } else {
      const existing = uniqueObjectsMap.get(objectId)!
      // Replace if this lease is more recent
      if (new Date(lease.leaseStartDate) > new Date(existing.leaseStartDate)) {
        uniqueObjectsMap.set(objectId, lease)
      }
    }
  })

  const displayLeases = Array.from(uniqueObjectsMap.values())

  const currentLease = displayLeases[currentIndex]
  const hasMultiple = displayLeases.length > 1

  // Load note for current lease
  useEffect(() => {
    if (!currentLease) return

    const rentalObjectCode = currentLease.rentalPropertyId

    // Check if we already have this note cached
    if (notes.has(rentalObjectCode)) return

    let cancelled = false

    async function loadNote() {
      setLoading(true)
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
        if (!cancelled) setLoading(false)
      }
    }

    loadNote()

    return () => {
      cancelled = true
    }
  }, [currentLease, notes])

  const handlePrevious = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + displayLeases.length) % displayLeases.length
    )
    setIsEditing(false) // Exit edit mode when navigating
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % displayLeases.length)
    setIsEditing(false) // Exit edit mode when navigating
  }

  const handleStartEdit = () => {
    setEditedDescription(currentNote?.description ?? '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedDescription('')
  }

  const handleSave = async () => {
    if (!currentLease) return

    setSaving(true)
    try {
      const rentalObjectCode = currentLease.rentalPropertyId

      if (currentNote) {
        // Update existing note
        const updated = await keyNoteService.updateKeyNote(currentNote.id, {
          description: editedDescription,
        })
        setNotes((prev) => new Map(prev).set(rentalObjectCode, updated))
      } else {
        // Create new note
        const created = await keyNoteService.createKeyNote({
          rentalObjectCode,
          description: editedDescription,
        })
        setNotes((prev) => new Map(prev).set(rentalObjectCode, created))
      }
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save note:', err)
      alert('Misslyckades med att spara anteckningen')
    } finally {
      setSaving(false)
    }
  }

  if (!currentLease) {
    return null
  }

  const currentNote = notes.get(currentLease.rentalPropertyId)

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Anteckningar på objekt
          </CardTitle>
          {hasMultiple && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handlePrevious}
                disabled={loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {currentIndex + 1} / {displayLeases.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handleNext}
                disabled={loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <CardDescription className="text-xs">
          Objekt-ID: {currentLease.rentalPropertyId}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isEditing ? (
          <div className="space-y-4 flex-1 flex flex-col">
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Skriv dina anteckningar här..."
              rows={8}
              className="resize-none flex-1"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-1" />
                Avbryt
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
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
            className="group cursor-pointer hover:bg-muted/50 -m-4 p-4 rounded-md transition-colors"
            onClick={handleStartEdit}
          >
            {currentNote?.description ? (
              <div className="text-sm whitespace-pre-wrap">
                {currentNote.description}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Inga anteckningar för detta objekt - klicka för att lägga till
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
      </CardContent>
    </Card>
  )
}
