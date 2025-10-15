import {
  Box,
  Autocomplete,
  TextField,
  MenuItem,
  Typography,
} from '@mui/material'
import { useState, useMemo, useCallback } from 'react'

import * as utils from '../../../utils'
import { useSearchRentalObjects, RentalObjectSearchData } from '../hooks/useSearchRentalObjects'
import { mdTheme } from '../../../theme'

type SearchRentalObjectProps = {
  placeholder?: string
  onSelect: (rentalObject: RentalObjectSearchData | null) => void
  rentalObject: RentalObjectSearchData | null
  disabled?: boolean
  inputRef?: React.MutableRefObject<HTMLInputElement | null>
}

export const SearchRentalObject = ({
  onSelect,
  rentalObject,
  placeholder = 'Sök hyresid...',
  disabled = false,
  inputRef,
}: SearchRentalObjectProps) => {
  const [searchString, setSearchString] = useState<string>('')
  const rentalObjectsQuery = useSearchRentalObjects(searchString)

  const onSetSearchString = useMemo(
    () => utils.debounce(setSearchString, 500),
    []
  )

  const handleSearch = useCallback((value: string) => {
    onSetSearchString(value.trim())
  }, [onSetSearchString])

  const options = rentalObjectsQuery.data ? [rentalObjectsQuery.data] : []

  return (
    <Box paddingTop="1rem">
      <Autocomplete<RentalObjectSearchData>
        getOptionLabel={(v) => v.rentalObjectCode}
        filterOptions={(v) => v}
        options={options}
        onInputChange={(_, v) => handleSearch(v)}
        onChange={(_, v) => onSelect(v || null)}
        getOptionKey={(v) => v.rentalObjectCode}
        value={rentalObject}
        disabled={disabled}
        ListboxProps={{ style: { maxHeight: 125 } }}
        noOptionsText="Inga objekt hittades..."
        loading={rentalObjectsQuery.fetchStatus === 'fetching'}
        renderOption={(props, v) => (
          <MenuItem {...props} key={v.rentalObjectCode}>
            <Box>
              <Typography variant="body1">{v.rentalObjectCode}</Typography>
              {v.address && (
                <Typography variant="body2" color="textSecondary">
                  {v.address}
                </Typography>
              )}
            </Box>
          </MenuItem>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            inputRef={inputRef}
            size="small"
            variant="outlined"
            placeholder={placeholder}
            fullWidth
          />
        )}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontSize: '16px',
            paddingTop: '2px',
            paddingBottom: '2px',
            color: '#000',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: mdTheme.palette.warmGrey.main,
              borderRadius: '6px',
              borderWidth: '1.5px',
            },
            '&.Mui-focused': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '1.5px',
                borderColor: '#2e2e2e',
              },
            },
            '& .MuiInputLabel-outlined': {
              color: '#2e2e2e',
              '&.Mui-focused': {},
            },
          },
        }}
      />
      {rentalObjectsQuery.error && (
        <Typography color="error" paddingTop="1rem">
          Något gick fel. Försök igen eller kontakta support
        </Typography>
      )}
    </Box>
  )
}
