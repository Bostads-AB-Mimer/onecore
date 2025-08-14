import { Room } from '../../types'
import { GET } from './base-api'

export const roomService = {
  async getByResidenceId(residenceId: string): Promise<Room[]> {
    const { data, error } = await GET('/rooms', {
      params: {
        query: {
          residenceId,
        },
      },
    })
    if (error) throw error
    return data?.content || []
  },
}
