type QuantityValue = {
  id?: string
  quantityTypeId?: string
  value?: number | string
}

export const getQuantityValue = <T extends QuantityValue>(
  quantityValues: T[] | undefined,
  id: string,
  field: 'id' | 'quantityTypeId' = 'id'
): T['value'] | undefined => {
  return quantityValues?.find((x) => x[field] === id)?.value
}
