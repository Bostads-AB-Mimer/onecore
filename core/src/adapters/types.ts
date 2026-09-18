export type AdapterResult<T, E> =
  | { ok: true; data: T; statusCode?: number }
  | {
      ok: false
      err: E
      statusCode?: number
      /**
       * Human-readable context for the failure, when the upstream service
       * supplies one — for example the contact code behind a duplicate, or a
       * validation message written for a caseworker.
       *
       * Advisory only. Callers must branch on `err`, never on `detail`.
       */
      detail?: string
    }
