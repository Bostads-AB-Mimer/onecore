export const toBoolean = (value: number | null | undefined): boolean => {
  return Boolean(value);
};

export const trimString = (value: string | null | undefined): string | null => {
  if (typeof value === 'string') {
    return value.trim();
  }
  return null;
};
