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
import React, { useState } from 'react'
import { InternalParkingSpaceSyncSuccessResponse } from '@onecore/types'

import { useSyncInternalParkingSpaces } from '../hooks/useSyncInternalParkingSpaces'

export const SyncInternalParkingSpaces = () => {
  const syncInternalParkingSpaces = useSyncInternalParkingSpaces()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <React.Fragment>
      <Button variant="dark-outlined" onClick={() => setIsOpen(true)}>
        Hämta publicerade bilplatser
      </Button>
      <Dialog
        onClose={() => setIsOpen(false)}
        open={isOpen}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle variant="h1" fontSize={24} textAlign="left">
          Hämta publicerade bilplatser från XPand
        </DialogTitle>

        <IconButton
          aria-label="close"
          onClick={() => setIsOpen(false)}
          sx={(theme) => ({
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme.palette.grey[500],
          })}
        >
          <CloseIcon />
        </IconButton>

        <DialogContent>
          <Box minHeight="500px" display="flex" flexDirection="column">
            <Box paddingX="0.5rem">
              <Typography variant="body1">
                Här kan du hämta alla <i>publicerade</i> bilplatser som finns i
                Xpand. När du trycker på &quot;Hämta publicerade
                bilplatser&quot; så hämtas alla bilplatser från XPand och sen
                läggs de in i OneCores databas.
              </Typography>
              <Typography>
                Om en bilplats som ligger inne i OneCore tas bort från XPand så
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
              Hämta publicerade bilplatser
            </LoadingButton>
          </Box>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  )
}

const SyncInternalParkingSpacesResult = (props: {
  data: InternalParkingSpaceSyncSuccessResponse
}) => {
  return (
    <Box flex="1" display="flex" flexDirection="column">
      <Typography fontWeight="bold" align="center">
        Resultat hämtning av bilplatser
      </Typography>
      <Box
        overflow="scroll"
        borderRadius="4px"
        flex="1"
        padding="1rem"
        sx={(theme) => ({
          backgroundColor: theme.palette.grey[300],
        })}
        marginBottom="1rem"
      >
        <Typography>
          Inlagda:&nbsp;
          <Typography component="span" fontWeight="bold">
            {props.data.insertions.inserted.length}
          </Typography>
        </Typography>

        <Typography>
          Ej inlagda:&nbsp;
          <Typography component="span" fontWeight="bold">
            {props.data.insertions.failed.length}
          </Typography>
        </Typography>
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
