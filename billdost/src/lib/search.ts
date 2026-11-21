/**
 * Escapes a user search term for safe use inside a PostgREST ilike
 * pattern. Without this, % and _ act as wildcards (a search for "%"
 * would match the whole shop) and backslash can break the pattern.
 * Every list/global search must route user input through here
 * (blueprint C13/C14 search safety).
 */
export function escapeIlike(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Builds a contains-pattern for ilike from raw user input. */
export function ilikePattern(term: string): string {
  return `%${escapeIlike(term.trim())}%`
}

/**
 * Pattern for the PostgREST .or() filter-string form, used by the list
 * endpoints (invoices/customers/quotations). On top of the ilike
 * escaping, the characters that structure an .or() string (comma and
 * parentheses) are removed from the term, so user input can never
 * break out of its own condition and rewrite the filter.
 */
export function orIlikePattern(term: string): string {
  const cleaned = term.trim().replace(/[(),]/g, ' ')
  return `%${escapeIlike(cleaned)}%`
}
