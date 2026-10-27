import { useState, useEffect } from 'react'
import {
  Alert,
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Stack,
  Grid,
  CircularProgress,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AxiosError } from 'axios'

import { ContentBlocksList } from './components/ContentBlocksList'
import { ListingPreview } from './components/ListingPreview'
import { ContentBlock } from './components/ContentBlockEditor'
import { ReadOnlyContentBlocks } from './components/ReadOnlyContentBlocks'
import {
  useListingTextContent,
  useCreateListingTextContent,
  useUpdateListingTextContent,
  useDeleteListingTextContent,
} from './hooks/useListingTextContent'
import { useValidateRentalObject } from './hooks/useValidateRentalObject'
import {
  fromApiBlocks,
  toApiBlocks,
  hasInvalidBlock,
} from './utils/contentBlocks'

const ListingTextContentForm = () => {
  const navigate = useNavigate()
  const { rentalObjectCode } = useParams<{ rentalObjectCode: string }>()
  const [searchParams] = useSearchParams()
  const codeFromQuery = searchParams.get('code')

  const isEditMode = !!rentalObjectCode
  const [objectCode, setObjectCode] = useState<string>(
    rentalObjectCode || codeFromQuery || ''
  )
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Validate rental object code
  const validationQuery = useValidateRentalObject(objectCode)

  // Fetch the lookup (object text + market-area text) in edit mode, and in
  // create mode for the (debounced) object number that actually validated.
  const validatedCode = validationQuery.validatedCode?.trim()
  const lookupCode = isEditMode
    ? rentalObjectCode
    : validationQuery.data === true && validatedCode
      ? validatedCode
      : undefined
  const {
    data: existingData,
    isLoading: isLoadingExisting,
    error: loadError,
  } = useListingTextContent(lookupCode)

  // Mutations
  const createMutation = useCreateListingTextContent()
  const updateMutation = useUpdateListingTextContent()
  const deleteMutation = useDeleteListingTextContent()

  // Load existing content into the editor once the lookup resolves. Only in
  // edit mode - in create mode the lookup is used to warn about existing
  // content, not to pre-populate the form.
  useEffect(() => {
    if (isEditMode && existingData?.content) {
      setObjectCode(existingData.content.rentalObjectCode)
      setBlocks(fromApiBlocks(existingData.content.contentBlocks))
    }
  }, [isEditMode, existingData])

  const handleSubmit = async () => {
    if (!objectCode.trim()) {
      toast.error('Objektsnummer krävs')
      return
    }

    // Check if rental object code is valid
    if (!isEditMode && validationQuery.data === false) {
      toast.error('Objektsnumret finns inte i systemet')
      return
    }

    if (blocks.length === 0) {
      toast.error('Lägg till minst ett innehållsblock')
      return
    }

    if (hasInvalidBlock(blocks)) {
      toast.error('Kontrollera att alla block har giltigt innehåll')
      return
    }

    try {
      const contentBlocks = toApiBlocks(blocks)

      if (isEditMode && rentalObjectCode) {
        await updateMutation.mutateAsync({
          rentalObjectCode,
          data: { contentBlocks },
        })
        toast.success('Annonsinnehåll uppdaterat!')
      } else {
        await createMutation.mutateAsync({
          rentalObjectCode: objectCode,
          contentBlocks,
        })
        toast.success('Annonsinnehåll skapat!')
        navigate(`/annonsinnehall/${objectCode}/redigera`, { replace: true })
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 409) {
          toast.error('Annonsinnehåll finns redan för detta objektsnummer')
        } else if (error.response?.status === 404) {
          toast.error('Annonsinnehåll hittades inte')
        } else {
          toast.error('Ett fel inträffade vid sparande')
        }
      } else {
        toast.error('Ett okänt fel inträffade')
      }
    }
  }

  const handleDelete = async () => {
    if (!rentalObjectCode) return

    try {
      await deleteMutation.mutateAsync({ rentalObjectCode })
      toast.success('Annonsinnehåll raderat')
      navigate('/annonsinnehall')
    } catch (error) {
      toast.error('Ett fel inträffade vid radering')
    }
  }

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending

  // Only edit mode waits for the lookup. In create mode it merely feeds the
  // "already exists" alert and the market-area panel, and unmounting the form
  // here would blank the object-number field while the user is typing.
  if (isEditMode && isLoadingExisting) {
    return (
      <Box display="flex" justifyContent="center" padding={4}>
        <CircularProgress />
      </Box>
    )
  }

  // In edit mode, an object with no listing text has nothing to edit here.
  if (isEditMode && (loadError || existingData?.content === null)) {
    return (
      <Box padding={3}>
        <Typography color="error" gutterBottom>
          Kunde inte ladda annonsinnehåll
        </Typography>
        <Button variant="contained" onClick={() => navigate('/annonsinnehall')}>
          Tillbaka
        </Button>
      </Box>
    )
  }

  const marketArea = existingData?.marketArea ?? null
  const areaContent = existingData?.areaContent ?? null
  const marketAreaLabel = marketArea?.name ?? marketArea?.code ?? ''

  // In create mode, the lookup can reveal that the typed object number
  // already has listing text - creating would just 409, so point to the
  // existing entry instead.
  const hasExistingContent =
    !isEditMode && existingData != null && existingData.content !== null

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        marginBottom={3}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/annonsinnehall')}
          >
            Tillbaka
          </Button>
          <Typography variant="h4">
            {isEditMode ? 'Redigera' : 'Skapa'} annonsinnehåll
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          {isEditMode && (
            <>
              {!showDeleteConfirm ? (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving}
                >
                  Radera
                </Button>
              ) : (
                <Box display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    onClick={() => setShowDeleteConfirm(false)}
                    size="small"
                  >
                    Avbryt
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleDelete}
                    size="small"
                    disabled={isSaving}
                  >
                    Bekräfta radering
                  </Button>
                </Box>
              )}
            </>
          )}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSubmit}
            disabled={isSaving || hasExistingContent}
          >
            {isSaving ? 'Sparar...' : 'Spara'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper elevation={3} sx={{ padding: 3 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Texthantering för annonser
                </Typography>
                <TextField
                  fullWidth
                  value={objectCode}
                  onChange={(e) => setObjectCode(e.target.value)}
                  placeholder="Ange objektsnummer..."
                  disabled={isEditMode}
                  error={
                    !isEditMode &&
                    objectCode.trim().length > 0 &&
                    validationQuery.data === false
                  }
                  helperText={
                    isEditMode
                      ? 'Objektsnummer kan inte ändras efter att innehållet har skapats'
                      : !objectCode.trim()
                        ? 'Ange ett objektsnummer'
                        : validationQuery.isLoading
                          ? 'Verifierar objektsnummer...'
                          : validationQuery.data === false
                            ? 'Objektsnumret hittas inte'
                            : validationQuery.data === true
                              ? 'Objektsnumret är giltigt'
                              : 'Ange ett objektsnummer'
                  }
                />
              </Box>

              {hasExistingContent && (
                <Alert
                  severity="info"
                  action={
                    <Button
                      component={Link}
                      to={`/annonsinnehall/${objectCode.trim()}/redigera`}
                      size="small"
                    >
                      Öppna befintligt
                    </Button>
                  }
                >
                  Annonsinnehåll finns redan för detta objektsnummer.
                </Alert>
              )}

              <ContentBlocksList blocks={blocks} onBlocksChange={setBlocks} />

              {marketArea && (
                <Paper variant="outlined" sx={{ padding: 2 }}>
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle1">
                        Områdestext – {marketAreaLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Visas automatiskt efter objektets text i alla annonser i
                        området. Redigeras under Områdestexter.
                      </Typography>
                    </Box>

                    {areaContent ? (
                      <>
                        <ReadOnlyContentBlocks
                          blocks={areaContent.contentBlocks}
                        />
                        <Box>
                          <Button
                            component={Link}
                            to={`/omradestexter/${marketArea.code}/redigera`}
                            variant="outlined"
                            size="small"
                          >
                            Redigera områdestext
                          </Button>
                        </Box>
                      </>
                    ) : (
                      <Stack spacing={1}>
                        <Typography color="text.secondary">
                          Ingen områdestext finns för {marketAreaLabel} ännu.
                        </Typography>
                        <Box>
                          <Button
                            component={Link}
                            to={`/omradestexter/ny?code=${marketArea.code}`}
                            variant="outlined"
                            size="small"
                          >
                            Skapa områdestext
                          </Button>
                        </Box>
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box position="sticky" top={16}>
            <ListingPreview
              blocks={blocks}
              areaBlocks={areaContent?.contentBlocks}
              rentalObjectCode={objectCode}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}

export default ListingTextContentForm
