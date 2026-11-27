import type { KvvAreaResolveParams } from '@/services/api/core'

import { formatUserName } from '@/shared/lib/formatters'

import {
  useKvvAreaResolve,
  usePropertyKvvAreas,
} from '../hooks/useKvvAreaResolve'
import type { KvvAreasResult } from '../lib/combineKvvAreas'
import { formatKvvArea } from '../lib/formatKvvArea'

type KvvResponsibleViewProps = KvvAreasResult & { withDistrict: boolean }

/**
 * One line per KVV-area, "<kvartersvärd> – <område>", so a split property shows
 * who covers which part. A failed lookup gets its own message instead of "-",
 * which would read as "nobody is responsible".
 */
export const KvvResponsibleView = ({
  areas,
  isLoading,
  isError,
  withDistrict,
}: KvvResponsibleViewProps) => (
  <div>
    <p className="text-sm text-muted-foreground">
      {areas.length > 1 ? 'Kvartersvärdar' : 'Kvartersvärd'}
    </p>
    {isLoading ? (
      <p className="font-medium">...</p>
    ) : (
      <>
        {areas.map((area) => {
          const { responsible } = area
          return (
            <div key={area.kvvArea.id}>
              <p className="font-medium">
                {`${responsible ? formatUserName(responsible).name : '-'} – ${formatKvvArea(area, { withDistrict })}`}
              </p>
              {responsible?.mobilePhone && (
                <p className="text-sm text-muted-foreground">
                  {responsible.mobilePhone}
                </p>
              )}
              {responsible?.email && (
                <p className="text-sm text-muted-foreground">
                  {responsible.email}
                </p>
              )}
            </div>
          )
        })}
        {isError ? (
          <p className="text-sm text-muted-foreground">
            {areas.length > 0
              ? 'Kunde inte hämta alla kvartersvärdar'
              : 'Kunde inte hämta kvartersvärd'}
          </p>
        ) : (
          areas.length === 0 && <p className="font-medium">-</p>
        )}
      </>
    )}
  </div>
)

/** Kvartersvärd of a single location (rental object or building). */
export const KvvResponsibleField = ({
  location,
}: {
  location: KvvAreaResolveParams | undefined
}) => {
  const { data, isLoading, isError } = useKvvAreaResolve(location)
  return (
    <KvvResponsibleView
      areas={data ? [data] : []}
      isLoading={isLoading}
      isError={isError}
      withDistrict
    />
  )
}

/** Kvartersvärdar of a property; lists several when the property is split. */
export const PropertyKvvResponsibleField = ({
  propertyCode,
  buildingCodes,
}: {
  propertyCode: string
  buildingCodes: string[]
}) => {
  const result = usePropertyKvvAreas(propertyCode, buildingCodes)
  // The property page shows the district in its own field.
  return <KvvResponsibleView {...result} withDistrict={false} />
}
