import { z } from "zod"

/**
 * Where a guard turned the visitor away from, to be resumed once they can go
 * there. Shared by /login and /unauthorized so the rule below is written once.
 *
 * Only a path on this origin survives validation: an absolute URL here would
 * turn either page into an open redirect, and `//host` is a protocol-relative
 * URL wearing a path's clothes. Anything else is dropped rather than rejected —
 * a hand-edited address should still show the page it names.
 */
export const returnToSchema = z
  .string()
  .optional()
  .transform((value) =>
    value && value.startsWith("/") && !value.startsWith("//")
      ? value
      : undefined
  )
