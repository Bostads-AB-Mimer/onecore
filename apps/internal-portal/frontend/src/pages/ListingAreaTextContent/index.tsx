import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Link } from 'react-router-dom'

import { useMarketAreas } from './hooks/useMarketAreas'
import { useListingAreaTextContents } from './hooks/useListingAreaTextContent'

const ListingAreaTextContent = () => {
  const {
    data: marketAreas,
    isLoading: isLoadingMarketAreas,
    error: marketAreasError,
  } = useMarketAreas()
  const {
    data: areaTextContents,
    isLoading: isLoadingAreaTextContents,
    error: areaTextContentsError,
  } = useListingAreaTextContents()

  const isLoading = isLoadingMarketAreas || isLoadingAreaTextContents
  const error = marketAreasError || areaTextContentsError

  return (
    <>
      <Box
        display="flex"
        alignItems="flex-end"
        justifyContent="space-between"
        paddingBottom="1rem"
      >
        <Typography variant="h1">Områdestexter</Typography>
        <Link to="/annonsinnehall">
          <Button variant="dark-outlined" startIcon={<ArrowBackIcon />}>
            Tillbaka till annonsinnehåll
          </Button>
        </Link>
      </Box>

      <Paper elevation={3} sx={{ padding: 3, marginTop: 2 }}>
        {isLoading && (
          <Box display="flex" justifyContent="center" padding={4}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Typography color="error">
            Ett fel inträffade vid hämtning av marknadsområden.
          </Typography>
        )}

        {!isLoading && !error && marketAreas && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Område</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Uppdaterad</TableCell>
                  <TableCell align="right">Åtgärd</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {marketAreas.map((marketArea) => {
                  const areaContent = areaTextContents?.find(
                    (content) => content.marketAreaCode === marketArea.code
                  )

                  return (
                    <TableRow key={marketArea.id}>
                      <TableCell>
                        <Typography variant="body2">
                          {marketArea.name ?? marketArea.code}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {marketArea.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={areaContent ? 'Har text' : 'Saknar text'}
                          color={areaContent ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {areaContent
                          ? new Date(areaContent.updatedAt).toLocaleString(
                              'sv-SE'
                            )
                          : '–'}
                      </TableCell>
                      <TableCell align="right">
                        {areaContent ? (
                          <Link
                            to={`/omradestexter/${marketArea.code}/redigera`}
                          >
                            <Button variant="contained" size="small">
                              Redigera
                            </Button>
                          </Link>
                        ) : (
                          <Link
                            to={`/omradestexter/ny?code=${marketArea.code}`}
                          >
                            <Button variant="outlined" size="small">
                              Skapa
                            </Button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </>
  )
}

export default ListingAreaTextContent
