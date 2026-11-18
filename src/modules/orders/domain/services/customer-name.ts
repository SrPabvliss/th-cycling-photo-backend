/**
 * The name a message greets the buyer by. The order's frozen name comes first: the account can be
 * renamed after the sale, the order cannot.
 *
 * The frozen name goes whole: it is the buyer's given names, and "Juan Carlos" greeted as "Juan" reads
 * as a mistake. Only the account name is cut, because that one carries the surname too.
 */
export function customerFirstName(source: {
  snapFirstName?: string | null
  userName?: string | null
}): string {
  const frozen = source.snapFirstName?.trim()
  if (frozen) return frozen
  return (source.userName ?? '').trim().split(/\s+/)[0] ?? ''
}
