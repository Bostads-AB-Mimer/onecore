export const geocodingService = {
  async searchAddress(address: string): Promise<[number, number] | null> {
    try {
      const response = await fetch(
        `https://pelias.telge.iteam.pub/v1/search?text=${encodeURIComponent(address)}`
      )
      const data = await response.json()
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates
        return [lng, lat]
      }
      
      return null
    } catch (error) {
      console.error('Failed to geocode address:', error)
      return null
    }
  }
}
