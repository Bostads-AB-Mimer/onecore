import React from 'react'
import { Grid } from '@mui/material'

import NumAdults from './Form/NumAdults'
import NumChildren from './Form/NumChildren'

const ApplicantIsOwner: React.FC = () => (
  <React.Fragment>
    <Grid item xs={12} sm={6} margin={0}>
      <NumAdults />
    </Grid>

    <Grid item xs={12} sm={6} margin={0}>
      <NumChildren />
    </Grid>
  </React.Fragment>
)

export default ApplicantIsOwner
