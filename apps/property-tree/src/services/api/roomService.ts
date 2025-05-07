import { Room } from '../types'
import { GET } from '../api/core/base-api'

export const roomService = {
  async getByResidenceId(residenceId: string): Promise<Room[]> {
    const { data, error } = await GET('/propertyBase/rooms', {
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
