import {
  Box,
  Typography,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material'
import { useLocation } from 'react-router-dom'

import {
  useCommittedChoices,
  MaterialChoice,
} from './hooks/useCommittedChoices'

const MaterialChoiceDetails = () => {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const apartmentId = searchParams.get('rentalPropertyId') ?? ''

  const { data } = useCommittedChoices(apartmentId)
  const materialChoices = data?.materialChoices
  console.log('choices', materialChoices)

  return (
    <Box style={{ padding: '4mm', margin: '4mm' }}>
      <Typography variant="h1">Materialval</Typography>
      <Divider />
      <Typography variant="h2">Lägenhetsid: {apartmentId}</Typography>

      {materialChoices && materialChoices.length > 0 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell style={{ width: '25%' }}>RUM</TableCell>
                <TableCell style={{ width: '25%' }}>VAL</TableCell>
                <TableCell style={{ width: '50%' }}>BESKRIVNING</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {materialChoices.map(
                (choice: MaterialChoice) => (
                  console.log('choice', choice.MaterialChoiceId),
                  (
                    <TableRow key={`choice_${choice.MaterialChoiceId}`}>
                      <TableCell>{choice.RoomType}</TableCell>
                      <TableCell>{choice.Caption || 'null'}</TableCell>
                      <TableCell>{choice.ShortDescription || 'null'}</TableCell>
                    </TableRow>
                  )
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography>No data available</Typography>
      )}
    </Box>
  )
}

export default MaterialChoiceDetails
