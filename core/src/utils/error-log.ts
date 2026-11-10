import axios from 'axios'

/** `{ status, error }` for the log — never the raw AxiosError (AGENTS.md). */
export const errorLogFields = (err: unknown) => ({
  status: axios.isAxiosError(err) ? err.response?.status : undefined,
  error: err instanceof Error ? err.message : String(err),
})
