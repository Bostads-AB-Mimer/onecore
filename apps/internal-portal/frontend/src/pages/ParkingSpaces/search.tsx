import { Box, Typography } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import { SearchBar } from '../../components'
import { useParkingSpaceListings } from './hooks/useParkingSpaceListings'
import * as utils from '../../utils'
import { getActionColumns, getSearchColumns } from './helpers/columnsHelper'
import { filterListings } from './helpers/listingsHelper'
import { Listings } from './components/Listings'

const SearchParkingSpaces = () => {
  const [searchString, setSearchString] = useState<string>()

  const parkingSpaces = useParkingSpaceListings('all')

  const handleSearch = useCallback((v: string) => setSearchString(v), [])
  const onSearch = useMemo(
    () => utils.debounce(handleSearch, 300),
    [handleSearch]
  )

  const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })
  const numberFormatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  })

  return (
    <>
      <Box
        display="flex"
        alignItems="flex-end"
        justifyContent="space-between"
        paddingBottom="1rem"
      >
        <Typography variant="h1">Sök annons för bilplats</Typography>
        <Box display="flex" flexGrow="1" justifyContent="flex-end" gap="1rem">
          <SearchBar
            onChange={onSearch}
            disabled={parkingSpaces.isLoading}
            placeholder="Sök kundnr, personnr, objektsnr..."
          />
        </Box>
      </Box>
      {parkingSpaces.error && (
        <Typography color="error" paddingTop="1rem" paddingBottom="2rem">
          Ett okänt fel inträffade när parkeringsplatserna skulle hämtas.
        </Typography>
      )}

      <Box paddingTop="1rem">
        <Listings
          columns={getSearchColumns(dateFormatter, numberFormatter).concat(
            getActionColumns()
          )}
          rows={filterListings(parkingSpaces.data ?? [], searchString)}
          loading={parkingSpaces.status === 'pending'}
        />
      </Box>
    </>
  )
}

export default SearchParkingSpaces
