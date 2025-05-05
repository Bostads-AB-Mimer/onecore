import React, { useEffect, useState } from 'react'
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
import { toast } from 'react-toastify'
import dayjs from 'dayjs'
import { Contact, schemas } from 'onecore-types'
import { z } from 'zod'

import { SearchContact } from '../ParkingSpaces/components/create-applicant-for-listing/SearchContact'
import { ContactSearchData } from '../ParkingSpaces/components/create-applicant-for-listing/types'
import CustomerInformation from './components/CustomerInformation'
import HousingType from './components/Form/HousingType'
import HousingReferenceReviewStatus from './components/Form/ReviewStatus'
import HousingReferenceComment from './components/Form/HousingReferenceComment'
import CustomerReference from './components/CustomerReference'
import { useCustomerCard } from './hooks/useCustomerCard'
import {
  useCreateOrUpdateApplicationProfile,
  UpdateApplicationProfileRequestParamsSchema,
} from './hooks/useCreateOrUpdateApplicationProfile'

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
    reviewedBy: string | null
    reviewedAt: dayjs.Dayjs
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

const getContactsMainPhoneNumber = (contact: Contact) =>
  contact.phoneNumbers?.find(({ isMainNumber }) => isMainNumber)?.phoneNumber

const emptyStringToNull = (val: string | null | undefined): string | null =>
  val == null || val.trim() === '' ? null : val

const ResidencesPage: React.FC = () => {
  const { handleSubmit, ...formMethods } = useForm<Inputs>({
    defaultValues: {
      housingType: '',
      housingTypeDescription: '',
      housingReference: {
        comment: '',
        email: '',
        expiresAt: dayjs(),
        phone: '',
        reasonRejected: '',
        reviewStatus: 'PENDING',
      },
      landlord: '',
      numAdults: 1,
      numChildren: 0,
    },
  })

  const [selectedContact, setSelectedContact] =
    useState<ContactSearchData | null>(null)

  const {
    isError,
    isSuccess,
    status,
    data: customerCard,
    refetch,
  } = useCustomerCard(selectedContact?.contactCode)

  const createOrUpdateApplicationProfile = useCreateOrUpdateApplicationProfile()

  const onSubmit: SubmitHandler<Inputs> = (data: Inputs) => {
    const parsed = UpdateApplicationProfileRequestParamsSchema.safeParse({
      ...data,
      landlord: emptyStringToNull(data.landlord),
      housingReference: {
        ...data.housingReference,
        reasonRejected: emptyStringToNull(data.housingReference.reasonRejected),
        email: emptyStringToNull(data.housingReference.email),
        phone: emptyStringToNull(data.housingReference.phone),
        expiresAt: null,
      },
    })

    if (parsed.success) {
      createOrUpdateApplicationProfile.mutate(
        {
          contactCode: selectedContact?.contactCode ?? '',
          applicationProfile: parsed.data,
        },
        {
          onSuccess: () => {
            toast('Boendeprofilen är sparad', {
              type: 'success',
              hideProgressBar: true,
            })
            refetch()
          },
          onError: (_error) => {
            toast('Ett fel inträffade vid sparande av boendeprofilen', {
              type: 'error',
              hideProgressBar: true,
            })
          },
        }
      )
    } else {
      toast(
        `${parsed.error.issues[0].message}: ${parsed.error.issues[0].path.join(
          '.'
        )}`,
        {
          type: 'error',
          hideProgressBar: true,
        }
      )
    }
  }

  useEffect(() => {
    if (isSuccess) {
      const {
        housingType,
        housingTypeDescription,
        landlord,
        numAdults,
        numChildren,
        housingReference = {
          comment: '',
          email: '',
          expiresAt: dayjs(),
          reviewedAt: dayjs(),
          reviewedBy: '',
          phone: '',
          reasonRejected: '',
          reviewStatus: 'PENDING',
        },
      } = customerCard.applicationProfile ?? {}

      formMethods.reset({
        housingType: housingType || '',
        housingTypeDescription: housingTypeDescription || '',
        landlord: landlord || '',
        numAdults: numAdults,
        numChildren: numChildren,
        housingReference: {
          comment: housingReference.comment || '',
          email: housingReference.email || '',
          expiresAt: dayjs(housingReference.expiresAt),
          reviewedAt: dayjs(housingReference.reviewedAt),
          reviewedBy: housingReference.reviewedBy,
          phone: housingReference.phone || '',
          reasonRejected: housingReference.reasonRejected || '',
          reviewStatus: housingReference.reviewStatus || '',
        },
      })
    }
    if (isError) {
      formMethods.reset()
    }
    // Using exhaustive-deps rule leads to an infinite loop, using `status`
    // instead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const housingReference = customerCard?.applicationProfile?.housingReference

  return (
    <Stack spacing={4} padding={0}>
      <Typography variant="h1">Sökandeprofil</Typography>

      <Container maxWidth="md" disableGutters>
        <Stack spacing={2}>
          <SearchContact
            placeholder="Sök på person eller kundnummer"
            contact={selectedContact}
            onSelect={setSelectedContact}
          />

          <Paper
            elevation={3}
            sx={{
              opacity: isSuccess ? 1 : 0.5,
              transition: 'opacity 0.3s',
              padding: '0px 20px',
            }}
          >
            <FormProvider {...formMethods} handleSubmit={handleSubmit}>
              <form onSubmit={handleSubmit(onSubmit)}>
                <fieldset disabled={!isSuccess}>
                  <Grid container spacing={2} padding={2}>
                    <Grid item xs={12}>
                      <CustomerInformation
                        fullName={customerCard?.contact.fullName}
                        nationalRegistrationNumber={
                          customerCard?.contact.nationalRegistrationNumber
                        }
                        contactCode={customerCard?.contact.contactCode}
                        phoneNumber={
                          customerCard?.contact &&
                          getContactsMainPhoneNumber(customerCard.contact)
                        }
                      />

                      <HousingType />

                      <Divider />

                      <HousingReferenceReviewStatus />

                      <CustomerReference
                        customerReferenceReceivedAt={
                          housingReference?.createdAt
                        }
                        housingReferenceUpdatedAt={housingReference?.reviewedAt}
                        updatedBy={housingReference?.reviewedBy}
                        expiresAt={housingReference?.expiresAt}
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
                </fieldset>
              </form>
            </FormProvider>
          </Paper>
        </Stack>
      </Container>
    </Stack>
  )
}

export default ResidencesPage
