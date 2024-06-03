import { ProcessError, ProcessStatus } from '../../common/types'

export const makeProcessError = <E = any>(
  error: E,
  httpStatus: number,
  response?: any
): ProcessError<E> => ({
  processStatus: ProcessStatus.failed,
  error,
  httpStatus,
  response,
})
