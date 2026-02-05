import { useState, useEffect } from 'react'
import {
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
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AxiosError } from 'axios'

import { ContentBlocksList } from './components/ContentBlocksList'
import { ListingPreview } from './components/ListingPreview'
import { ContentBlock } from './components/ContentBlockEditor'
import {
  useListingTextContent,
  useCreateListingTextContent,
  useUpdateListingTextContent,
  useDeleteListingTextContent,
} from './hooks/useListingTextContent'
import { useValidateRentalObject } from './hooks/useValidateRentalObject'

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

  // Fetch existing data in edit mode
  const {
    data: existingData,
    isLoading: isLoadingExisting,
    error: loadError,
  } = useListingTextContent(isEditMode ? rentalObjectCode : undefined)

  // Mutations
  const createMutation = useCreateListingTextContent()
  const updateMutation = useUpdateListingTextContent()
  const deleteMutation = useDeleteListingTextContent()

  // Load existing data when in edit mode
  useEffect(() => {
    if (existingData) {
      setObjectCode(existingData.rentalObjectCode)
      setBlocks(
        existingData.contentBlocks.map((block, index) => ({
          ...block,
          id: `block-${index}`,
        }))
      )
    }
  }, [existingData])

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

    // Check for empty content
    const hasEmptyContent = blocks.some((block) => !block.content.trim())
    if (hasEmptyContent) {
      toast.error('Alla block måste ha innehåll')
      return
    }

    try {
      const contentBlocks = blocks.map(({ type, content }) => ({
        type,
        content,
      }))

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
      }

      navigate('/annonsinnehall')
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

  if (isLoadingExisting) {
    return (
      <Box display="flex" justifyContent="center" padding={4}>
        <CircularProgress />
      </Box>
    )
  }

  if (loadError && isEditMode) {
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
            disabled={isSaving}
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

              <ContentBlocksList blocks={blocks} onBlocksChange={setBlocks} />
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box position="sticky" top={16}>
            <ListingPreview blocks={blocks} rentalObjectCode={objectCode} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}

export default ListingTextContentForm
