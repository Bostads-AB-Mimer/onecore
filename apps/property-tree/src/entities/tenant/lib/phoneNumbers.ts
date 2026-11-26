type WithMainFlag = { isMainNumber: boolean }

// Main numbers are the Xpand "standard" numbers that SMS should go to.
// Puts them first; the rest keep their original order (sort is stable).
// Copies the array so cached query data is never mutated.
export function sortMainNumberFirst<T extends WithMainFlag>(
  phoneNumbers: T[]
): T[] {
  return [...phoneNumbers].sort(
    (a, b) => Number(b.isMainNumber) - Number(a.isMainNumber)
  )
}

export function findMainPhoneNumber<T extends WithMainFlag>(
  phoneNumbers: T[] | undefined
): T | undefined {
  return phoneNumbers?.find((phone) => phone.isMainNumber)
}
