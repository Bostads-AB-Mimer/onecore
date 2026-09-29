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

import { ReleaseNoteItem } from './ReleaseNoteItem'
import { SupportMessage } from './SupportMessage'

/** Delay in ms to wait for modal render before scrolling */
const SCROLL_DELAY_MS = 100

interface ReleaseNotesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scrollToNoteId?: string
}

export function ReleaseNotesModal({
  open,
  onOpenChange,
  scrollToNoteId,
}: ReleaseNotesModalProps) {
  const { data, isLoading, isError } = useReleaseNotes()
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
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
          {isLoading && (
            <p className="text-sm text-muted-foreground">Laddar...</p>
          )}
          {isError && (
            <p className="text-sm text-muted-foreground">
              Kunde inte hämta nyheter.
            </p>
          )}
          {!isLoading && !isError && notes.length === 0 && (
            <p className="text-sm text-muted-foreground">Inga nyheter ännu.</p>
          )}
          {notes.map((note) => (
            <ReleaseNoteItem key={note.id} note={note} id={note.id} />
          ))}
        </div>
        <div className="pt-4 border-t text-center">
          <SupportMessage />
        </div>
      </DialogContent>
    </Dialog>
  )
}
