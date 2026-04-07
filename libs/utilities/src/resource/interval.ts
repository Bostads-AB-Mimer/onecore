export type Unit = 'ms' | 's' | 'm'

export const msInterval = (interval: number, unit: Unit) => {
  switch (unit) {
    case 'ms':
      return interval
    case 's':
      return interval * 1000
    case 'm':
      return interval * 1000 * 60
  }
}
