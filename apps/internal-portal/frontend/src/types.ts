export type RequestError<ErrorCode> = {
  status: number
  errorCode: ErrorCode
  errorMessage: string
}
