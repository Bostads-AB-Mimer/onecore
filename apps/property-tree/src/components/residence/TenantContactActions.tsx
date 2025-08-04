import { Phone, MessageSquare, Mail } from 'lucide-react'

import { Button } from '@/components/ui/v2/Button'

interface TenantContactActionsProps {
  phone: string
  email: string
}

export function TenantContactActions({
  phone,
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
        <p className="text-sm text-muted-foreground">Telefon</p>
        <div className="flex items-center gap-2">
          <p className="font-medium">{phone}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCall(phone)}
              title="Ring"
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleSMS(phone)}
              title="Skicka SMS"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">E-post</p>
        <div className="flex items-center gap-2">
          <p className="font-medium">{email}</p>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleEmail(email)}
            title="Skicka e-post"
          >
            <Mail className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
