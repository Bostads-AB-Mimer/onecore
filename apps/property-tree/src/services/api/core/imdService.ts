import { POST } from './baseApi'
import type { paths } from './generated/api-types'

export type IMDProcessError =
  paths['/imd/process']['post']['responses'][400]['content']['application/json']

async function processIMD(csv: string) {
  const { data, error } = await POST('/imd/process', {
    body: { csv },
  })

  if (error) throw error

  return data.content
}

export const imdService = {
  processIMD,
}
