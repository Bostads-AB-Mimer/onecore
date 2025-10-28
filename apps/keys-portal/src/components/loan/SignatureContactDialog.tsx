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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { Contact } from '@/services/types'

interface SignatureContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact1?: Contact
  contact2?: Contact
  onConfirm: (contact: Contact) => void
}

export function SignatureContactDialog({
  open,
  onOpenChange,
  contact1,
  contact2,
  onConfirm,
}: SignatureContactDialogProps) {
  const [selectedContact, setSelectedContact] = useState<
    'contact1' | 'contact2' | 'custom'
  >(
    contact1?.emailAddress &&
      !contact1.emailAddress.includes('redacted') &&
      !contact1.emailAddress.includes('example')
      ? 'contact1'
      : 'custom'
  )
  const [customEmail, setCustomEmail] = useState('')
  const [customName, setCustomName] = useState('')
  const [customPersonalNumber, setCustomPersonalNumber] = useState('')

  const getContactName = (contact?: Contact) => {
    if (!contact) return ''
    return contact.firstName && contact.lastName
      ? `${contact.firstName} ${contact.lastName}`
      : contact.fullName || 'Kontakt'
  }

  const handleConfirm = () => {
    if (selectedContact === 'custom') {
      if (!customEmail) return
      // Use contact1 as base, override email, name, and nationalRegistrationNumber
      const baseContact = contact1 || contact2
      if (!baseContact) return

      const customContact = {
        ...baseContact,
        emailAddress: customEmail,
        nationalRegistrationNumber:
          customPersonalNumber || baseContact.nationalRegistrationNumber,
      }

      // Override name fields if customName is provided
      if (customName) {
        const nameParts = customName.split(' ')
        customContact.firstName = nameParts[0] || null
        customContact.lastName = nameParts.slice(1).join(' ') || null
        customContact.fullName = customName
      }

      onConfirm(customContact)
    } else if (selectedContact === 'contact1' && contact1) {
      onConfirm(contact1)
    } else if (selectedContact === 'contact2' && contact2) {
      onConfirm(contact2)
    }
    onOpenChange(false)
  }

  const isValidEmail = (email: string) => {
    return email.includes('@') && email.length > 3
  }

  const canConfirm =
    selectedContact === 'custom'
      ? isValidEmail(customEmail)
      : (selectedContact === 'contact1' && contact1?.emailAddress) ||
        (selectedContact === 'contact2' && contact2?.emailAddress)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Välj mottagare för digital signering</DialogTitle>
          <DialogDescription>
            Välj vilken kontakt som ska få dokumentet för signering.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={selectedContact}
            onValueChange={(v) => setSelectedContact(v as any)}
          >
            {contact1 && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contact1" id="contact1" />
                <Label htmlFor="contact1" className="flex-1 cursor-pointer">
                  <div className="font-medium">{getContactName(contact1)}</div>
                  <div className="text-sm text-muted-foreground">
                    {contact1.emailAddress}
                  </div>
                </Label>
              </div>
            )}

            {contact2 && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contact2" id="contact2" />
                <Label htmlFor="contact2" className="flex-1 cursor-pointer">
                  <div className="font-medium">{getContactName(contact2)}</div>
                  <div className="text-sm text-muted-foreground">
                    {contact2.emailAddress}
                  </div>
                </Label>
              </div>
            )}

            <div className="flex items-start space-x-2">
              <RadioGroupItem value="custom" id="custom" className="mt-2" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="custom" className="cursor-pointer">
                  Anpassad mottagare
                </Label>
                {selectedContact === 'custom' && (
                  <>
                    <div>
                      <Label htmlFor="customEmail" className="text-xs">
                        E-postadress *
                      </Label>
                      <Input
                        id="customEmail"
                        type="email"
                        placeholder="email@example.com"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customPersonalNumber" className="text-xs">
                        Personnummer (för BankID test)
                      </Label>
                      <Input
                        id="customPersonalNumber"
                        placeholder="YYYYMMDDXXXX"
                        value={customPersonalNumber}
                        onChange={(e) =>
                          setCustomPersonalNumber(e.target.value)
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customName" className="text-xs">
                        Namn (valfritt)
                      </Label>
                      <Input
                        id="customName"
                        placeholder="Förnamn Efternamn"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Skicka för signering
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
