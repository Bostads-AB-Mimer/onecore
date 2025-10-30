import { Box, Button, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GetListingWithApplicantFilterByType, Listing } from '@onecore/types'
import { Link, useSearchParams } from 'react-router-dom'
import { TabContext, TabPanel } from '@mui/lab'

import { SearchBar, Tab, Tabs } from '../../components'
import { useParkingSpaceListings } from './hooks/useParkingSpaceListings'
import * as utils from '../../utils'
import {
  getActionColumns,
  getColumns,
  getOfferedColumns,
  getTab,
} from './helpers/columnsHelper'
import { Listings } from './components/Listings'
import { filterListings } from './helpers/listingsHelper'

const ParkingSpaces = () => {
  const [searchString, setSearchString] = useState<string>()
  const [searchParams, setSearchParams] = useSearchParams({ type: 'published' })

  const currentTypeSearchParam = getTab(searchParams.get('type'))

  const parkingSpaces = useParkingSpaceListings(currentTypeSearchParam)

  const handleSearch = useCallback((v: string) => setSearchString(v), [])
  const onSearch = useMemo(
    () => utils.debounce(handleSearch, 300),
    [handleSearch]
  )

  const handleTabChange = (
    _e: React.SyntheticEvent,
    tab: GetListingWithApplicantFilterByType
  ) => {
    setSearchParams({ type: tab })
  }

  const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC' })
  const numberFormatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  })

  useEffect(() => {
    parkingSpaces.refetch?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Box
        display="flex"
        alignItems="flex-end"
        justifyContent="space-between"
        paddingBottom="1rem"
      >
        <Typography variant="h1">Bilplatser</Typography>
        <Box display="flex" flexGrow="1" justifyContent="flex-end" gap="1rem">
          <Link to="/bilplatser/publicera">
            <Button variant="dark-outlined">
              Publicera bilplatser
            </Button>
          </Link>

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
      <TabContext value={currentTypeSearchParam}>
        <Tabs onChange={handleTabChange}>
          <Tab disableRipple label="Publicerade" value="published" />
          <Tab
            disableRipple
            label="Klara för erbjudande"
            value="ready-for-offer"
          />
          <Tab disableRipple label="Erbjudna" value="offered" />
          <Tab disableRipple label="Historik" value="historical" />
        </Tabs>
        <Box paddingTop="1rem">
          <TabPanel value="published" sx={{ padding: 0 }}>
            <Listings
              columns={getColumns(dateFormatter, numberFormatter).concat(
                getActionColumns()
              )}
              rows={filterListings(parkingSpaces.data ?? [], searchString)}
              loading={parkingSpaces.status === 'pending'}
              key="published"
            />
          </TabPanel>
          <TabPanel value="ready-for-offer" sx={{ padding: 0 }}>
            <Listings
              columns={getColumns(dateFormatter, numberFormatter).concat(
                getActionColumns()
              )}
              rows={filterListings(parkingSpaces.data ?? [], searchString)}
              loading={parkingSpaces.status === 'pending'}
              key="ready-for-offer"
            />
          </TabPanel>
          <TabPanel value="offered" sx={{ padding: 0 }}>
            <Listings
              columns={getOfferedColumns(dateFormatter, numberFormatter).concat(
                getActionColumns()
              )}
              rows={filterListings(parkingSpaces.data ?? [], searchString)}
              loading={parkingSpaces.status === 'pending'}
              key="offered"
            />
          </TabPanel>
          <TabPanel value="historical" sx={{ padding: 0 }}>
            <Listings
              columns={getColumns(dateFormatter, numberFormatter).concat(
                getActionColumns()
              )}
              rows={filterListings(parkingSpaces.data ?? [], searchString)}
              loading={parkingSpaces.status === 'pending'}
              key="historical"
            />
          </TabPanel>
        </Box>
      </TabContext>
    </>
  )
}

export default ParkingSpaces
