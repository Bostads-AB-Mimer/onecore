/**
 * Type definitions for XPand database row structures
 */

/**
 * Represents a single rent row from XPand's yearrentrows JSON structure
 */
export interface XPandRentRow {
  yearrent: number | string | null | undefined
  // Additional properties may exist in the XPand data
}
