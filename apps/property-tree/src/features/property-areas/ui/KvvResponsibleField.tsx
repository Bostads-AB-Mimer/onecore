import type { KvvAreaResolveParams } from '@/services/api/core'

import { useKvvAreaResolve } from '../hooks/useKvvAreaResolve'

interface KvvResponsibleFieldProps {
  location: KvvAreaResolveParams
}

const formatName = (user: {
  firstName?: string
  lastName?: string
  username: string
}) => [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username

export const KvvResponsibleField = ({ location }: KvvResponsibleFieldProps) => {
  const { data, isLoading } = useKvvAreaResolve(location)

  const responsible = data?.responsible

  return (
    <>
      <div>
        <p className="text-sm text-muted-foreground">Kvartersvärd</p>
        <p className="font-medium">
          {isLoading ? '...' : responsible ? formatName(responsible) : '-'}
        </p>
        {responsible?.mobilePhone && (
          <p className="text-sm text-muted-foreground">
            {responsible.mobilePhone}
          </p>
        )}
        {responsible?.email && (
          <p className="text-sm text-muted-foreground">{responsible.email}</p>
        )}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Förvaltningsområde</p>
        <p className="font-medium">
          {isLoading
            ? '...'
            : data
              ? [data.kvvArea.name ?? data.kvvArea.code, data.costCenter.name]
                  .filter(Boolean)
                  .join(' – ')
              : '-'}
        </p>
      </div>
    </>
  )
}
