import { Prisma } from '@prisma/client'

/** An IN-able subquery for a JSON-bound string list. OPENJSON's value column
 * is nvarchar; compared against a varchar column, SQL Server upcasts the
 * COLUMN and index seeks die (measured 346ms scan vs 8ms seek). */
export const openJsonList = (values: readonly string[]) =>
  Prisma.sql`(SELECT CAST(value AS VARCHAR(50)) FROM OPENJSON(${JSON.stringify(
    values
  )}))`
