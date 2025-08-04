export type RequestError<ErrorCode> = {
  status: number
  errorCode: ErrorCode
  errorHeading: string
  errorMessage: string
}
