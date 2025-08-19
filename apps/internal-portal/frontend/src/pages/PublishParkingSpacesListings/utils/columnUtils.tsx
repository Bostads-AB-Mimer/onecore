import { GridColDef } from '@mui/x-data-grid'
import { MenuItem, Select } from '@mui/material'
import { memo, useCallback } from 'react'
import { RentalObject } from '@onecore/types'

// Memoized Select component to prevent unnecessary re-renders
const RentalRuleSelect = memo(
  ({
    rentalObjectCode,
    value,
    onChange,
  }: {
    rentalObjectCode: string
    value: 'SCORED' | 'NON_SCORED'
    onChange: (rentalObjectCode: string, value: 'SCORED' | 'NON_SCORED') => void
  }) => {
    const handleChange = useCallback(
      (e: any) => {
        onChange(rentalObjectCode, e.target.value as 'SCORED' | 'NON_SCORED')
      },
      [rentalObjectCode, onChange]
    )

    return (
      <Select
        name="rentalRule"
        value={value}
        onChange={handleChange}
        fullWidth
        size="small"
      >
        <MenuItem value="SCORED">Intern</MenuItem>
        <MenuItem value="NON_SCORED">Poängfri</MenuItem>
      </Select>
    )
  }
)

// Create formatter outside of the function to avoid recreation on each call
const numberFormatter = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
})

export const getParkingSpaceColumns = (): Array<GridColDef<RentalObject>> => {
  return [
    {
      field: 'address',
      headerName: 'Bilplats',
      flex: 1.25,
      renderCell: ({ row }) => (
        <span>
          <span style={{ display: 'block' }}>{row.address}</span>
          {row.rentalObjectCode}
        </span>
      ),
    },
    {
      field: 'residentialAreaCaption',
      flex: 1,
      headerName: 'Område',
    },
    {
      field: 'districtCaption',
      flex: 1,
      headerName: 'Distrikt',
    },
    {
      field: 'objectTypeCaption',
      flex: 1,
      headerName: 'Bilplatstyp',
    },
    {
      field: 'monthlyRent',
      flex: 1,
      headerName: 'Hyra',
      valueFormatter: ({ value }) => `${numberFormatter.format(value)}/mån`,
    },
    {
      field: 'numTimesPublishedInInternalQueue',
      flex: 1,
      headerName: 'Antal publiceringar intern kö',
    },
  ]
}

export const getRentalRuleActionColumn = (
  rentalRules: Record<string, 'SCORED' | 'NON_SCORED'>,
  onRentalRuleChange: (
    rentalObjectCode: string,
    value: 'SCORED' | 'NON_SCORED'
  ) => void
): GridColDef<RentalObject> => {
  return {
    field: 'actions',
    type: 'actions',
    flex: 1,
    minWidth: 250,
    headerName: 'Publicera i kötyp',
    headerAlign: 'left',
    renderCell: ({ row }) => (
      // TODO: Rule-based selection of queue type depending on whether it has
      // been published before and which area it belongs to. If the parking
      // space is in an area with special rental rules, it defaults to the
      // `internal` queue.
      //
      // (Same as for the number of parking spaces per applicant)
      <RentalRuleSelect
        rentalObjectCode={row.rentalObjectCode}
        value={rentalRules[row.rentalObjectCode] || 'SCORED'}
        onChange={onRentalRuleChange}
      />
    ),
  }
}
