import { Loader2 } from 'lucide-react'

import type { PropertyKvvAreaLookup } from '@/services/api/core'

import { useKvvAreaByProperty } from '../hooks/useKvvAreaByProperty'

type Responsible = NonNullable<PropertyKvvAreaLookup['responsible']>

export const formatResponsible = (responsible: Responsible): string => {
  const name = [responsible.firstName, responsible.lastName]
    .filter(Boolean)
    .join(' ')
  return name || responsible.username
}

interface KvvResponsibleFieldProps {
  propertyCode: string | null | undefined
}

export const KvvResponsibleField = ({
  propertyCode,
}: KvvResponsibleFieldProps) => {
  const { data, isLoading, isError } = useKvvAreaByProperty(
    propertyCode ?? undefined
  )

  const responsible = data?.responsible

  return (
    <>
      <div>
        <p className="text-sm text-muted-foreground">Kvartersvärd</p>
        {isLoading ? (
          <p className="font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
          </p>
        ) : responsible ? (
          <>
            <p className="font-medium">{formatResponsible(responsible)}</p>
            {(responsible.email || responsible.mobilePhone) && (
              <p className="text-sm text-muted-foreground">
                {[responsible.email, responsible.mobilePhone]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </>
        ) : (
          <p className="font-medium">{isError ? 'Kunde inte hämtas' : '-'}</p>
        )}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Kvartersvärdsområde</p>
        <p className="font-medium">
          {data
            ? [data.kvvArea.name, data.costCenter.name]
                .filter(Boolean)
                .join(', ') || data.kvvArea.code
            : '-'}
        </p>
      </div>
    </>
  )
}
