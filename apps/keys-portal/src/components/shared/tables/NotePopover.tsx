import { StickyNote } from 'lucide-react'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'

export interface NotePopoverProps {
  text: string | null | undefined
  label?: string
  align?: 'start' | 'center' | 'end'
}

/** Small StickyNote icon that opens a popover with the note text. Renders nothing if text is falsy. */
export function NotePopover({
  text,
  label = 'Notering',
  align = 'end',
}: NotePopoverProps) {
  if (!text) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
          <StickyNote className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 text-sm">
        <p className="font-medium text-xs text-muted-foreground mb-1">
          {label}
        </p>
        <p className="whitespace-pre-wrap">{text}</p>
      </PopoverContent>
    </Popover>
  )
}
