import React from 'react'
import { useFormContext } from 'react-hook-form'
import { schemas } from 'onecore-types'
import { z } from 'zod'

import RejectedReason from './Form/RejectedReason'
import ExpiresAt from './Form/ExpiresAt'

type ReviewStatus = z.infer<
  typeof schemas.v1.HousingReferenceReviewStatusSchema
>

const HousingReferenceReviewStatusComponentSwitcher = () => {
  const reviewStatus: ReviewStatus = useFormContext().watch(
    'housingReference.reviewStatus'
  )

  if (reviewStatus === 'REJECTED') {
    return (
      <React.Fragment>
        <RejectedReason />
        <ExpiresAt />
      </React.Fragment>
    )
  } else {
    return null
  }
}

export default HousingReferenceReviewStatusComponentSwitcher
