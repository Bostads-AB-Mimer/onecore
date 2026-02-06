import { Phone, Mail, MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/v2/Button'

interface TenantContactActionsProps {
  phoneNumbers?: Array<{ phoneNumber: string }>
  email?: string
}

export function TenantContactActions({
  phoneNumbers,
  email,
}: TenantContactActionsProps) {
  const handleCall = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber.replace(/[\s-]/g, '')}`
  }

  const handleSMS = (phoneNumber: string) => {
    window.location.href = `sms:${phoneNumber.replace(/[\s-]/g, '')}`
  }

  const handleEmail = (emailAddress: string) => {
    window.location.href = `mailto:${emailAddress}`
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">E-post</p>
        <div className="flex items-center gap-2">
          <p className="font-medium">{email || '-'}</p>
          {email && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleEmail(email)}
              title="Skicka e-post"
            >
              <Mail className="h-4 w-4" />
            </Button>
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
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCall(phone.phoneNumber)}
                    title="Ring"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
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
  )
}
