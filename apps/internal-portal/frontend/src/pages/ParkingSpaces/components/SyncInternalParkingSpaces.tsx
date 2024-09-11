import {
  Button,
  Box,
  Dialog,
  DialogTitle,
  IconButton,
  DialogContent,
  Typography,
  Stack,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { LoadingButton } from '@mui/lab'
import { useState } from 'react'
import { InternalParkingSpaceSyncSuccessResponse } from 'onecore-types'

import { useSyncInternalParkingSpaces } from '../hooks/useSyncInternalParkingSpaces'

export const SyncInternalParkingSpaces = () => {
  const syncInternalParkingSpaces = useSyncInternalParkingSpaces()
  const [open, setOpen] = useState(false)
  const onCloseModal = () => setOpen(false)

  return (
    <>
      <Button variant="dark-outlined" onClick={() => setOpen(true)}>
        <Box
          sx={{
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          Synka interna bilplatser
        </Box>
      </Button>
      <Dialog onClose={onCloseModal} open={open} maxWidth="sm" fullWidth>
        <Box paddingTop="1rem">
          <Box display="flex">
            <DialogTitle variant="h1" fontSize={24} textAlign="left">
              Synka interna bilplatser från Xpand
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
        </Box>
        <DialogContent sx={{ paddingTop: '0.5rem' }}>
          <Box minHeight="500px" display="flex" flexDirection="column">
            <Box paddingX="0.5rem">
              <Typography variant="body1">
                Här kan du synkronisera alla <i>publicerade</i> bilplatser som
                finns i Xpand till OneCore. När du trycker på "Synka" så hämtas
                alla bilplatser från Xpand och sen läggs de in i OneCores
                databas.
              </Typography>
              <Typography>
                Om en bilplats som ligger inne i OneCore tas bort från Xpand så
                kommer den behövas tas bort manuellt även här i
                medarbetarportalen.
              </Typography>
            </Box>
            <Box flex="1" marginTop="1rem" display="flex" overflow="scroll">
              {syncInternalParkingSpaces.data && (
                <SyncInternalParkingSpacesResult
                  data={syncInternalParkingSpaces.data}
                />
              )}
            </Box>
            <LoadingButton
              loading={syncInternalParkingSpaces.isPending}
              variant="dark"
              sx={{ marginTop: '1rem' }}
              onClick={() => syncInternalParkingSpaces.mutate()}
            >
              Synka
            </LoadingButton>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  )
}

const SyncInternalParkingSpacesResult = (props: {
  data: InternalParkingSpaceSyncSuccessResponse
}) => {
  return (
    <Box flex="1" display="flex" flexDirection="column">
      <Typography fontWeight="bold" align="center">
        Resultat synkronisering
      </Typography>
      <Box
        maxHeight="500px"
        overflow="scroll"
        borderRadius="4px"
        bgcolor="rgba(0,0,0,0.1)"
        flex="1"
        padding="1rem"
      >
        <Box>
          <Typography component="span">Inlagda: </Typography>
          <Typography component="span" fontWeight="bold">
            {props.data.insertions.inserted.length}
          </Typography>
        </Box>
        <Box>
          <Typography component="span">Icke inlagda: </Typography>
          <Typography component="span" fontWeight="bold">
            {props.data.insertions.failed.length}
          </Typography>
        </Box>
        {props.data.invalid.length && (
          <Box paddingTop="0.5rem">
            <Typography component="span">
              Felformaterade bilplatser:{' '}
            </Typography>
            <Stack paddingLeft="0rem" marginTop="0.25rem" gap="0.5rem">
              {props.data.invalid.map((v) => (
                <Box
                  key={v.rentalObjectCode}
                  borderRadius="4px"
                  bgcolor="rgba(255,0,0,0.4)"
                  padding="0.5rem"
                >
                  <Typography component="span">Hyresobjektsid: </Typography>
                  <Typography component="span" fontWeight="bold">
                    {v.rentalObjectCode}
                  </Typography>
                  <Stack paddingLeft="0.5rem" gap="0.5rem">
                    {v.errors.map((err) => (
                      <Box key={`${err.path}-${err.code}`}>
                        <Box>
                          <Typography component="span" padding="0">
                            Objektsnyckel:{' '}
                          </Typography>
                          <Typography component="span" padding="0">
                            {err.path}
                          </Typography>
                        </Box>
                        <Box>
                          Fel:{' '}
                          <Typography component="span">
                            {mapErrorCodeToReadable(err.code)}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  )
}

const mapErrorCodeToReadable = (code: string) => {
  if (code === 'invalid_date') {
    return 'Ogiltigt datum (ev. saknas detta värde i Xpand.)'
  } else {
    return `'${code}' - Vi kunde inte tolka detta fel. Kontakta support.`
  }
}
