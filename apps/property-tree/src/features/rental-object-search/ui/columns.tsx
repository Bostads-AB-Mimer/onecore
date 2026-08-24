// Result columns for the rental-object list. The base set is always shown; the
// optional ones (Valbara) are opt-in, so the default table stays readable
// while the data is there for whoever wants it.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { RentalObject } from '@/entities/property-tree'
import { RENTAL_OBJECT_TYPE_LABELS } from '@/entities/property-tree'

import { getPropertyObjectPath } from '@/shared/routes'

import type { RentalObjectDetails } from '../hooks/useRentalObjectDetails'

export interface RentalObjectColumn {
  key: string
  label: string
  render: (
    object: RentalObject,
    details: RentalObjectDetails | undefined
  ) => ReactNode
  hideOnMobile?: boolean
}

const numberFormat = new Intl.NumberFormat('sv-SE', {
  maximumFractionDigits: 0,
})
const areaFormat = new Intl.NumberFormat('sv-SE', {
  maximumFractionDigits: 1,
})

/** Amounts and areas render blank rather than 0 when the value is missing. */
const formatAmount = (value: number | null | undefined) =>
  value == null ? '' : `${numberFormat.format(value)} kr`

const formatArea = (value: number | null | undefined) =>
  value == null ? '' : `${areaFormat.format(value)} m²`

/** Grundhyra is monthly; per-m² is quoted yearly, as rents are in Sweden. */
const formatRentPerArea = (
  rent: number | null | undefined,
  area: number | null | undefined
) =>
  rent == null || !area
    ? ''
    : `${numberFormat.format((rent * 12) / area)} kr/m²/år`

/** Each type has its own detail page; 'Övrigt' has none, so those stay text. */
function RentalObjectLink({ object }: { object: RentalObject }) {
  const path = getPropertyObjectPath(object.type, object.rentalId)
  if (!path) return <>{object.rentalId}</>
  return (
    <Link to={path} className="font-medium text-primary hover:underline">
      {object.rentalId}
    </Link>
  )
}

export const BASE_COLUMNS: RentalObjectColumn[] = [
  {
    key: 'rentalId',
    label: 'Objektnummer',
    render: (o) => <RentalObjectLink object={o} />,
  },
  { key: 'address', label: 'Postadress', render: (o) => o.address ?? '' },
  {
    key: 'baseRent',
    label: 'Grundhyra',
    render: (_o, d) => formatAmount(d?.baseRent),
  },
  {
    key: 'area',
    label: 'BRA',
    render: (_o, d) => formatArea(d?.area),
  },
  {
    key: 'type',
    label: 'Hyresobjekttyp',
    render: (o) => RENTAL_OBJECT_TYPE_LABELS[o.type],
  },
  {
    // The subtype qualifies the type beside it, so the pair shares one
    // header. Hidden on mobile, where a label-less field reads as orphaned.
    key: 'subtypeName',
    label: '',
    render: (o) => o.subtypeName ?? '',
    hideOnMobile: true,
  },
  {
    key: 'property',
    label: 'Fastighetsbeteckning',
    render: (o) => o.propertyName ?? o.propertyCode ?? '',
    hideOnMobile: true,
  },
]

/** Off by default; the user turns these on per session. */
export const OPTIONAL_COLUMNS: RentalObjectColumn[] = [
  {
    key: 'additionalInfo',
    label: 'Annan information av vikt',
    render: (_o, d) => d?.additionalInfo ?? '',
    hideOnMobile: true,
  },
  {
    key: 'malarEnergiFacilityId',
    label: 'Anläggnings ID',
    render: (_o, d) => d?.malarEnergiFacilityId ?? '',
    hideOnMobile: true,
  },
  {
    key: 'rentPerArea',
    label: 'Grundhyra per m²',
    render: (_o, d) => formatRentPerArea(d?.baseRent, d?.area),
    hideOnMobile: true,
  },
]
