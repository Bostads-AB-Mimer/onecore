import { ApplicantStatus, ListingStatus, OfferStatus } from 'onecore-types'

import { ProcessResult, ProcessStatus } from '../../../common/types'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as utils from '../../../utils'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import { makeProcessError } from '../utils'
import { logger } from 'onecore-utilities'

type ReplyToOfferError =
  | 'no-offer'
  | 'no-applicants'
  | 'update-applicant-status'
  | 'get-contact'
  | 'send-email'
  | 'unknown'

export const acceptOffer = async (
  offerId: string
): Promise<ProcessResult<null, ReplyToOfferError>> => {
  try {
    //TODO do it
    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 202,
      data: null,
    }
  } catch (err) {
    return makeProcessError('unknown', 500)
  }
}

export const denyOffer = async (
  offerId: string
): Promise<ProcessResult<null, ReplyToOfferError>> => {
  try {
    //TODO do it
    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 202,
      data: null,
    }
  } catch (err) {
    return makeProcessError('unknown', 500)
  }
}

export const expireOffer = async (
  offerId: string
): Promise<ProcessResult<null, ReplyToOfferError>> => {
  try {
    //TODO do it
    return {
      processStatus: ProcessStatus.successful,
      httpStatus: 200,
      data: null,
    }
  } catch (err) {
    return makeProcessError('unknown', 500)
  }
}
