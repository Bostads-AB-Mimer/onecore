import { Mail, MessageSquare, Phone } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import { CopyButton } from '@/shared/ui/CopyButton'
import { TooltipProvider } from '@/shared/ui/Tooltip'

interface TenantContactActionsProps {
  phoneNumbers?: Array<{ phoneNumber: string }>
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
              {phoneNumbers.map((phone, i) => (
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
