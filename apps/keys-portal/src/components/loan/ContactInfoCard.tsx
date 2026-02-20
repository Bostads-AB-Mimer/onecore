import { User, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Contact } from '@/services/types'

function formatAddress(addr?: Contact['address']): string {
  if (!addr) return 'Okänd adress'
  const line1 = [addr.street, addr.number].filter(Boolean).join(' ').trim()
  const line2 = [addr.postalCode, addr.city].filter(Boolean).join(' ').trim()
  return [line1, line2].filter(Boolean).join(', ') || 'Okänd adress'
}

interface ContactInfoCardProps {
  contacts: Contact[]
}

/**
 * Simple contact information card displaying name, personnummer/org number,
 * email, phone, and address for one or more contacts.
 */
export function ContactInfoCard({ contacts }: ContactInfoCardProps) {
  if (contacts.length === 0) {
    return (
      <Card id="tenant-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Kontakt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Ingen kontakt hittades</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card id="tenant-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Kontakt{contacts.length > 1 ? 'er' : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={
            contacts.length > 1 ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : ''
          }
        >
          {contacts.map((t, idx) => {
            const name = [t.firstName, t.lastName].filter(Boolean).join(' ')
            const displayName = name || t.fullName || 'Okänt namn'
            const isCompany = t.contactCode?.toUpperCase().startsWith('F')

            return (
              <div key={t.contactKey || idx} className="space-y-2">
                {contacts.length > 1 && (
                  <h3 className="font-semibold text-sm">
                    Kontakt {idx + 1}: {displayName}
                  </h3>
                )}
                {contacts.length === 1 && (
                  <h3 className="font-semibold">{displayName}</h3>
                )}
                <p className="text-sm text-muted-foreground">
                  {isCompany ? 'Organisationsnummer' : 'Personnummer'}:{' '}
                  {t.nationalRegistrationNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  Kundnummer: {t.contactCode}
                </p>
                {t.emailAddress && (
                  <p className="text-sm text-muted-foreground">
                    E-post: {t.emailAddress}
                  </p>
                )}
                {t.phoneNumbers?.[0]?.phoneNumber && (
                  <p className="text-sm text-muted-foreground">
                    Telefon: {t.phoneNumbers[0].phoneNumber}
                  </p>
                )}
                {t.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {formatAddress(t.address)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
