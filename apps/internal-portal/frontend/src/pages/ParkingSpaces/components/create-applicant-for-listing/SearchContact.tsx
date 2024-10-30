import {
  Box,
  Autocomplete,
  TextField,
  MenuItem,
  Typography,
} from '@mui/material'
import { useState, useMemo, useCallback } from 'react'

import * as utils from '../../../../utils'
import { useSearchContacts } from '../../hooks/useSearchContacts'
import { mdTheme } from '../../../../theme'
import { ContactSearchData } from './types'

export const SearchContact = (props: {
  onSelect: (contact: ContactSearchData | null) => void
  contact: ContactSearchData | null
}) => {
  const [searchString, setSearchString] = useState<string>('')
  const contactsQuery = useSearchContacts(searchString)

  const onSetSearchString = useMemo(
    () => utils.debounce((value: string) => setSearchString(value), 500),
    []
  )

  const handleSearch = useCallback(
    (v: string) => {
      onSetSearchString(v)
    },
    [onSetSearchString]
  )

  if (contactsQuery.error) {
    return (
      <Box paddingTop="1rem">
        <Typography color="error">
          Något gick fel. Försök igen eller kontakta support
        </Typography>
      </Box>
    )
  }

  return (
    <Box paddingTop="1rem">
      <Autocomplete<ContactSearchData>
        getOptionLabel={(v) => v.fullName}
        filterOptions={(v) => v}
        options={contactsQuery.data ?? []}
        onInputChange={(_, v) => handleSearch(v)}
        onChange={(_, v) => props.onSelect(v)}
        getOptionKey={(v) => v.contactCode}
        value={props.contact}
        ListboxProps={{ style: { maxHeight: 125 } }}
        noOptionsText="Inga boende hittades..."
        loading={contactsQuery.fetchStatus === 'fetching'}
        renderOption={(props, v) => (
          <MenuItem {...props} key={v.contactCode}>
            {v.fullName}
          </MenuItem>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            variant="outlined"
            placeholder="Sök boende"
            fullWidth
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
        )}
      />
    </Box>
  )
}
