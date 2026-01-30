import { MessageSquare, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface BulkActionBarProps {
  selectedCount: number
  onClear: () => void
  onSendSms: () => void
  onSendEmail?: () => void
  className?: string
}

export function BulkActionBar({
  selectedCount,
  onClear,
  onSendSms,
  onSendEmail,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg animate-in slide-in-from-bottom-4',
        className
      )}
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedCount} kunder valda
          </span>
          <button
            onClick={onClear}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &times; Rensa
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSendSms}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Skicka SMS
          </Button>
          {onSendEmail && (
            <Button variant="outline" onClick={onSendEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Skicka mejl
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
