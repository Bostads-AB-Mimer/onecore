import { useEffect } from 'react'
import {
  Sparkles,
  Bug,
  Zap,
  Info,
  AlertTriangle,
  Pin,
  Newspaper,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v2/Dialog'
import { Badge } from '@/components/ui/v2/Badge'
import {
  RELEASE_NOTES,
  RELEASE_NOTE_CATEGORY_LABELS,
} from '@/data/release-notes'
import type { ReleaseNote, ReleaseNoteCategory } from '@/services/types'

const categoryIcons: Record<ReleaseNoteCategory, React.ElementType> = {
  feature: Sparkles,
  fix: Bug,
  improvement: Zap,
  info: Info,
  warning: AlertTriangle,
}

const categoryBadgeStyles: Record<ReleaseNoteCategory, string> = {
  feature: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  fix: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  improvement:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  warning:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

const categoryIconStyles: Record<ReleaseNoteCategory, string> = {
  feature: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  fix: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  improvement:
    'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  info: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  warning:
    'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface ReleaseNoteItemProps {
  note: ReleaseNote
}

function ReleaseNoteItem({ note }: ReleaseNoteItemProps) {
  const Icon = categoryIcons[note.category]

  return (
    <div id={note.id} className="flex items-start gap-4">
      <div
        className={`p-2 rounded-full flex-shrink-0 ${categoryIconStyles[note.category]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={categoryBadgeStyles[note.category]}>
            {RELEASE_NOTE_CATEGORY_LABELS[note.category]}
          </Badge>
          {note.pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
          <span className="text-sm text-muted-foreground">
            {formatDate(note.date)}
          </span>
        </div>
        <p className="font-semibold">{note.title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {note.description}
        </p>
      </div>
    </div>
  )
}

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
  // Sort notes: pinned first, then by date (already sorted by date in source)
  const sortedNotes = [...RELEASE_NOTES].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })

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
      }, 100)
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
            <ReleaseNoteItem key={note.id} note={note} />
          ))}
        </div>
        <div className="pt-4 border-t text-center">
          <p className="text-sm text-muted-foreground">
            Har du frågor eller behöver hjälp? Tveka inte att höra av dig till{' '}
            <span className="font-semibold text-primary">David</span> eller{' '}
            <span className="font-semibold text-primary">Lina</span> - vi finns
            här för att stötta dig!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
