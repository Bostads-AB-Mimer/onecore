/**
 * Result type for adapter operations that can fail in known, enumerated ways.
 *
 * Mirrors the shape used in `services/leasing`
 * (`src/services/lease-service/adapters/types.ts`), with one addition:
 * `detail` carries a human-readable message from the upstream system —
 * for Xpand SOAP that is the `Message` field of the Incit result envelope,
 * which is written in Swedish and is meaningful to a caseworker.
 *
 * `detail` is advisory. Callers must branch on `err`, never on `detail`.
 */
export type AdapterResult<T, E> =
  | { ok: true; data: T }
  | { ok: false; err: E; detail?: string }
