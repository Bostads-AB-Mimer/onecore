import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
    setCurrentIndex((prev) => (prev - 1 + displayLeases.length) % displayLeases.length)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % displayLeases.length)
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
            Anteckningar
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
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : currentNote?.description ? (
          <div className="text-sm whitespace-pre-wrap">
            {currentNote.description}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Inga anteckningar för detta objekt
          </p>
        )}
      </CardContent>
    </Card>
  )
}
