export const prismaErrorCode = (err: unknown): string | undefined =>
  err && typeof err === 'object' && 'code' in err
    ? (err as { code?: string }).code
    : undefined
