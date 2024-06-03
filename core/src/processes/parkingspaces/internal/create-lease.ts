import { ProcessResult, ProcessStatus } from '../../../common/types'

// PROCESS part 3 (Scheduled job removes ad on due date/time, applicants sorted, create contract, publish as external if not applicants )
//
// 1. Scheduled job checks for due date of ad. The ad is "unpublished" on due date, E.G. not possible to apply anymore.
// 2. The list of applicants is sorted on queue time and other business rules.
// 3. Offer flow for the "best" suited applicant is triggered
// 4. Applicant is notified by mail that they have an offer to accept
// 5. If applicant accepts offer, contract is created and sent via email. the other applicants are notified that the parking space has been rented.
// 6. If offer is declined, the user is removed from list of applicants, process starts over from step 6
// 7. If no applicants are found, the ad is published as an external parking space
export const createLeaseForInternalParkingSpace = async (): Promise<
  ProcessResult<any, any>
> => {
  return {
    processStatus: ProcessStatus.failed,
    error: 'not-implemented',
    httpStatus: 500,
    response: {
      message: 'todo',
    },
  }
}
