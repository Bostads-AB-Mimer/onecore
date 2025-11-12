import React, { useEffect, useRef, useState } from 'react'
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
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Contact, schemas } from '@onecore/types'
import dayjs from 'dayjs'
import { z } from 'zod'

import { SearchContact } from '../ParkingSpaces/components/create-applicant-for-listing/SearchContact'
import { ContactSearchData } from '../ParkingSpaces/components/create-applicant-for-listing/types'
import CustomerInformation from './components/CustomerInformation'
import HousingType from './components/Form/HousingType'
import ReviewStatusSection from './components/ReviewStatusSection'
import HousingReferenceComment from './components/Form/HousingReferenceComment'
import CustomerReference from './components/CustomerReference'
import { useCustomerCard } from './hooks/useCustomerCard'
import {
  useCreateOrUpdateApplicationProfile,
  UpdateApplicationProfileRequestParamsSchema,
} from './hooks/useCreateOrUpdateApplicationProfile'
import {
  housingFieldMatrix,
  reviewStatusFieldMatrix,
} from './model/conditional'
import { setConditionalFields } from '../../utils/transform-model'
import { useProfile } from '../../common/hooks/useProfile'

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

const formDefaults = (): Inputs => {
  return {
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
  }
}

const ResidencesPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const contactCodeFromUrl = searchParams.get('contact_code')
  const [isOpenedFromPropertyTree, setIsOpenedFromPropertyTree] =
    useState(false)

  const formMethods = useForm<Inputs>({
    defaultValues: {
      ...formDefaults(),
    },
  })

  useProfile() // makeshift solution to force auth

  const { handleSubmit, reset } = formMethods

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
    const payload = {
      ...formDefaults(),
      housingType: data.housingType,
      numAdults: data.numAdults,
      numChildren: data.numChildren,
      housingReference: {
        ...formDefaults().housingReference,
        comment: data.housingReference.comment,
        reviewStatus: data.housingReference.reviewStatus,
        reasonRejected: null,
      },
    }

    setConditionalFields(data, housingFieldMatrix, data.housingType, payload)
    setConditionalFields(
      data,
      reviewStatusFieldMatrix,
      data.housingReference.reviewStatus,
      payload
    )

    const parsed =
      UpdateApplicationProfileRequestParamsSchema.safeParse(payload)

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
          phone: '',
          reasonRejected: '',
          reviewStatus: 'PENDING',
        },
      } = customerCard.applicationProfile ?? {}

      reset({
        housingType: housingType || '',
        housingTypeDescription: housingTypeDescription || '',
        landlord: landlord || '',
        numAdults: numAdults,
        numChildren: numChildren,
        housingReference: {
          comment: housingReference.comment || '',
          email: housingReference.email || '',
          expiresAt: dayjs(housingReference.expiresAt),
          phone: housingReference.phone || '',
          reasonRejected: housingReference.reasonRejected || '',
          reviewStatus: housingReference.reviewStatus || '',
        },
      })
    }
    if (isError) {
      reset()
    }
  }, [customerCard?.applicationProfile, isError, isSuccess, reset, status])

  const housingReference = customerCard?.applicationProfile?.housingReference

  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Auto-populate contact from URL query parameter
  useEffect(() => {
    if (contactCodeFromUrl && !selectedContact) {
      setSelectedContact({
        contactCode: contactCodeFromUrl,
        fullName: '', // Will be fetched by the useCustomerCard hook
      })
    }
  }, [contactCodeFromUrl, selectedContact])

  // Check if opened from property-tree via window.open
  useEffect(() => {
    setIsOpenedFromPropertyTree(!!window.opener && !window.opener.closed)
  }, [])

  // Handler to open/return to kundkort (property-tree tenant view)
  const handleOpenKundkort = () => {
    if (!selectedContact?.contactCode) return

    const propertyTreeUrl = `http://localhost:3000/tenants/${selectedContact.contactCode}`

    if (isOpenedFromPropertyTree && window.opener && !window.opener.closed) {
      // Close this window and return to the opener
      window.close()
    } else {
      // Open kundkort in a new tab
      window.open(propertyTreeUrl, '_blank')
    }
  }

  return (
    <Stack spacing={4} padding={0}>
      <Typography variant="h1">Sökandeprofil</Typography>
      <Container maxWidth="md" disableGutters>
        <Stack spacing={2}>
          <SearchContact
            placeholder="Sök på person eller kundnummer"
            contact={selectedContact}
            onSelect={setSelectedContact}
            inputRef={searchInputRef}
          />

          <Paper
            elevation={3}
            sx={{
              opacity: isSuccess ? 1 : 0.5,
              transition: 'opacity 0.3s',
              padding: '0px 20px',
            }}
          >
            <FormProvider {...formMethods}>
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

                      <ReviewStatusSection />

                      <CustomerReference
                        customerReferenceReceivedAt={
                          customerCard?.applicationProfile?.lastUpdatedAt
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
                      spacing={2}
                    >
                      <Grid item>
                        <Button type="submit" variant="contained">
                          Spara/uppdatera boendereferens
                        </Button>
                      </Grid>
                      <Grid item>
                        <Button
                          variant="outlined"
                          onClick={handleOpenKundkort}
                          disabled={!selectedContact}
                          sx={{
                            color: '#000 !important',
                            borderColor: '#000 !important',
                            backgroundColor: '#fff !important',
                            '&:hover': {
                              borderColor: '#333 !important',
                              backgroundColor: '#f5f5f5 !important',
                            },
                            '&.Mui-disabled': {
                              color: '#999 !important',
                              borderColor: '#ccc !important',
                            },
                          }}
                        >
                          Öppna Kundkort
                        </Button>
                      </Grid>
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
