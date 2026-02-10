import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyAutocomplete } from './KeyAutocomplete'
import { CommentInput } from '@/components/shared/CommentInput'
import { useCommentWithSignature } from '@/hooks/useCommentWithSignature'
import type { Key } from '@/services/types'
import { useToast } from '@/hooks/use-toast'

interface CreateMaintenanceLoanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyContactCode: string
  companyName: string
  preSelectedKeys?: Key[]
  onSuccess: () => void
}

export function CreateMaintenanceLoanDialog({
  open,
  onOpenChange,
  companyContactCode,
  companyName,
  preSelectedKeys = [],
  onSuccess,
}: CreateMaintenanceLoanDialogProps) {
  const { toast } = useToast()
  const { addSignature } = useCommentWithSignature()
  const [contactPerson, setContactPerson] = useState('')
  const [description, setDescription] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Key[]>(preSelectedKeys)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddKey = (key: Key) => {
    setSelectedKeys((prev) => [...prev, key])
  }

  const handleRemoveKey = (keyId: string) => {
    setSelectedKeys((prev) => prev.filter((k) => k.id !== keyId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedKeys.length === 0) {
      toast({
        title: 'Inga nycklar valda',
        description: 'Du måste välja minst en nyckel för lånet',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Import the service dynamically to avoid circular dependencies
      const { keyLoanService } = await import('@/services/api/keyLoanService')

      const keyIds = selectedKeys.map((k) => k.id)

      await keyLoanService.create({
        keys: keyIds,
        loanType: 'MAINTENANCE',
        contact: companyContactCode,
        contactPerson: contactPerson.trim() || null,
        description: addSignature(description) || null,
      })

      toast({
        title: 'Lån skapat',
        description: `${selectedKeys.length} ${selectedKeys.length === 1 ? 'nyckel' : 'nycklar'} har lånats ut`,
      })

      // Reset form
      setContactPerson('')
      setDescription('')
      setSelectedKeys([])
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('Error creating maintenance loan:', error)
      toast({
        title: 'Kunde inte skapa lån',
        description: 'Ett fel uppstod när lånet skulle skapas',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setContactPerson('')
    setDescription('')
    setSelectedKeys([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa nytt entreprenörslån</DialogTitle>
          <DialogDescription>
            Skapa ett nytt lån för {companyName} ({companyContactCode})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Person */}
          <div className="space-y-2">
            <Label htmlFor="contactPerson">Kontaktperson (valfritt)</Label>
            <Input
              id="contactPerson"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="T.ex. Anders Svensson"
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <CommentInput
            value={description}
            onChange={setDescription}
            label="Beskrivning (valfritt)"
            placeholder="T.ex. Entreprenörsnycklar för renoveringsprojekt Blocket A"
            rows={3}
          />

          {/* Key Selection */}
          <div className="space-y-2">
            <Label>
              Nycklar <span className="text-destructive">*</span>
            </Label>
            <KeyAutocomplete
              selectedKeys={selectedKeys}
              onAddKey={handleAddKey}
              onRemoveKey={handleRemoveKey}
              disabled={isSubmitting}
            />
            {selectedKeys.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedKeys.length}{' '}
                {selectedKeys.length === 1 ? 'nyckel' : 'nycklar'} vald
                {selectedKeys.length > 1 ? 'a' : ''}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || selectedKeys.length === 0}
            >
              {isSubmitting ? 'Skapar...' : 'Skapa lån'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
