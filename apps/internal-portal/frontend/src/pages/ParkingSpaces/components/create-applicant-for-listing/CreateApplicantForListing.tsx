import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  IconButton,
  Divider,
  Radio,
  FormControlLabel,
  RadioGroup,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { CreateNoteOfInterestErrorCodes, Listing, Tenant } from '@onecore/types'
import { toast } from 'react-toastify'
import { LoadingButton, TabContext, TabPanel } from '@mui/lab'

import {
  CreateNoteOfInterestRequestParams,
  useCreateNoteOfInterest,
} from '../../hooks/useCreateNoteOfInterest'
import { SearchContact } from './SearchContact'
import { ListingInfo } from './ListingInfo'
import { ContactSearchData } from './types'
import {
  TenantWithValidation,
  useTenantWithValidation,
} from '../../hooks/useTenantWithValidation'
import { ContactInfo } from './ContactInfo'
import { Tab, Tabs } from '../../../../components'
import { RequestError } from '../../../../types'
import { ContactInfoLoading } from './ContactInfoLoading'
import {
  useCreateNonScoredLease,
  CreateNonScoredLeaseErrorCodes,
  CreateNonScoredLeaseParams,
} from '../../hooks/useCreateNonScoredLease'
import { Contact } from '@onecore/types'
import { useContactByContactCode } from '../../hooks/useContactByContactCode'

export interface Props {
  listing: Listing
  disabled: boolean
}

