import { Grid, FormControl, Typography, TextField } from '@mui/material'

const OwnsVilla: React.FC = () => {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Hyresvärd *
          </Typography>

          <TextField size="small" placeholder="Namn på nuvarande hyresvärd" />
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6} margin={0}>
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Antal vuxna i hushåll *
          </Typography>

          <TextField
            type="number"
            name="adult-count"
            size="small"
            defaultValue={1}
            InputProps={{ inputProps: { min: 1 } }}
          />
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6} margin={0}>
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Antal barn i hushåll *
          </Typography>

          <TextField
            type="number"
            name="children-count"
            size="small"
            defaultValue={0}
            InputProps={{ inputProps: { min: 0 } }}
          />
        </FormControl>
      </Grid>

      <Grid item xs={12}>
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Telefonnummer hyresvärd *
          </Typography>

          <TextField size="small" type="tel" />
        </FormControl>
      </Grid>

      <Grid item xs={12}>
        <FormControl fullWidth>
          <Typography paddingBottom={1} variant="h2">
            Mejladress hyresvärd
          </Typography>

          <TextField size="small" type="email" />
        </FormControl>
      </Grid>
    </Grid>
  )
}

export default OwnsVilla
