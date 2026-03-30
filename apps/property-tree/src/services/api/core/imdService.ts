import { POST } from './baseApi'

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
