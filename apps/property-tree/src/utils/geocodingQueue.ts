import { geocodingService } from '@/services/api/geocodingService'

class GeocodingQueue {
  private queue: Array<{
    address: string
    resolve: (result: [number, number]) => void
    reject: (error: Error) => void
  }> = []
  private processing = false
  private readonly delay = 200 // 200ms between requests

  async add(
    address: string,
    onResult: (result: [number, number]) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    this.queue.push({
      address,
      resolve: onResult,
      reject: onError,
    })
    this.processQueue()
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return
    this.processing = true

    while (this.queue.length > 0) {
      const request = this.queue.shift()
      if (!request) continue

      try {
        const result = await geocodingService.searchAddress(request.address)
        request.resolve(result || [16.5455, 59.6099]) // Fallback to Västerås
      } catch (error) {
        request.reject(error as Error)
      }

      // Wait before processing next request
      await new Promise((resolve) => setTimeout(resolve, this.delay))
    }

    this.processing = false
  }
}

export const geocodingQueue = new GeocodingQueue()
