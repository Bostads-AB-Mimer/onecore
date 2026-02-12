import { Link } from 'react-router-dom'

import type { RentalBlockWithRentalObject } from '@/services/types'

import { formatISODate } from '@/shared/lib/formatters'

export const rentalBlockColumns = [
  {
    key: 'hyresobjekt',
    label: 'Hyresobjekt',
    className: 'px-2',
    render: (block: RentalBlockWithRentalObject) => {
      const displayText =
        block.rentalObject?.rentalId || block.rentalObject?.code || '-'
      const category = block.rentalObject?.category
      const rentalId = block.rentalObject?.rentalId
      const residenceId = block.rentalObject?.residenceId

      let href: string | null = null
      if (category === 'Bostad' && residenceId) {
        href = `/residences/${residenceId}`
      } else if (category === 'Bilplats' && rentalId) {
        href = `/parking-spaces/${rentalId}`
      } else if ((category === 'Lokal' || category === 'Förråd') && rentalId) {
        href = `/facilities/${rentalId}`
      }

      if (href) {
        return (
          <Link
            to={href}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {displayText}
          </Link>
        )
      }

      return <span className="font-medium">{displayText}</span>
    },
  },
  {
    key: 'kategori',
    label: 'Kategori',
    className: 'px-2',
    render: (block: RentalBlockWithRentalObject) =>
      block.rentalObject?.category || '-',
    hideOnMobile: true,
  },
  {
    key: 'typ',
    label: 'Typ',
    className: 'px-2',
    render: (block: RentalBlockWithRentalObject) =>
      block.rentalObject?.type || '-',
    hideOnMobile: true,
  },
  {
    key: 'adress',
    label: 'Adress',
    className: 'px-2',
    render: (block: RentalBlockWithRentalObject) =>
      block.rentalObject?.address || '-',
    hideOnMobile: true,
  },
  {
    key: 'fastighet',
    label: 'Fastighet',
    className: 'px-2',
    render: (block: RentalBlockWithRentalObject) => block.property?.name || '-',
    hideOnMobile: true,
  },
  {
    key: 'distrikt',
    label: 'Distrikt',
    className: 'px-2',
    render: (block: RentalBlockWithRentalObject) => block.distrikt || '-',
    hideOnMobile: true,
  },
  {
    key: 'orsak',
    label: 'Orsak',
    className: 'px-2',
    render: (block: RentalBlockWithRentalObject) => block.blockReason,
  },
  {
    key: 'startdatum',
    label: 'Startdatum',
    className: 'px-2',
    render: (block: RentalBlockWithRentalObject) =>
      formatISODate(block.fromDate),
    hideOnMobile: true,
  },
  {
    key: 'slutdatum',
    label: 'Slutdatum',
    className: 'px-2',
    render: (block: RentalBlockWithRentalObject) =>
      block.toDate ? formatISODate(block.toDate) : 'Pågående',
    hideOnMobile: true,
  },
  {
    key: 'hyra',
    label: 'Årshyra',
    className: 'px-2',
    render: (block: RentalBlockWithRentalObject) =>
      block.rentalObject?.yearlyRent
        ? `${Math.round(block.rentalObject.yearlyRent).toLocaleString('sv-SE')} kr/år`
        : '-',
    hideOnMobile: true,
  },
]
