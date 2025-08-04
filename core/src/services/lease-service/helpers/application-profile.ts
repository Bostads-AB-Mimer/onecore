import dayjs from 'dayjs'
import { z } from 'zod'

import { schemas } from '../schemas'
import * as leasingAdapter from '../../../adapters/leasing-adapter'

type UpdateAdminApplicationProfileRequestParams = z.infer<
  typeof schemas.admin.applicationProfile.UpdateApplicationProfileRequestParams
>

/**
 * This function takes the incoming update payload and the optional existing profile
 * and returns a new update payload based on conditions.
 */
export function makeAdminApplicationProfileRequestParams(
  incoming: UpdateAdminApplicationProfileRequestParams,
  existing?: leasingAdapter.GetApplicationProfileResponseData
): leasingAdapter.CreateOrUpdateApplicationProfileRequestParams {
  const now = new Date()
  const expiresAt = dayjs(now).add(6, 'months').toDate()

  if (!existing) {
    return {
      housingType: incoming.housingType,
      housingTypeDescription: incoming.housingTypeDescription,
      landlord: incoming.landlord,
      numAdults: incoming.numAdults,
      numChildren: incoming.numChildren,
      lastUpdatedAt: null,
      expiresAt: null,
      housingReference: {
        reviewStatus: incoming.housingReference.reviewStatus,
        phone: incoming.housingReference.phone,
        email: incoming.housingReference.email,
        comment: incoming.housingReference.comment,
        reasonRejected: incoming.housingReference.reasonRejected,
        reviewedBy: incoming.housingReference.reviewedBy,
        expiresAt: null,
        reviewedAt:
          incoming.housingReference.reviewStatus === 'PENDING' ? null : now,
      },
    }
  }

  const changed = getDiffType(incoming, existing)
  if (changed === 'neither') {
    return {
      housingType: incoming.housingType,
      housingTypeDescription: incoming.housingTypeDescription,
      landlord: incoming.landlord,
      numAdults: incoming.numAdults,
      numChildren: incoming.numChildren,
      lastUpdatedAt: existing.lastUpdatedAt,
      expiresAt: existing.expiresAt,
      housingReference: {
        reviewStatus: incoming.housingReference.reviewStatus,
        phone: incoming.housingReference.phone,
        email: incoming.housingReference.email,
        comment: incoming.housingReference.comment,
        reasonRejected: incoming.housingReference.reasonRejected,
        reviewedBy: incoming.housingReference.reviewedBy,
        expiresAt: existing.housingReference.expiresAt,
        reviewedAt: existing.housingReference.reviewedAt,
      },
    }
  } else if (changed === 'profile') {
    return {
      housingType: incoming.housingType,
      housingTypeDescription: incoming.housingTypeDescription,
      landlord: incoming.landlord,
      numAdults: incoming.numAdults,
      numChildren: incoming.numChildren,
      expiresAt,
      lastUpdatedAt: now,
      housingReference: {
        reviewStatus: incoming.housingReference.reviewStatus,
        phone: incoming.housingReference.phone,
        email: incoming.housingReference.email,
        comment: incoming.housingReference.comment,
        reasonRejected: incoming.housingReference.reasonRejected,
        reviewedBy: incoming.housingReference.reviewedBy,
        reviewedAt: existing.housingReference.reviewedAt,
        expiresAt: existing.housingReference.expiresAt,
      },
    }
  } else if (changed === 'review') {
    return {
      housingType: incoming.housingType,
      housingTypeDescription: incoming.housingTypeDescription,
      landlord: incoming.landlord,
      numAdults: incoming.numAdults,
      numChildren: incoming.numChildren,
      lastUpdatedAt: existing.lastUpdatedAt,
      expiresAt: existing.expiresAt,
      housingReference: {
        reviewStatus: incoming.housingReference.reviewStatus,
        phone: incoming.housingReference.phone,
        email: incoming.housingReference.email,
        comment: incoming.housingReference.comment,
        reasonRejected: incoming.housingReference.reasonRejected,
        reviewedBy: incoming.housingReference.reviewedBy,
        expiresAt:
          incoming.housingReference.reviewStatus === 'REJECTED'
            ? incoming.housingReference.expiresAt
            : expiresAt,
        reviewedAt: now,
      },
    }
  } else {
    return {
      housingType: incoming.housingType,
      housingTypeDescription: incoming.housingTypeDescription,
      landlord: incoming.landlord,
      numAdults: incoming.numAdults,
      numChildren: incoming.numChildren,
      expiresAt,
      lastUpdatedAt: now,
      housingReference: {
        reviewStatus: incoming.housingReference.reviewStatus,
        phone: incoming.housingReference.phone,
        email: incoming.housingReference.email,
        comment: incoming.housingReference.comment,
        reasonRejected: incoming.housingReference.reasonRejected,
        reviewedBy: incoming.housingReference.reviewedBy,
        expiresAt,
        reviewedAt: now,
      },
    }
  }
}

type ComparableProfile = {
  numAdults: number
  numChildren: number
  housingType: string | null
  landlord: string | null
  housingTypeDescription: string | null
}

/*
 * This function takes the incoming application profile,
 * the existing application profile, compares them and returns what changed.
 *
 * 1. Check wether housing reference was reviewed.
 * 2. Check wether any profile fields were updated.
 *    The existing application profile can have a null housingType
 *    and the incoming _can not_. So I used an intermediary type (ComparableProfile) to map
 *    them both into 'comparable' objects, i.e objects with identical fields.
 */
function getDiffType(
  incoming: UpdateAdminApplicationProfileRequestParams,
  existing: leasingAdapter.GetApplicationProfileResponseData
): 'profile' | 'review' | 'both' | 'neither' {
  const incomingHousingReference = incoming.housingReference
  const existingHousingReference = existing.housingReference

  const incomingProfile: ComparableProfile = {
    housingType: incoming.housingType,
    housingTypeDescription: incoming.housingTypeDescription,
    landlord: incoming.landlord,
    numAdults: incoming.numAdults,
    numChildren: incoming.numChildren,
  }

  const existingProfile: ComparableProfile = {
    housingType: existing.housingType,
    housingTypeDescription: existing.housingTypeDescription,
    landlord: existing.landlord,
    numAdults: existing.numAdults,
    numChildren: existing.numChildren,
  }

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
