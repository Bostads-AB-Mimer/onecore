import { useState, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/v2/Dialog'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'

const MAX_SMS_LENGTH = 1600

interface SmsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipientName: string
  phoneNumber: string
  onSend: (message: string) => Promise<void>
}

export function SmsModal({
  open,
  onOpenChange,
  recipientName,
  phoneNumber,
  onSend,
}: SmsModalProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const charactersLeft = MAX_SMS_LENGTH - message.length

  const handleSend = useCallback(async () => {
    if (!message.trim() || isSending) return
    setIsSending(true)
    try {
      await onSend(message)
      setMessage('')
      onOpenChange(false)
    } finally {
      setIsSending(false)
    }
  }, [message, isSending, onSend, onOpenChange])

  const handleClose = () => {
    setMessage('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Skicka SMS
          </DialogTitle>
          <DialogDescription>
            Till {recipientName} ({phoneNumber})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Meddelande</label>
              <span
                className={cn(
                  'text-sm',
                  charactersLeft < 20
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                {charactersLeft} tecken kvar
              </span>
            </div>
            <Textarea
              placeholder="Skriv ditt SMS-meddelande här..."
              value={message}
              onChange={(e) =>
                setMessage(e.target.value.slice(0, MAX_SMS_LENGTH))
              }
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Avbryt
          </Button>
          <Button onClick={handleSend} disabled={!message.trim() || isSending}>
            {isSending ? 'Skickar...' : 'Skicka SMS'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
