import React, { useState } from 'react'
import {
  Button,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material'

import { SearchContact } from '../ParkingSpaces/components/create-applicant-for-listing/SearchContact'
import { ContactSearchData } from '../ParkingSpaces/components/create-applicant-for-listing/types'
import CustomerInformation from './components/CustomerInformation'
import CurrentTypeOfHousingForm from './components/CurrentTypeOfHousingForm'
import HousingReferenceStatusForm from './components/HousingReferenceStatusForm'
import AdditionalNotesForm from './components/AdditionalNotesForm'
import CustomerReference from './components/CustomerReference'

const ResidencesPage: React.FC = () => {
  const [selectedContact, setSelectedContact] = useState<
    ContactSearchData | undefined
  >(undefined)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  return (
    <Stack spacing={4} padding={0}>
      <Typography variant="h1">Bostäder - sökandeuppgifter</Typography>

      <Container maxWidth="md" disableGutters>
        <Stack spacing={2}>
          <SearchContact
            placeholder="Sök på person eller kundnummer"
            contact={selectedContact}
            onSelect={setSelectedContact}
          />

          <Paper elevation={3}>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={2} padding={2}>
                <Grid item xs={12}>
                  <CustomerInformation
                    name="John Applebaum"
                    socialSecurityNumber="111122334444"
                    customerNumber="P123456"
                    phoneNumber="0720-123 45 67"
                  />

                  <CurrentTypeOfHousingForm />

                  <Divider />

                  <HousingReferenceStatusForm />

                  <CustomerReference
                    customerReferenceReceivedAt="2024-01-01"
                    housingReferenceUpdatedAt="2024-01-01"
                    updatedBy="MaS"
                    validUntil="2024-07-01"
                  />

                  <AdditionalNotesForm />
                </Grid>

                <Grid
                  item
                  container
                  justifyContent="center"
                  xs={12}
                  marginY={4}
                >
                  <Button type="submit" variant="contained">
                    Spara/uppdatera boendereferens
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>
        </Stack>
      </Container>
    </Stack>
  )
}

export default ResidencesPage
