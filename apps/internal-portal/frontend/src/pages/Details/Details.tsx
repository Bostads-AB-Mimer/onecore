import { Typography, Divider, Grid, Box } from '@mui/material'

import { useContact } from './hooks/useContact'

const Details = () => {
  const { data } = useContact()
  const contact = data?.data

  return (
    <>
      <Box>
        <Typography variant="h1">Mina uppgifter</Typography>
        <Divider />
        {contact && (
          <>
            <Typography variant="h2">Kontaktuppgifter</Typography>
            <Grid container sx={{ marginLeft: 1, marginTop: 1 }}>
              <Grid item xs={4} sx={{ marginBottom: 2 }}>
                Kundnummer
              </Grid>
              <Grid item xs={8}>
                <b>{contact?.contactId?.toLowerCase()}</b>
              </Grid>
              <Grid item xs={4}>
                Förnamn
              </Grid>
              <Grid item xs={8}>
                <b>{contact?.firstName}</b>
              </Grid>
              <Grid item xs={4} sx={{ marginBottom: 2 }}>
                Efternamn
              </Grid>
              <Grid item xs={8}>
                <b>{contact?.lastName}</b>
              </Grid>
              <Grid item xs={4}>
                Mobiltelefon
              </Grid>
              <Grid item xs={8}>
                <b>{contact?.mobilePhone}</b>
              </Grid>
              <Grid item xs={4}>
                Hemtelefon
              </Grid>
              <Grid item xs={8}>
                <b>{contact?.phoneNumber}</b>
              </Grid>
              <Grid item xs={4}>
                Epost
              </Grid>
              <Grid item xs={8}>
                <b>{contact?.emailAddress}</b>
              </Grid>
            </Grid>
            {/* <Divider />
            <Typography variant="h2">Ombud</Typography>
            <Grid container sx={{ marginLeft: 1, marginTop: 1 }}>
              <Grid item xs={12}>
                Kommer snart...
              </Grid>
            </Grid>
            <Divider />
            <Typography variant="h2">Sekretess</Typography>
            <Grid container sx={{ marginLeft: 1, marginTop: 1 }}>
              <Grid item xs={7}>
                Skyddade personuppgifter
              </Grid>
              <Grid item xs={5}>
                <b>Ja</b>
              </Grid>
            </Grid> */}
          </>
        )}
      </Box>
    </>
  )
}

export default Details
