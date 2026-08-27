import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
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

import { ContentBlocksList } from '../ListingTextContent/components/ContentBlocksList'
import { ListingPreview } from '../ListingTextContent/components/ListingPreview'
import { ContentBlock } from '../ListingTextContent/components/ContentBlockEditor'
import {
  fromApiBlocks,
  toApiBlocks,
  hasInvalidBlock,
} from '../ListingTextContent/utils/contentBlocks'
import { useMarketAreas } from './hooks/useMarketAreas'
import {
  useListingAreaTextContent,
  useCreateListingAreaTextContent,
  useUpdateListingAreaTextContent,
  useDeleteListingAreaTextContent,
} from './hooks/useListingAreaTextContent'

const ListingAreaTextContentForm = () => {
  const navigate = useNavigate()
  const { marketAreaCode } = useParams<{ marketAreaCode: string }>()
  const [searchParams] = useSearchParams()
  const codeFromQuery = searchParams.get('code')

  const isEditMode = !!marketAreaCode
  const [selectedCode, setSelectedCode] = useState<string>(
    marketAreaCode || codeFromQuery || ''
  )
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    data: marketAreas,
    isLoading: isLoadingMarketAreas,
    error: marketAreasError,
  } = useMarketAreas()

  // Fetch existing data in edit mode
  const {
    data: existingData,
    isLoading: isLoadingExisting,
    error: loadError,
  } = useListingAreaTextContent(isEditMode ? marketAreaCode : undefined)

  // Mutations
  const createMutation = useCreateListingAreaTextContent()
  const updateMutation = useUpdateListingAreaTextContent()
  const deleteMutation = useDeleteListingAreaTextContent()

  // Load existing data when in edit mode
  useEffect(() => {
    if (existingData) {
      setSelectedCode(existingData.marketAreaCode)
      setBlocks(fromApiBlocks(existingData.contentBlocks))
    }
  }, [existingData])

  const handleSubmit = async () => {
    if (!selectedCode.trim()) {
      toast.error('Marknadsområde krävs')
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

      if (isEditMode && marketAreaCode) {
        await updateMutation.mutateAsync({
          marketAreaCode,
          data: { contentBlocks },
        })
        toast.success('Områdestext uppdaterad!')
      } else {
        await createMutation.mutateAsync({
          marketAreaCode: selectedCode,
          contentBlocks,
        })
        toast.success('Områdestext skapad!')
        navigate(`/omradestexter/${selectedCode}/redigera`, { replace: true })
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 409) {
          toast.error('Områdestext finns redan för detta marknadsområde')
        } else if (error.response?.status === 404) {
          toast.error('Områdestext hittades inte')
        } else {
          toast.error('Ett fel inträffade vid sparande')
        }
      } else {
        toast.error('Ett okänt fel inträffade')
      }
    }
  }

  const handleDelete = async () => {
    if (!marketAreaCode) return

    try {
      await deleteMutation.mutateAsync({ marketAreaCode })
      toast.success('Områdestext raderad')
      navigate('/omradestexter')
    } catch (error) {
      toast.error('Ett fel inträffade vid radering')
    }
  }

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending

  if (isLoadingExisting || isLoadingMarketAreas) {
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
          Kunde inte ladda områdestext
        </Typography>
        <Button variant="contained" onClick={() => navigate('/omradestexter')}>
          Tillbaka
        </Button>
      </Box>
    )
  }

  if (marketAreasError) {
    return (
      <Box padding={3}>
        <Typography color="error" gutterBottom>
          Kunde inte ladda marknadsområden
        </Typography>
        <Button variant="contained" onClick={() => navigate('/omradestexter')}>
          Tillbaka
        </Button>
      </Box>
    )
  }

  const selectedMarketArea = marketAreas?.find(
    (marketArea) => marketArea.code === selectedCode
  )

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
            onClick={() => navigate('/omradestexter')}
          >
            Tillbaka
          </Button>
          <Typography variant="h4">
            {isEditMode ? 'Redigera' : 'Skapa'} områdestext
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
                  Texthantering för områden
                </Typography>
                <FormControl
                  fullWidth
                  disabled={isEditMode}
                  error={!isEditMode && !selectedCode.trim()}
                >
                  <InputLabel id="market-area-select-label">
                    Marknadsområde
                  </InputLabel>
                  <Select
                    labelId="market-area-select-label"
                    label="Marknadsområde"
                    value={selectedCode}
                    onChange={(e) => setSelectedCode(e.target.value)}
                  >
                    {marketAreas?.map((marketArea) => (
                      <MenuItem key={marketArea.code} value={marketArea.code}>
                        {marketArea.name ?? marketArea.code} ({marketArea.code})
                      </MenuItem>
                    ))}
                  </Select>
                  {isEditMode && (
                    <Typography variant="caption" color="text.secondary">
                      Området kan inte ändras efter att texten har skapats
                    </Typography>
                  )}
                </FormControl>
              </Box>

              <ContentBlocksList blocks={blocks} onBlocksChange={setBlocks} />
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box position="sticky" top={16}>
            <ListingPreview
              blocks={blocks}
              label={
                selectedMarketArea
                  ? `Område: ${selectedMarketArea.name ?? selectedMarketArea.code}`
                  : undefined
              }
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}

export default ListingAreaTextContentForm
