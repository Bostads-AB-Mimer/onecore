import type { ReactNode } from 'react'

import { formatDate, formatRent, tenureLabel } from '../bostad/format'
import type { BostadListing } from './useBostadListing'

// Sök ledigt uses the rental object code as the listing's id.
const mimerNuListingUrl = (rentalObjectCode: string) =>
  `https://www.mimer.nu/sok-ledigt/lediga-lagenheter/${encodeURIComponent(rentalObjectCode)}`

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}

/** "Objektsinformation" on the listing page. */
export function ObjectInformation({ listing }: { listing: BostadListing }) {
  return (
    <section aria-labelledby="object-information-heading">
      <h2 id="object-information-heading" className="text-lg font-semibold">
        Objektsinformation
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-6">
        <Field label="Lägenhet">
          {listing.address}
          <span className="block font-mono text-sm text-muted-foreground">
            {listing.rentalObjectCode}
          </span>
        </Field>
        <Field label="Område">{listing.areaName}</Field>
        <Field label="Lägenhetstyp">{tenureLabel(listing.tenureType)}</Field>
        <Field label="Antal rum">{listing.roomCount ?? '–'}</Field>
        <Field label="Storlek">
          {listing.size !== null ? `${listing.size} m²` : '–'}
        </Field>
        <Field label="Våning">{listing.floor ?? '–'}</Field>
        <Field label="Hyra">{formatRent(listing.rent)}</Field>
        <Field label="Sökande">{listing.activeApplicantCount}</Field>
        <Field label="Publicerad t.o.m.">
          {formatDate(listing.publishedTo)}
        </Field>
        <Field label="Ledig från och med">
          {formatDate(listing.vacantFrom)}
        </Field>
        <Field label="Annons">
          <a
            href={mimerNuListingUrl(listing.rentalObjectCode)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Visa annons på Mimer.nu
          </a>
        </Field>
      </dl>
    </section>
  )
}
