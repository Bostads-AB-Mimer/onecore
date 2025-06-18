import dayjs from 'dayjs'
import { z } from 'zod'

import { schemas } from '../schemas'
import * as leasingAdapter from '../../../adapters/leasing-adapter'

type UpdateAdminApplicationProfileRequestParams = z.infer<
  typeof schemas.admin.applicationProfile.UpdateApplicationProfileRequestParams
>

export function makeAdminApplicationProfileRequestParams(
  body: UpdateAdminApplicationProfileRequestParams,
  existingProfile?: leasingAdapter.GetApplicationProfileResponseData
): leasingAdapter.CreateOrUpdateApplicationProfileRequestParams {
  const now = new Date()
  const expiresAt = dayjs(now).add(6, 'months').toDate()

  if (!existingProfile) {
    return {
      ...body,
      lastUpdatedAt: null,
      expiresAt: null,
      housingReference: {
        ...body.housingReference,
        expiresAt: null,
        reviewedAt:
          body.housingReference.reviewStatus === 'PENDING' ? null : now,
      },
    }
  }

  const diffType = getDiffType(body, existingProfile)
  if (diffType === 'neither') {
    return {
      ...body,
      lastUpdatedAt: existingProfile.lastUpdatedAt,
      expiresAt: existingProfile.expiresAt,
      housingReference: {
        ...body.housingReference,
        reviewedAt: existingProfile.housingReference.reviewedAt,
        expiresAt: existingProfile.housingReference.expiresAt,
      },
    }
  } else if (diffType === 'profile') {
    return {
      ...body,
      expiresAt,
      lastUpdatedAt: now,
      housingReference: {
        ...body.housingReference,
        reviewedAt: existingProfile.housingReference.reviewedAt,
        expiresAt: existingProfile.housingReference.expiresAt,
      },
    }
  } else if (diffType === 'review') {
    return {
      ...body,
      lastUpdatedAt: existingProfile.lastUpdatedAt,
      expiresAt: existingProfile.expiresAt,
      housingReference: {
        ...body.housingReference,
        expiresAt:
          body.housingReference.reviewStatus === 'REJECTED'
            ? body.housingReference.expiresAt
            : expiresAt,
        reviewedAt: now,
      },
    }
  } else {
    return {
      ...body,
      expiresAt,
      lastUpdatedAt: now,
      housingReference: {
        ...body.housingReference,
        expiresAt,
        reviewedAt: now,
      },
    }
  }
}

function getDiffType(
  params: UpdateAdminApplicationProfileRequestParams,
  existing: leasingAdapter.GetApplicationProfileResponseData
): 'profile' | 'review' | 'both' | 'neither' {
  const { housingReference: incomingHousingReference, ...incomingProfile } =
    params
  const { housingReference: existingHousingReference, ...existingProfile } =
    schemas.admin.applicationProfile.UpdateApplicationProfileRequestParams.parse(
      existing
    )

  const reviewed =
    incomingHousingReference.reviewStatus !==
      existingHousingReference.reviewStatus ||
    (incomingHousingReference.reviewStatus == 'REJECTED' &&
      incomingHousingReference.expiresAt !== existingHousingReference.expiresAt)

  const profileUpdate =
    JSON.stringify(incomingProfile) !== JSON.stringify(existingProfile)

  if (reviewed && profileUpdate) {
    return 'both'
  } else if (reviewed) {
    return 'review'
  } else if (profileUpdate) {
    return 'profile'
  } else {
    return 'neither'
  }
}
