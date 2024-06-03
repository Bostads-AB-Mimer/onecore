export enum ProcessStatus {
  successful,
  failed,
}

export interface ProcessSuccess<T = any> {
  processStatus: ProcessStatus.successful
  data: T
  httpStatus: number
  response?: any
}

export interface ProcessError<E = any> {
  processStatus: ProcessStatus.failed
  error: E
  httpStatus: number
  response?: any
}

export type ProcessResult<T, E> = ProcessSuccess<T> | ProcessError<E>
