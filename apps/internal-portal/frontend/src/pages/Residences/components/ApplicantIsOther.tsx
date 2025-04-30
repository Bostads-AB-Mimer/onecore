import React from 'react'
import { Grid } from '@mui/material'

import NumAdults from './Form/NumAdults'
import NumChildren from './Form/NumChildren'
import HousingReferencePhone from './Form/HousingReferencePhone'
import HousingTypeDescription from './Form/HousingTypeDescription'

const ApplicantIsOther: React.FC = () => (
  <React.Fragment>
    <Grid item xs={12}>
      <HousingTypeDescription />
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
  </React.Fragment>
)

export default ApplicantIsOther
