/**
 * Build a case-insensitive "contains" matcher for a Mongo query, standing in
 * for Postgres `column ILIKE '%term%'`. The term is escaped so user input can
 * never inject regex metacharacters.
 */
export function regexContains(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}
