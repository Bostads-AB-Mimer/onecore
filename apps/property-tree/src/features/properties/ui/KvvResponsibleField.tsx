import { Loader2 } from 'lucide-react'

import type {
  KvvAreaLocation,
  PropertyKvvAreaLookup,
} from '@/services/api/core'

import { useKvvArea, usePropertyKvvAreas } from '../hooks/useKvvAreas'

type Responsible = NonNullable<PropertyKvvAreaLookup['responsible']>

export const formatResponsible = (responsible: Responsible): string => {
  const name = [responsible.firstName, responsible.lastName]
    .filter(Boolean)
    .join(' ')
  return name || responsible.username
}

const formatArea = (lookup: PropertyKvvAreaLookup): string =>
  [lookup.kvvArea.name, lookup.costCenter.name].filter(Boolean).join(', ') ||
  lookup.kvvArea.code

const KvvResponsibleView = ({
  areas,
  isLoading,
  isError,
}: {
  areas: PropertyKvvAreaLookup[]
  isLoading: boolean
  isError: boolean
}) => {
  const responsibles = areas.filter((a) => a.responsible)

  return (
    <>
      <div>
        <p className="text-sm text-muted-foreground">
          {areas.length > 1 ? 'Kvartersvärdar' : 'Kvartersvärd'}
        </p>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : responsibles.length > 0 ? (
          responsibles.map(({ kvvArea, responsible }) => (
            <div key={kvvArea.id}>
              <p className="font-medium">{formatResponsible(responsible!)}</p>
              {(responsible!.email || responsible!.mobilePhone) && (
                <p className="text-sm text-muted-foreground">
                  {[responsible!.email, responsible!.mobilePhone]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="font-medium">{isError ? 'Kunde inte hämtas' : '-'}</p>
        )}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">
          {areas.length > 1 ? 'Kvartersvärdsområden' : 'Kvartersvärdsområde'}
        </p>
        {areas.length > 0 ? (
          areas.map((area) => (
            <p key={area.kvvArea.id} className="font-medium">
              {formatArea(area)}
            </p>
          ))
        ) : (
          <p className="font-medium">-</p>
        )}
      </div>
    </>
  )
}

/** Kvartersvärd of a single location (rental object or building). */
export const KvvResponsibleField = ({
  location,
}: {
  location: KvvAreaLocation | undefined
}) => {
  const { data, isLoading, isError } = useKvvArea(location)
  return (
    <KvvResponsibleView
      areas={data ? [data] : []}
      isLoading={isLoading}
      isError={isError}
    />
  )
}

/** Kvartersvärdar of a property; lists several when the property is split. */
export const PropertyKvvResponsibleField = ({
  propertyCode,
  buildingCodes,
}: {
  propertyCode: string | undefined
  buildingCodes: string[]
}) => {
  const { areas, isLoading, isError } = usePropertyKvvAreas(
    propertyCode,
    buildingCodes
  )
  return (
    <KvvResponsibleView areas={areas} isLoading={isLoading} isError={isError} />
  )
}
