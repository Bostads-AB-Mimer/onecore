// Shared widths for the steward-admin board so the DragOverlay matches the
// inner width of a steward column exactly (no visual jump on grab).

const COLUMN_PADDING_X_PX = 16 // matches Tailwind `px-4`

export const COLUMN_WIDTH_PX = 280
export const COLUMN_INNER_WIDTH_PX = COLUMN_WIDTH_PX - 2 * COLUMN_PADDING_X_PX
