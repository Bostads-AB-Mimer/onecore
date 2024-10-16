import { ProcessError, ProcessStatus } from '../../common/types'
import * as leasingAdapter from '../../adapters/leasing-adapter'

export const makeProcessError = <E = any>(
  error: E,
  httpStatus: number,
  response?: any
): ProcessError<E> => ({
  processStatus: ProcessStatus.failed,
  error,
  httpStatus,
  response: { ...response, errorCode: error },
})

type ValidationResult =
  | Awaited<ReturnType<typeof leasingAdapter.validatePropertyRentalRules>>
  | Awaited<
      ReturnType<typeof leasingAdapter.validateResidentialAreaRentalRules>
    >

export const validateRentalRules = (
  validationResult: ValidationResult,
  applicationType: 'Replace' | 'Additional'
) => {
  if (!validationResult.ok) {
    if (validationResult.err.tag === 'not-found') {
      return { ok: false, err: 'not-found' }
    }

    if (validationResult.err.tag === 'not-a-parking-space') {
      return { ok: false, err: 'not-a-parking-space' }
    }

    if (
      validationResult.err.tag === 'not-tenant-in-the-property' ||
      validationResult.err.tag === 'no-housing-contract-in-the-area'
    ) {
      return { ok: false, err: 'no-contract-in-the-area' }
    }
    return { ok: false, err: 'unknown' }
  }

  if (validationResult.data.applicationType == 'Additional') {
    //Applicant is allowed to rent an additional parking space in this area
    return { ok: true, data: { reason: validationResult.data.reason } }
  } else if (
    validationResult.data.applicationType == 'Replace' &&
    applicationType == 'Replace'
  ) {
    //Applicant is allowed to replace their current parking space for a new one in this area
    return { ok: true, data: { reason: validationResult.data.reason } }
  } else {
    //Applicant is not allowed to rent an additional parking space in this area
    return {
      ok: false,
      err: 'not-allowed-to-rent-additional',
    }
  }
}