export const CreateApplicantForListing = (props: Props) => {
  const isNonScored = props.listing.rentalRule === 'NON_SCORED'
  const navigate = useNavigate()

  const createNoteOfInterest = useCreateNoteOfInterest(props.listing.id)
  const createNonScoredLease = useCreateNonScoredLease(props.listing.id)

  const [open, setOpen] = useState(false)
  const [selectedContact, setSelectedContact] =
    useState<ContactSearchData | null>(null)
  const [selectedTab, setSelectedTab] = useState('1')

  const [applicationType, setApplicationType] = useState<
    'Replace' | 'Additional'
  >()

  // For SCORED listings: validate tenant with housing contract requirements
  const tenantQuery = useTenantWithValidation(
    !isNonScored ? selectedContact?.contactCode : undefined,
    props.listing.rentalObject.residentialAreaCode,
    props.listing.rentalObjectCode
  )

  // For NON_SCORED listings: fetch contact to validate address
  const contactQuery = useContactByContactCode<Contact>(
    isNonScored ? selectedContact?.contactCode : undefined
  )

  // Check if contact has valid address for NON_SCORED
  const hasValidAddress =
    isNonScored &&
    contactQuery.data?.address?.street &&
    contactQuery.data?.address?.city &&
    contactQuery.data?.address?.postalCode

  const onCreate = (params: CreateNoteOfInterestRequestParams) =>
    createNoteOfInterest.mutate(params, {
      onSuccess: () => {
        onCloseModal()
        toast('Intresseanmälan skapad', {
          type: 'success',
          hideProgressBar: true,
        })
      },
    })

  const onCreateNonScoredLease = (params: CreateNonScoredLeaseParams) => {
    createNonScoredLease.mutate(params, {
      onSuccess: () => {
        // Show success toast with navigation option
        const toastId = toast.success(
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              wordBreak: 'keep-all',
            }}
          >
            <span>Bilplatskontrakt skapat och tilldelat</span>
            <Button
              size="small"
              variant="dark"
              onClick={() => {
                toast.dismiss(toastId)
                navigate(`/bilplatser/${props.listing.id}`)
              }}
            >
              Visa
            </Button>
          </div>,
          {
            autoClose: 8000,
            hideProgressBar: false,
          }
        )
        // Close the dialog
        setOpen(false)
        setSelectedContact(null)
        setApplicationType(undefined)
      },
    })
  }

  const onCloseModal = () => {
    setOpen(false)
    setSelectedContact(null)
    setApplicationType(undefined)
  }

  const handleChange = (_e: React.SyntheticEvent, tab: string) =>
    setSelectedTab(tab)

  const calculateStartDate = (vacantFrom: Date | undefined): string => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    if (!vacantFrom) return today.toISOString()

    const vacantDate = new Date(vacantFrom)
    vacantDate.setUTCHours(0, 0, 0, 0)

    return vacantDate > today ? vacantDate.toISOString() : today.toISOString()
  }

  const renderTenantQueryError = (error: any) => {
    if (!error) return null

    if (
      error?.response?.data?.type === 'no-valid-housing-contract' ||
      error?.response?.data?.type === 'contact-not-tenant'
    ) {
      return <ValidLeaseMissingError />
    }

    return <DefaultError />
  }

  return (
    <>
      <Button
        disabled={props.disabled}
        size="small"
        variant="dark"
        onClick={() => setOpen(true)}
      >
        <Box
          sx={{
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          Ny anmälan
        </Box>
      </Button>
      <Dialog
        onClose={onCloseModal}
        open={open}
        maxWidth="sm"
        fullWidth
        TransitionProps={{ exit: false }}
      >
        {createNoteOfInterest.error || createNonScoredLease.error ? (
          <CreateApplicantError
            reset={
              isNonScored
                ? createNonScoredLease.reset
                : createNoteOfInterest.reset
            }
            error={
              isNonScored
                ? createNonScoredLease.error!
                : createNoteOfInterest.error!
            }
          />
        ) : (
          <Box paddingTop="0.5rem">
            <Box display="flex">
              <DialogTitle variant="h1" fontSize={24} textAlign="left">
                {isNonScored
                  ? `Tilldela bilplats, ${props.listing.rentalObject.address}`
                  : `Ny intresseanmälan, ${props.listing.rentalObject.address}`}
              </DialogTitle>
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                marginLeft="auto"
                marginRight="1rem"
              >
                <IconButton onClick={() => setOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
            <DialogContent sx={{ paddingTop: '0.5rem' }}>
              <Box paddingX="0.5rem">
                <Typography variant="h2">Objektsinformation</Typography>
                <ListingInfo listing={props.listing} />
              </Box>
              <Box paddingX="0.5rem" paddingTop="1rem">
                <TabContext value={selectedTab}>
                  <Tabs onChange={handleChange}>
                    <Tab
                      disableRipple
                      label="Kundinformation"
                      value="1"
                      sx={{ paddingLeft: 0 }}
                    />
                    {/*<Tab*/}
                    {/*  label={`Kontrakt (${leases.length})`}*/}
                    {/*  value="2"*/}
                    {/*  disableRipple*/}
                    {/*/>*/}
                  </Tabs>
                  <TabPanel value="1" sx={{ padding: 0 }}>
                    <SearchContact
                      onSelect={setSelectedContact}
                      contact={selectedContact}
                    />
                    {isNonScored ? (
                      <>
                        {contactQuery.isLoading && <ContactInfoLoading />}
                        {contactQuery.data && !hasValidAddress && (
                          <Box paddingTop="1rem">
                            <Typography color="error">
                              Kontakten saknar adress (gatuadress, stad eller
                              postnummer). Uppdatera kontaktuppgifterna före
                              tilldelning.
                            </Typography>
                          </Box>
                        )}
                        {contactQuery.error && <DefaultError />}
                        <Box>
                          <Divider />
                        </Box>
                      </>
                    ) : (
                      <>
                        {!tenantQuery.isLoading && (
                          <ContactInfo
                            tenant={tenantQuery.data?.tenant ?? null}
                          />
                        )}
                        {tenantQuery.isLoading && <ContactInfoLoading />}
                        {renderTenantQueryError(tenantQuery.error)}
                        {tenantQuery.data &&
                          tenantQuery.data.validationResult == 'ok' &&
                          tenantQuery.data.tenant.isAboutToLeave && (
                            <ValidLeaseMissingError />
                          )}
                        <Box>
                          <Divider />
                        </Box>
                      </>
                    )}
                  </TabPanel>
                  {/*<Contracts leases={leases} />*/}
                </TabContext>
              </Box>
              {!isNonScored &&
                tenantQuery.data &&
                tenantQuery.data.validationResult !== 'ok' && (
                  <Box>
                    <Box
                      paddingX="0.5rem"
                      paddingTop="0.5rem"
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography>Ärendetyp</Typography>
                      <RadioGroup name="radio-buttons-group" row>
                        <FormControlLabel
                          disabled={
                            tenantQuery?.data.validationResult === 'no-contract'
                          }
                          checked={applicationType === 'Replace'}
                          control={<Radio size="small" />}
                          label="Byte"
                          onChange={() => setApplicationType('Replace')}
                        />
                        <FormControlLabel
                          disabled={
                            tenantQuery?.data.validationResult === 'no-contract'
                          }
                          checked={applicationType === 'Additional'}
                          control={<Radio size="small" />}
                          label="Hyra flera"
                          onChange={() => setApplicationType('Additional')}
                        />
                      </RadioGroup>
                    </Box>
                    <Box paddingX="0.5rem" paddingTop="0.5rem">
                      <Typography color="error">
                        <Box>
                          {translateValidationResult(
                            tenantQuery.data.validationResult
                          )}
                        </Box>
                      </Typography>
                    </Box>
                  </Box>
                )}
              {!isNonScored && tenantQuery.data && (
                <Box paddingX="0.5rem" paddingTop="1rem">
                  <Typography color="error">
                    {renderWarningIfDistrictsMismatch(
                      props.listing,
                      tenantQuery?.data.tenant
                    )}
                  </Typography>
                </Box>
              )}
              <Box
                paddingTop="2rem"
                display="flex"
                justifyContent="space-between"
              >
                <Button onClick={onCloseModal} variant="dark-outlined">
                  Avbryt
                </Button>
                {isNonScored ? (
                  // NON_SCORED: Show "Tilldela" button if contact has valid address
                  selectedContact && hasValidAddress ? (
                    <LoadingButton
                      disabled={false}
                      loading={createNonScoredLease.isPending}
                      variant="dark"
                      onClick={() =>
                        onCreateNonScoredLease({
                          contactCode: selectedContact.contactCode,
                          parkingSpaceId: props.listing.rentalObjectCode,
                          listingId: props.listing.id,
                          startDate: calculateStartDate(
                            props.listing.rentalObject.vacantFrom
                          ),
                        })
                      }
                    >
                      Tilldela
                    </LoadingButton>
                  ) : (
                    <Button disabled variant="dark">
                      Tilldela
                    </Button>
                  )
                ) : // SCORED: Show "Lägg till" button based on tenant validation
                tenantQuery.data ? (
                  <LoadingButton
                    disabled={
                      tenantQuery.data.validationResult === 'no-contract' ||
                      !tenantHasValidContractForTheDiscrict(
                        tenantQuery.data.tenant,
                        props.listing
                      )
                    }
                    loading={createNoteOfInterest.isPending}
                    variant="dark"
                    onClick={() =>
                      onCreate({
                        applicationType,
                        contactCode: tenantQuery.data.tenant.contactCode,
                        parkingSpaceId: props.listing.rentalObjectCode,
                      })
                    }
                  >
                    Lägg till
                  </LoadingButton>
                ) : (
                  <Button disabled variant="dark">
                    Lägg till
                  </Button>
                )}
              </Box>
            </DialogContent>
          </Box>
        )}
      </Dialog>
    </>
  )
}

function translateValidationResult(
  result: Exclude<TenantWithValidation['validationResult'], 'ok'>
) {
  const translationMap: Record<typeof result, string> = {
    'has-at-least-one-parking-space':
      'Kunden har redan bilplats. Välj "Byte" eller "Hyra flera"',
    'needs-replace-by-property':
      'Kunden måste byta bilplats eftersom denna bilplats ligger i ett begränsat område eller fastighet.',
    'needs-replace-by-residential-area':
      'Kunden måste byta bilplats eftersom denna bilplats ligger i ett begränsat område eller fastighet.',
    'no-contract':
      'Kunden saknar kontrakt i detta område eller denna fastighet.',
  }

  return translationMap[result]
}

function tenantHasValidContractForTheDiscrict(
  tenant: Tenant,
  listing: Listing
) {
  const hasUpComingContractInThisDistrict =
    tenant.upcomingHousingContract?.residentialArea?.code ===
    listing.rentalObject.residentialAreaCode
  const hasCurrentContractInThisDistrict =
    tenant.currentHousingContract?.residentialArea?.code ===
    listing.rentalObject.residentialAreaCode

  return hasCurrentContractInThisDistrict || hasUpComingContractInThisDistrict
}

function renderWarningIfDistrictsMismatch(listing: Listing, tenant: Tenant) {
  if (!tenantHasValidContractForTheDiscrict(tenant, listing)) {
    return (
      <Box paddingBottom={'1rem'}>
        {
          'Observera att kunden saknar boendekontrakt i området för parkeringsplatsen'
        }
      </Box>
    )
  }
  return null
}

const CreateApplicantError = (props: {
  reset: () => void
  error: RequestError<
    CreateNoteOfInterestErrorCodes | CreateNonScoredLeaseErrorCodes
  >
}) => (
  <Box
    padding="1rem"
    height="250px"
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="space-between"
  >
    <Typography textAlign="center" variant="h1">
      {props.error.errorHeading}
    </Typography>
    <Box>{props.error.errorMessage}</Box>
    <Box paddingTop="2rem">
      <Button variant="dark-outlined" onClick={props.reset}>
        Försök igen
      </Button>
    </Box>
  </Box>
)

const ValidLeaseMissingError = () => (
  <Typography color="error">
    Kunden saknar giltigt bostadskontrakt. Det går endast att söka bilplats med
    gällande och kommande bostadskontrakt
  </Typography>
)

const DefaultError = () => (
  <Typography color="error">
    Något gick fel. Försök igen eller kontakta support
  </Typography>
)
