import React from 'react'
import { Grid } from '@mui/material'

import Landlord from './Form/Landlord'
import NumAdults from './Form/NumAdults'
import NumChildren from './Form/NumChildren'
import HousingReferencePhone from './Form/HousingReferencePhone'
import HousingReferenceEmail from './Form/HousingReferenceEmail'

const ApplicantIsRenter: React.FC = () => (
  <React.Fragment>
    <Grid item xs={12}>
      <Landlord />
    </Grid>

    <Grid item xs={12} sm={6} margin={0}>
      <NumAdults />
    </Grid>

    <Grid item xs={12} sm={6} margin={0}>
      <NumChildren />
    </Grid>

    <Grid item xs={12}>
      <HousingReferencePhone />
    </Grid>

    <Grid item xs={12}>
      <HousingReferenceEmail />
    </Grid>
  </React.Fragment>
)

export default ApplicantIsRenter
