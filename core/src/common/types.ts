export enum ProcessStatus {
  successful,
  failed,
  inProgress,
}

export interface ProcessResult {
  response?: any
  processStatus: ProcessStatus
  httpStatus: number
}
