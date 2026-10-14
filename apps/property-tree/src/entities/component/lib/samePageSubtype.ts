export const samePageSubtype = (
  previousKey: readonly unknown[] | undefined,
  filter: { subtypeId: string } | undefined
): boolean => {
  const previous = previousKey?.[2] as { subtypeId?: string } | undefined
  return Boolean(filter) && previous?.subtypeId === filter?.subtypeId
}
