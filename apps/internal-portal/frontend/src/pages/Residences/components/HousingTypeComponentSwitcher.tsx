import React from 'react'
import { useFormContext } from 'react-hook-form'
import { schemas } from 'onecore-types'
import { z } from 'zod'

import ApplicantIsRenter from './ApplicantIsRenter'
import ApplicantIsOwner from './ApplicantIsOwner'
import ApplicantIsOther from './ApplicantIsOther'

type HousingTypes = z.infer<
  typeof schemas.v1.ApplicationProfileHousingTypeSchema
>

const HousingTypeComponentSwitcher = () => {
  const housingType: HousingTypes = useFormContext().watch('housingType')

  const components = {
    RENTAL: <ApplicantIsRenter />,
    SUB_RENTAL: <ApplicantIsRenter />,
    LIVES_WITH_FAMILY: <ApplicantIsRenter />,
    LODGER: <ApplicantIsOwner />,
    OWNS_HOUSE: <ApplicantIsOwner />,
    OWNS_FLAT: <ApplicantIsOwner />,
    OWNS_ROW_HOUSE: <ApplicantIsOwner />,
    OTHER: <ApplicantIsOther />,
  }

  return components[housingType]
}

export default HousingTypeComponentSwitcher
