export class MemoryStore {
  private store = new Map<string, any>()

  async get(key: string) {
    return this.store.get(key)
  }

  async set(key: string, sess: any) {
    this.store.set(key, sess)
  }

  async destroy(key: string) {
    this.store.delete(key)
  }
}
