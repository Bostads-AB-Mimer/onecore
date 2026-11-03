import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Newspaper, Settings } from 'lucide-react'

import { useReleaseNotes } from '@/entities/release-note'

import { routes } from '@/shared/routes'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import { Skeleton } from '@/shared/ui/Skeleton'

import { ReleaseNoteItem } from './ReleaseNoteItem'
import { SupportMessage } from './SupportMessage'

/** Delay in ms to wait for modal render before scrolling */
const SCROLL_DELAY_MS = 100

const SKELETON_ROWS = 5

interface ReleaseNotesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scrollToNoteId?: string
  /** Start fetching before the modal opens, e.g. when its trigger is hovered */
  preload?: boolean
}

// Mirrors the ReleaseNoteItem layout so content does not jump when it loads.
function ReleaseNoteSkeleton() {
  return (
    <div className="flex items-start gap-4">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}

export function ReleaseNotesModal({
  open,
  onOpenChange,
  scrollToNoteId,
  preload = false,
}: ReleaseNotesModalProps) {
  // The modal is always mounted in the header, so fetch only when needed.
  const { data, isPending, isError } = useReleaseNotes({
    enabled: open || preload,
  })
  const notes = data?.notes ?? []

  useEffect(() => {
    if (open && scrollToNoteId) {
      const timeout = setTimeout(() => {
        const element = document.getElementById(scrollToNoteId)
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        }
      }, SCROLL_DELAY_MS)
      return () => clearTimeout(timeout)
    }
  }, [open, scrollToNoteId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed height: the modal keeps its size while the notes load. */}
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            Nyheter och uppdateringar
            {data?.canManage && (
              <Link
                to={routes.releaseNotesAdmin}
                onClick={() => onOpenChange(false)}
                title="Hantera nyheter"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Hantera nyheter</span>
              </Link>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-6 pr-2 -mr-2">
          {isError ? (
            <p className="text-sm text-muted-foreground">
              Kunde inte hämta nyheter.
            </p>
          ) : isPending ? (
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <ReleaseNoteSkeleton key={index} />
            ))
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga nyheter ännu.</p>
          ) : (
            notes.map((note) => (
              <ReleaseNoteItem key={note.id} note={note} id={note.id} />
            ))
          )}
        </div>
        <div className="pt-4 border-t text-center">
          <SupportMessage />
        </div>
      </DialogContent>
    </Dialog>
  )
}
