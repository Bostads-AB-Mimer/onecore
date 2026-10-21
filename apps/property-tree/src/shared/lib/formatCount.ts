export const formatCount = (
  count: number,
  singular: string,
  plural: string
): string =>
  `${count.toLocaleString('sv-SE')} ${count === 1 ? singular : plural}`
