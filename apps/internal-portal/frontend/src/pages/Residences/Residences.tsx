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
import { useForm, SubmitHandler, FormProvider } from 'react-hook-form'
import dayjs from 'dayjs'
import { schemas } from 'onecore-types'
import { z } from 'zod'

import { SearchContact } from '../ParkingSpaces/components/create-applicant-for-listing/SearchContact'
import { ContactSearchData } from '../ParkingSpaces/components/create-applicant-for-listing/types'
import CustomerInformation from './components/CustomerInformation'
import HousingType from './components/Form/HousingType'
import HousingReferenceReviewStatus from './components/Form/ReviewStatus'
import HousingReferenceComment from './components/Form/HousingReferenceComment'
import CustomerReference from './components/CustomerReference'
import HousingTypeComponentSwitcher from './components/HousingTypeComponentSwitcher'
import HousingReferenceReviewStatusComponentSwitcher from './components/HousingReferenceReviewStatusComponentSwitcher'

type HousingTypes = z.infer<
  typeof schemas.v1.ApplicationProfileHousingTypeSchema
>

type RejectedReasons = z.infer<
  typeof schemas.v1.HousingReferenceReasonRejectedSchema
>

type ReviewStatus = z.infer<
  typeof schemas.v1.HousingReferenceReviewStatusSchema
>

export type Inputs = {
  housingType: HousingTypes | ''
  housingTypeDescription: string
  housingReference: {
    comment: string
    email: string
    expiresAt: dayjs.Dayjs
    lastAdminUpdatedAt: dayjs.Dayjs
    lastApplicantUpdatedAt: dayjs.Dayjs
    phone: string
    reasonRejected: RejectedReasons | ''
    reviewStatus: ReviewStatus
  }
  landlord: string
  numAdults: number
  numChildren: number
}

const onSubmit: SubmitHandler<Inputs> = (data) => console.log(data)

const ResidencesPage: React.FC = () => {
  const [selectedContact, setSelectedContact] =
    useState<ContactSearchData | null>(null)

  const { handleSubmit, ...formMethods } = useForm<Inputs>({
    defaultValues: {
      housingType: '',
      housingTypeDescription: '',
      housingReference: {
        comment: '',
        email: '',
        expiresAt: dayjs(),
        lastAdminUpdatedAt: dayjs(),
        lastApplicantUpdatedAt: dayjs(),
        phone: '',
        reasonRejected: '',
        reviewStatus: 'REJECTED',
      },
      landlord: '',
      numAdults: 1,
      numChildren: 0,
    },
  })

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
            <FormProvider handleSubmit={handleSubmit} {...formMethods}>
              <form onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={2} padding={2}>
                  <Grid item xs={12}>
                    <CustomerInformation
                      name="John Applebaum"
                      socialSecurityNumber="111122334444"
                      customerNumber="P123456"
                      phoneNumber="0720-123 45 67"
                    />

                    <HousingType />
                    <HousingTypeComponentSwitcher />

                    <Divider />

                    <HousingReferenceReviewStatus />
                    <HousingReferenceReviewStatusComponentSwitcher />

                    <CustomerReference
                      customerReferenceReceivedAt="2024-01-01"
                      housingReferenceUpdatedAt="2024-01-01"
                      updatedBy="MaS"
                      validUntil="2024-07-01"
                    />

                    <HousingReferenceComment />
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
            </FormProvider>
          </Paper>
        </Stack>
      </Container>
    </Stack>
  )
}

export default ResidencesPage
