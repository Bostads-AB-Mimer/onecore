import { Box, Button, Typography, Paper, Stack } from '@mui/material'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import AddIcon from '@mui/icons-material/Add'

import { SearchBar } from '../../components'
import { useListingTextContent } from './hooks/useListingTextContent'

const ListingTextContent = () => {
  const [searchValue, setSearchValue] = useState<string>('')
  const [searchedCode, setSearchedCode] = useState<string>('')

  const { data, isLoading, error } = useListingTextContent(searchedCode)

  const handleSearch = (value: string) => {
    setSearchValue(value)
  }

  const handleSearchSubmit = () => {
    if (searchValue.trim()) {
      setSearchedCode(searchValue.trim())
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearchSubmit()
    }
  }

  return (
    <>
      <Box
        display="flex"
        alignItems="flex-end"
        justifyContent="space-between"
        paddingBottom="1rem"
      >
        <Typography variant="h1">Annonsinnehåll</Typography>
        <Box display="flex" flexGrow="1" justifyContent="flex-end" gap="1rem">
          <Link to="/annonsinnehall/ny">
            <Button variant="dark-outlined" startIcon={<AddIcon />}>
              Skapa nytt
            </Button>
          </Link>
        </Box>
      </Box>

      <Paper elevation={3} sx={{ padding: 3, marginTop: 2 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Sök med objektsnummer
            </Typography>
            <Box
              display="flex"
              gap={2}
              alignItems="center"
              onKeyPress={handleKeyPress}
            >
              <SearchBar
                value={searchValue}
                onChange={handleSearch}
                placeholder="Ange objektsnummer..."
              />
              <Button
                variant="contained"
                onClick={handleSearchSubmit}
                disabled={!searchValue.trim()}
              >
                Sök
              </Button>
            </Box>
          </Box>

          {error && searchedCode && (
            <Box>
              {error.response?.status === 404 ? (
                <Stack spacing={2}>
                  <Typography color="text.secondary">
                    Inget annonsinnehåll hittades för objektsnummer:{' '}
                    <strong>{searchedCode}</strong>
                  </Typography>
                  <Box>
                    <Link to={`/annonsinnehall/ny?code=${searchedCode}`}>
                      <Button variant="contained" size="small">
                        Skapa annonsinnehåll för {searchedCode}
                      </Button>
                    </Link>
                  </Box>
                </Stack>
              ) : (
                <Typography color="error">
                  Ett fel inträffade vid hämtning av annonsinnehåll.
                </Typography>
              )}
            </Box>
          )}

          {isLoading && searchedCode && (
            <Typography color="text.secondary">Söker...</Typography>
          )}

          {data && (
            <Paper elevation={1} sx={{ padding: 3 }}>
              <Stack spacing={2}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="h6">
                    Objektsnummer: {data.rentalObjectCode}
                  </Typography>
                  <Link
                    to={`/annonsinnehall/${data.rentalObjectCode}/redigera`}
                  >
                    <Button variant="contained">Visa och redigera</Button>
                  </Link>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Antal innehållsblock:{' '}
                    <strong>{data.contentBlocks.length}</strong>
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Skapad: {new Date(data.createdAt).toLocaleString('sv-SE')}
                  </Typography>
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    Uppdaterad:{' '}
                    {new Date(data.updatedAt).toLocaleString('sv-SE')}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Paper>
    </>
  )
}

export default ListingTextContent
