import { useEffect, useMemo } from 'react'
import { Newspaper } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v2/Dialog'
import {
  RELEASE_NOTES,
  sortReleaseNotesByPinned,
} from '@/data/release-notes'
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
  const sortedNotes = useMemo(
    () => sortReleaseNotesByPinned(RELEASE_NOTES),
    []
  )

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
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-6 pr-2 -mr-2">
          {sortedNotes.map((note) => (
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
