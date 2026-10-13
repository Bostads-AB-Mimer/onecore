import axios from 'axios'

/**
 * What an upstream failure is worth logging: status and body, or the message.
 * Logging a raw AxiosError dumps the whole request/socket graph.
 */
export const describeError = (err: unknown) => {
  if (axios.isAxiosError(err)) {
    return {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
      url: err.config?.url,
    }
  }
  return err instanceof Error ? { message: err.message } : { err }
}
