import { Mail, MessageSquare, Phone } from 'lucide-react'

import type { ContactPhoneNumber } from '@/services/types'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { CopyButton } from '@/shared/ui/CopyButton'
import { TooltipProvider } from '@/shared/ui/Tooltip'

import { sortMainNumberFirst } from '../lib/phoneNumbers'

interface TenantContactActionsProps {
  phoneNumbers?: ContactPhoneNumber[]
  email?: string
  onSendSms?: (phoneNumber: string) => void
  onSendEmail?: (emailAddress: string) => void
}

// Strips spaces and dashes so the number works in dialers, SMS and pasting
const cleanPhoneNumber = (phoneNumber: string) =>
  phoneNumber.replace(/[\s-]/g, '')

export function TenantContactActions({
  phoneNumbers,
  email,
  onSendSms,
  onSendEmail,
}: TenantContactActionsProps) {
  const hasSeveralNumbers = (phoneNumbers?.length ?? 0) > 1

  const handleCall = (phoneNumber: string) => {
    window.location.href = `tel:${cleanPhoneNumber(phoneNumber)}`
  }

  const handleSMS = (phoneNumber: string) => {
    const cleaned = cleanPhoneNumber(phoneNumber)
    if (onSendSms) {
      onSendSms(cleaned)
    } else {
      window.location.href = `sms:${cleaned}`
    }
  }

  const handleEmail = (emailAddress: string) => {
    if (onSendEmail) {
      onSendEmail(emailAddress)
    } else {
      window.location.href = `mailto:${emailAddress}`
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">E-post</p>
          <div className="flex items-center gap-2">
            <p className="font-medium">{email || '-'}</p>
            {email && (
              <>
                <CopyButton label="E-post" value={email} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEmail(email)}
                  title="Skicka e-post"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Telefon</p>
          {phoneNumbers && phoneNumbers.length > 0 ? (
            <div className="space-y-3">
              {sortMainNumberFirst(phoneNumbers).map((phone, i) => (
                // Index key: numbers can be identical when contact details are masked outside production
                <div key={i} className="flex items-center gap-2">
                  <p className="font-medium">{phone.phoneNumber}</p>
                  <CopyButton
                    label="Telefon"
                    value={cleanPhoneNumber(phone.phoneNumber)}
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCall(phone.phoneNumber)}
                      title="Ring"
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSMS(phone.phoneNumber)}
                      title="Skicka SMS"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* The marker only helps choose between numbers, so skip it when there is just one */}
                  {hasSeveralNumbers && phone.isMainNumber && (
                    <Badge
                      variant="secondary"
                      className="px-2 py-0.5"
                      title="Standardnummer i Xpand – används för SMS"
                    >
                      Standard
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="font-medium">-</p>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
