import { POST } from './baseApi'

async function processIMD(csv: string) {
  const { data, error } = await POST('/imd/process', {
    body: { csv },
  })

  if (error) throw error
  if (!data?.content) throw new Error('Response ok but missing content')

  return data.content
}

export const imdService = {
  processIMD,
}
